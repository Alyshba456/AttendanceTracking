import type { IncomingMessage, ServerResponse } from 'node:http';
import crypto from 'node:crypto';
import { memDB, hashPw, todayStr } from './inmem-db';
import { computeAttendanceStatus } from './utils/attendanceStatus';

type Req = IncomingMessage & { query: Record<string, any>; body: any; cookies: Record<string, string> };
type Res = ServerResponse & {
  status: (code: number) => Res;
  json: (data: any) => Res;
  send: (s: any) => void;
  setHeader: (k: string, v: string | string[]) => Res;
};

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-staffsync-local';

function signToken(p: any): string {
  const h = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ ...p, iat: Date.now(), exp: Date.now() + 7 * 86400 * 1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${payload}`).digest('base64url');
  return `${h}.${payload}.${sig}`;
}
function verifyToken(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [h, p, s] = parts;
    const expected = crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest('base64url');
    if (s !== expected) return null;
    const decoded = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    if (decoded.exp && decoded.exp < Date.now()) return null;
    return decoded;
  } catch { return null; }
}
function extractToken(req: Req): any | null {
  const auth = req.headers.authorization;
  if (!auth || typeof auth !== 'string') return null;
  const parts = auth.split(' ');
  if (parts[0] !== 'Bearer' || !parts[1]) return null;
  return verifyToken(parts[1]);
}

function ok(res: Res, data: any, status = 200) {
  res.status(status).json(data);
}
function err(res: Res, message: string, status = 400) {
  res.status(status).json({ error: message });
}
function corsH(req: Req, res: Res): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.statusCode = 200; res.end(); return true; }
  return false;
}

// ---- Handlers ----
function handleAuthLogin(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const { email, password } = req.body || {};
  if (!email || !password) return err(res, 'Please enter your email and password.');
  const hashed = hashPw(password);

  // Virtual admin account — if email matches, validate here. Wrong pw returns clear "incorrect password"
  // so we never fall through to employee.find (admin email not in employees table → would falsely say "no account")
  if (String(email).toLowerCase() === memDB.admin.email) {
    if (hashed !== memDB.admin.password) return err(res, 'Incorrect password. Please try again.');
    return ok(res, {
      token: signToken({ empId: memDB.admin.id, role: memDB.admin.role, email: memDB.admin.email }),
      role: 'admin', empId: memDB.admin.id, name: memDB.admin.name, firstLogin: false,
    });
  }
  const emp = memDB.employees.find(e => e.email.toLowerCase() === String(email).toLowerCase());
  if (!emp) return err(res, 'No account found with this email.');
  if (emp.status === 'Inactive') return err(res, 'This account has been deactivated. Contact your Admin.');
  const expected = emp.firstLogin ? hashPw(emp.tempPassword) : emp.password;
  if (hashed !== expected) return err(res, 'Incorrect password. Please try again.');
  return ok(res, {
    token: signToken({ empId: emp.id, role: emp.role, email: emp.email }),
    role: emp.role === 'Admin' ? 'admin' : 'employee',
    empId: emp.id, name: emp.name, firstLogin: emp.firstLogin,
  });
}

function handleChangePassword(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const { empId, currentPassword, newPassword } = req.body || {};
  if (!empId || !newPassword) return err(res, 'Employee ID and new password are required.');

  if (empId === memDB.admin.id) {
    if (currentPassword && hashPw(currentPassword) !== memDB.admin.password) {
      return err(res, 'Current password is incorrect.', 400);
    }
    memDB.admin.password = hashPw(newPassword);
    memDB.saveToDisk();
    return ok(res, { success: true, message: 'Admin password changed successfully.' });
  }

  const emp = memDB.employees.find(e => e.id === empId);
  if (!emp) return err(res, 'Employee not found.');
  if (currentPassword && hashPw(currentPassword) !== emp.password) {
    return err(res, 'Current password is incorrect.', 400);
  }
  emp.password = hashPw(newPassword);
  emp.firstLogin = false;
  emp.tempPassword = '';
  memDB.saveToDisk();
  ok(res, { success: true, message: 'Password changed successfully.' });
}

function handleForgotPassword(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const { email } = req.body || {};
  if (!email) return err(res, 'Email is required.');
  const emp = memDB.employees.find(e => e.email.toLowerCase() === String(email).toLowerCase());
  const tempPw = crypto.randomBytes(4).toString('hex') + '!A1';
  if (emp) { emp.tempPassword = tempPw; emp.firstLogin = true; memDB.saveToDisk(); }
  ok(res, {
    success: true,
    message: 'A temporary password has been generated. (Demo mode: shown below for testing.)',
    demoTempPassword: emp ? tempPw : undefined,
  });
}

function handleGetEmployees(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const auth = extractToken(req);
  const empIdFilter = (req.query.empId as string) || (auth ? auth.empId : null);
  if (!auth || auth.role !== 'Admin') {
    if (empIdFilter) {
      const e = memDB.employees.find(x => x.id === empIdFilter);
      if (!e) return err(res, 'Employee not found', 404);
      return ok(res, e);
    }
    return err(res, 'Unauthorized', 401);
  }
  ok(res, memDB.employees.map(e => ({ ...e, password: undefined, tempPassword: undefined })));
}

function handleCreateEmployee(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const auth = extractToken(req);
  if (!auth || auth.role !== 'Admin') return err(res, 'Unauthorized: Admin only', 401);
  const { name, email, dept, designation, role, status } = req.body || {};
  if (!name || !email || !dept || !designation) return err(res, 'Missing required fields');
  const tempPw = crypto.randomBytes(4).toString('hex') + '!A1';
  const newEmp: any = {
    id: memDB.nextEmpId(), name, email: String(email).toLowerCase(), dept, designation,
    role: role || 'Employee', status: status || 'Active',
    tempPassword: tempPw, password: hashPw(tempPw), firstLogin: true,
  };
  memDB.employees.push(newEmp);
  memDB.saveToDisk();
  return ok(res, memDB.strip(newEmp), 201);
}

function handleUpdateEmployee(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const auth = extractToken(req);
  if (!auth || auth.role !== 'Admin') return err(res, 'Unauthorized: Admin only', 401);
  const { id, name, email, dept, designation, role, status, tempPassword, firstLogin, remarks } = req.body || {};
  if (!id) return err(res, 'Employee ID is required');
  const emp = memDB.employees.find(e => e.id === id);
  if (!emp) return err(res, 'Employee not found', 404);
  if (name) emp.name = name;
  if (email) emp.email = String(email).toLowerCase();
  if (dept) emp.dept = dept;
  if (designation) emp.designation = designation;
  if (role) emp.role = role;
  if (status !== undefined) emp.status = status;
  if (remarks !== undefined) (emp as any).remarks = String(remarks ?? '');
  if (tempPassword && String(tempPassword).length >= 8) {
    emp.tempPassword = String(tempPassword);
    emp.password = hashPw(String(tempPassword));
    emp.firstLogin = firstLogin ?? true;
  }
  memDB.saveToDisk();
  ok(res, memDB.strip(emp as any));
}

function handlePatchEmployee(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const auth = extractToken(req);
  if (!auth || auth.role !== 'Admin') return err(res, 'Unauthorized: Admin only', 401);
  const { id, action, text, createdBy } = req.body || {};
  if (!id) return err(res, 'Employee ID is required');
  const emp = memDB.employees.find(e => e.id === id);
  if (!emp) return err(res, 'Employee not found', 404);
  if (action === 'appendRemark') {
    if (!text || !String(text).trim()) return err(res, 'Remark text is required.', 400);
    if (!Array.isArray((emp as any).remarksHistory)) (emp as any).remarksHistory = [];
    const now = new Date().toISOString();
    const entry = {
      _id: 'rm_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      text: String(text).trim(),
      createdAt: now,
      createdBy: String(createdBy || auth.name || auth.empId || 'ADMIN'),
      updatedAt: now,
    };
    (emp as any).remarksHistory.unshift(entry);
    memDB.saveToDisk();
    return ok(res, memDB.strip(emp as any));
  }
  return err(res, `Unknown PATCH action: ${String(action || 'undefined')}`, 400);
}

function handleDeleteEmployee(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const auth = extractToken(req);
  if (!auth || auth.role !== 'Admin') return err(res, 'Unauthorized: Admin only', 401);
  const { id } = req.body || {};
  if (!id) return err(res, 'Employee ID is required');
  const idx = memDB.employees.findIndex(e => e.id === id);
  if (idx < 0) return err(res, 'Employee not found', 404);
  memDB.employees.splice(idx, 1);
  memDB.saveToDisk();
  ok(res, { success: true });
}

function handleGetLeaves(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const auth = extractToken(req);
  if (!auth) return err(res, 'Unauthorized', 401);
  const empId = req.query.empId as string;
  const list = memDB.leaves
    .filter(l => (auth.role === 'Admin' && !empId) ? true : l.empId === (empId || auth.empId))
    .map(l => ({ ...l, id: l.leaveId }));
  ok(res, list.sort((a, b) => b.leaveId - a.leaveId));
}

function handleCreateLeave(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const auth = extractToken(req);
  if (!auth) return err(res, 'Unauthorized', 401);
  const b = req.body || {};
  if (!b.empId || !b.type || !b.start || !b.end || !b.days) return err(res, 'Missing required fields');
  const leave: any = {
    leaveId: memDB.nextId(memDB.leaves, 'leaveId'),
    empId: b.empId, name: b.name || '', type: b.type,
    start: b.start, end: b.end, days: Number(b.days), reason: b.reason || '',
    reqDate: b.reqDate || todayStr(), status: 'Pending',
  };
  memDB.leaves.push(leave);
  memDB.saveToDisk();
  ok(res, { ...leave, id: leave.leaveId }, 201);
}

function handleLeaveUpdate(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const auth = extractToken(req);
  const b = req.body || {};
  if (auth && auth.role !== 'Admin' && !b.reconsider) return err(res, 'Unauthorized: Admin only', 401);
  if (!b.leaveId) return err(res, 'Leave ID is required');
  const l = memDB.leaves.find(x => x.leaveId === Number(b.leaveId));
  if (!l) return err(res, 'Leave request not found', 404);
  if (b.status) l.status = b.status;
  if (b.reconsidered !== undefined) l.reconsidered = b.reconsidered;
  memDB.saveToDisk();
  ok(res, { ...l, id: l.leaveId });
}

function handleGetFieldWork(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const auth = extractToken(req);
  if (!auth) return err(res, 'Unauthorized', 401);
  const empId = req.query.empId as string;
  const list = memDB.fieldWork
    .filter(f => (auth.role === 'Admin' && !empId) ? true : f.empId === (empId || auth.empId))
    .map(f => ({ ...f, id: f.fwId }));
  ok(res, list.sort((a, b) => b.fwId - a.fwId));
}

function handleCreateFieldWork(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const auth = extractToken(req);
  if (!auth) return err(res, 'Unauthorized', 401);
  const b = req.body || {};
  if (!b.empId || !b.date || !b.location || !b.start || !b.end) return err(res, 'Missing required fields');
  const parse = (t: string) => {
    const [tm, ap] = t.split(' ');
    const parts = (tm || '0:0').split(':').map(Number);
    let hour = parts[0] || 0;
    if (ap === 'PM' && parts[0] !== 12) hour += 12;
    if (ap === 'AM' && parts[0] === 12) hour = 0;
    return hour * 60 + (parts[1] || 0);
  };
  const mins = parse(b.end) - parse(b.start);
  const hours = mins > 0 ? (mins % 60 > 0 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${Math.floor(mins / 60)}h`) : (b.hours || '8h');
  const fw: any = {
    fwId: memDB.nextId(memDB.fieldWork, 'fwId'),
    empId: b.empId, name: b.name || '', date: b.date, location: b.location,
    start: b.start, end: b.end, hours: b.hours || hours, desc: b.desc || '', status: 'Pending',
  };
  memDB.fieldWork.push(fw);
  memDB.saveToDisk();
  ok(res, { ...fw, id: fw.fwId }, 201);
}

function handleFieldWorkUpdate(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const auth = extractToken(req);
  if (!auth || auth.role !== 'Admin') return err(res, 'Unauthorized: Admin only', 401);
  const b = req.body || {};
  if (!b.fwId) return err(res, 'Field Work ID is required');
  const f = memDB.fieldWork.find(x => x.fwId === Number(b.fwId));
  if (!f) return err(res, 'Field work entry not found', 404);
  if (b.status) f.status = b.status;
  memDB.saveToDisk();
  ok(res, { ...f, id: f.fwId });
}

function handleGetAttendance(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const auth = extractToken(req);
  if (!auth) return err(res, 'Unauthorized', 401);
  const empId = req.query.empId as string;
  const date = req.query.date as string;
  const settings = memDB.settings;
  const list = memDB.attendance
    .filter(a => {
      if (auth.role !== 'Admin' || empId) {
        if (a.empId !== (empId || auth.empId)) return false;
      }
      if (date && a.date !== date) return false;
      return true;
    })
    .map(a => ({
      ...a,
      id: a.attId,
      mode: (a as any).mode || 'Office',
      status: computeAttendanceStatus(settings, a.clockIn, a.clockOut, a.status),
    }));
  ok(res, list.sort((a, b) => b.attId - a.attId).slice(0, 500));
}

function handlePostAttendance(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const auth = extractToken(req);
  if (!auth) return err(res, 'Unauthorized', 401);
  const b = req.body || {};
  const targetEmpId = auth.role === 'Admin' ? (b.empId || auth.empId) : auth.empId;
  const TODAY = todayStr();
  const settings = memDB.settings;
  const saveMode: 'Office' | 'WFH' = b.mode === 'WFH' ? 'WFH' : 'Office';

  if (b.action === 'clockIn') {
    const now = new Date();
    const clockInStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const status = computeAttendanceStatus(settings, clockInStr, null, 'Present');
    const existing = memDB.attendance.find(a => a.empId === targetEmpId && a.date === TODAY);
    if (existing) {
      existing.clockIn = clockInStr; existing.status = status; (existing as any).mode = saveMode;
      memDB.saveToDisk();
      return ok(res, { record: { ...existing, id: existing.attId, mode: (existing as any).mode || 'Office' }, clockInTime: now.toISOString() });
    }
    const emp = memDB.employees.find(e => e.id === targetEmpId);
    const newAtt: any = {
      attId: memDB.nextId(memDB.attendance, 'attId'),
      empId: targetEmpId, name: emp?.name || targetEmpId, dept: emp?.dept || '—',
      date: TODAY, clockIn: clockInStr, clockOut: '—', officeHours: '—', fieldHours: '—', status,
      mode: saveMode,
    };
    memDB.attendance.unshift(newAtt);
    memDB.saveToDisk();
    return ok(res, { record: { ...newAtt, id: newAtt.attId, mode: newAtt.mode || 'Office' }, clockInTime: now.toISOString() }, 201);
  }

  if (b.action === 'clockOut') {
    const now = new Date();
    const clockOutStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const record = memDB.attendance.find(a => a.empId === targetEmpId && a.date === TODAY);
    if (!record) return err(res, 'No clock-in found for today');
    const ciTime = b.clockInTime ? new Date(b.clockInTime) : now;
    const mins = Math.round((now.getTime() - ciTime.getTime()) / 60000);
    record.clockOut = clockOutStr;
    record.officeHours = mins > 0 ? (mins % 60 > 0 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${Math.floor(mins / 60)}h`) : '0h';
    record.status = computeAttendanceStatus(settings, record.clockIn, clockOutStr, record.status);
    memDB.saveToDisk();
    return ok(res, { record: { ...record, id: record.attId, mode: (record as any).mode || 'Office' }, clockOutTime: now.toISOString() });
  }

  return err(res, 'Invalid action');
}

function handleGetSettings(req: Req, res: Res) {
  if (corsH(req, res)) return;
  ok(res, memDB.settings);
}

function handleUpdateSettings(req: Req, res: Res) {
  if (corsH(req, res)) return;
  const auth = extractToken(req);
  if (!auth || auth.role !== 'Admin') return err(res, 'Unauthorized: Admin only', 401);
  Object.assign(memDB.settings, req.body || {});
  memDB.saveToDisk();
  ok(res, memDB.settings);
}

function handleSeed(req: Req, res: Res) {
  if (corsH(req, res)) return;
  if (req.query.force === 'true') {
    memDB.resetFromSeed();
  }
  ok(res, {
    success: true,
    results: {
      employees: 'Seeded (in-memory)',
      leaves: 'Seeded (in-memory)',
      fieldwork: 'Seeded (in-memory)',
      attendance: 'Seeded (in-memory)',
      settings: 'Seeded (in-memory)',
    },
    note: 'Running in local development mode with in-memory data store.',
  });
}

// ---- Route table ----
type H = (r: Req, s: Res) => any;
const REGISTRY: Record<string, H> = {
  'POST /api/auth/login': handleAuthLogin,
  'POST /api/auth/change-password': handleChangePassword,
  'POST /api/auth/forgot-password': handleForgotPassword,

  'GET /api/employees': handleGetEmployees,
  'POST /api/employees': handleCreateEmployee,
  'PUT /api/employees': handleUpdateEmployee,
  'PATCH /api/employees': handlePatchEmployee,
  'DELETE /api/employees': handleDeleteEmployee,

  'GET /api/leaves': handleGetLeaves,
  'POST /api/leaves': handleCreateLeave,
  'PATCH /api/leaves': handleLeaveUpdate,
  'PUT /api/leaves': handleLeaveUpdate,

  'GET /api/fieldwork': handleGetFieldWork,
  'POST /api/fieldwork': handleCreateFieldWork,
  'PATCH /api/fieldwork': handleFieldWorkUpdate,
  'PUT /api/fieldwork': handleFieldWorkUpdate,

  'GET /api/attendance': handleGetAttendance,
  'POST /api/attendance': handlePostAttendance,

  'GET /api/settings': handleGetSettings,
  'POST /api/settings': handleUpdateSettings,
  'PATCH /api/settings': handleUpdateSettings,
  'PUT /api/settings': handleUpdateSettings,

  'GET /api/seed': handleSeed,
};

// ---- Request body parsing / middleware entry ----

async function readBody(req: IncomingMessage): Promise<any> {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return undefined;
  const ct = req.headers['content-type'] || '';
  return new Promise<any>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      if (!raw.length) return resolve(undefined);
      try {
        if (ct.includes('application/json')) resolve(JSON.parse(raw.toString('utf8')));
        else if (ct.includes('urlencoded')) {
          const params = new URLSearchParams(raw.toString());
          const o: any = {};
          params.forEach((v, k) => o[k] = v);
          resolve(o);
        } else resolve(raw.toString());
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function parseCookies(header?: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const [k, ...v] = part.split('=');
    if (k) out[k.trim()] = decodeURIComponent(v.join('='));
  }
  return out;
}

export async function dispatchLocalApi(rawReq: IncomingMessage, rawRes: ServerResponse): Promise<boolean> {
  const url = new URL(rawReq.url || '/', `http://${rawReq.headers.host}`);
  const clean = url.pathname;
  if (!clean.startsWith('/api/')) return false;

  const method = rawReq.method || 'GET';
  const key = `${method} ${clean}`;
  const handler = REGISTRY[key];

  const query: Record<string, any> = {};
  for (const [k, v] of url.searchParams.entries()) {
    if (query[k] === undefined) query[k] = v;
    else if (Array.isArray(query[k])) query[k].push(v);
    else query[k] = [query[k], v];
  }

  const req = rawReq as Req;
  req.query = query;
  req.cookies = parseCookies(req.headers.cookie);
  req.body = await readBody(req).catch(() => undefined);

  const res = rawRes as Res;
  const origSetHeader = res.setHeader.bind(res);
  res.setHeader = (k: string, v: string | string[]) => { if (!res.headersSent) origSetHeader(k, v); return res; };
  res.status = (c) => { if (!res.headersSent) res.statusCode = c; return res; };
  res.json = (data) => {
    if (!res.headersSent) {
      origSetHeader('Content-Type', 'application/json');
      origSetHeader('Access-Control-Allow-Origin', '*');
    }
    res.status(res.statusCode || 200).end(JSON.stringify(data));
    return res;
  };
  res.send = (body: any) => {
    if (typeof body === 'object' && body !== null) return res.json(body);
    res.end(body);
  };

  if (!handler) {
    res.status(404).json({ error: `No API route: ${method} ${clean}` });
    return true;
  }
  try {
    await handler(req, res);
  } catch (e: any) {
    console.error(`[local-api] ${key} threw:`, e);
    res.status(500).json({ error: e?.message || 'Server error', stack: e?.stack });
  }
  return true;
}

export default function localApiMiddleware(req: IncomingMessage, res: ServerResponse, next: (err?: any) => void) {
  dispatchLocalApi(req, res).then(handled => {
    if (!handled) next();
  }).catch(e => {
    console.error('[local-api] mw error:', e);
    next(e);
  });
}
