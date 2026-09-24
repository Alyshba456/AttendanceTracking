import { createHash } from 'crypto';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const DB_FILE = (() => {
  try {
    if (typeof __dirname !== 'undefined') return resolve(__dirname, '.staffsync-db.json');
  } catch {}
  try {
    const { fileURLToPath } = require('url') as typeof import('url');
    const { dirname } = require('path') as typeof import('path');
    const __filename = fileURLToPath(import.meta.url);
    return resolve(dirname(__filename), '.staffsync-db.json');
  } catch {
    return resolve(process.cwd(), 'backend', '.staffsync-db.json');
  }
})();

function tryReadDBFile(): any {
  try {
    if (!existsSync(DB_FILE)) return null;
    const raw = readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch { return null; }
}

export function hashPw(plain: string): string {
  return createHash('sha256').update(plain).digest('hex');
}

export function todayStr() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const TODAY = todayStr();

export type InMemRemark = { _id?: string; text: string; createdAt: string; createdBy: string; updatedAt?: string };
export type InMemEmployee = {
  id: string; name: string; email: string; dept: string; designation: string;
  role: 'Admin' | 'Employee'; status: 'Active' | 'Inactive';
  tempPassword: string; password: string; firstLogin: boolean;
  remarks?: string; remarksHistory?: InMemRemark[];
};
export type InMemLeave = {
  leaveId: number; empId: string; name: string; type: string;
  start: string; end: string; days: number; reason: string; reqDate: string;
  status: 'Pending' | 'Approved' | 'Rejected'; reconsidered?: boolean;
};
export type InMemFieldWork = {
  fwId: number; empId: string; name: string; date: string; location: string;
  start: string; end: string; hours: string; desc: string; status: 'Pending' | 'Approved' | 'Rejected';
};
export type InMemAttendance = {
  attId: number; empId: string; name: string; dept: string; date: string;
  clockIn: string; clockOut: string; officeHours: string; fieldHours: string; status: string;
  mode: 'Office' | 'WFH';
};
export type InMemSettings = {
  companyName: string; companyEmail: string; companyAddress: string;
  workStartTime: string; workEndTime: string; leaveAllowance: number;
  workWeek: string; lateBuffer: number; overtimeBuffer: number;
};
export type InMemAdmin = { id: 'ADMIN'; email: string; name: string; password: string; role: 'Admin' };

export class InMemoryDB {
  employees: InMemEmployee[] = [
    { id: 'EMP-001', name: 'Sarah Johnson', email: 'sarah@company.com', dept: 'Engineering', designation: 'Software Engineer', role: 'Employee', status: 'Active', tempPassword: '', password: hashPw('Sarah@Sync1!'), firstLogin: false },
    { id: 'EMP-002', name: 'Marco Reyes', email: 'marco@company.com', dept: 'Marketing', designation: 'Marketing Specialist', role: 'Employee', status: 'Active', tempPassword: '', password: hashPw('Marco@Sync2!'), firstLogin: false },
    { id: 'EMP-003', name: 'Ana Torres', email: 'ana@company.com', dept: 'Operations', designation: 'Operations Lead', role: 'Employee', status: 'Active', tempPassword: '', password: hashPw('Ana@Sync3!'), firstLogin: false },
    { id: 'EMP-004', name: 'Ben Cruz', email: 'ben@company.com', dept: 'Finance', designation: 'Finance Analyst', role: 'Employee', status: 'Inactive', tempPassword: '', password: hashPw('Ben@Sync4!'), firstLogin: false },
    { id: 'EMP-005', name: 'Lea Santos', email: 'lea@company.com', dept: 'HR', designation: 'HR Manager', role: 'Admin', status: 'Active', tempPassword: '', password: hashPw('Lea@Sync5!'), firstLogin: false },
  ];
  admin: InMemAdmin = { id: 'ADMIN', email: 'admin@company.com', name: 'Admin User', password: hashPw('Admin@Sync0!'), role: 'Admin' };
  leaves: InMemLeave[] = [
    { leaveId: 1, empId: 'EMP-001', name: 'Sarah Johnson', type: 'Vacation', start: 'Sep 22, 2026', end: 'Sep 23, 2026', days: 2, reason: 'Travel plans', reqDate: 'Sep 10, 2026', status: 'Pending' },
    { leaveId: 2, empId: 'EMP-002', name: 'Marco Reyes', type: 'Sick Leave', start: 'Sep 20, 2026', end: 'Sep 20, 2026', days: 1, reason: 'Medical check', reqDate: 'Sep 14, 2026', status: 'Pending' },
    { leaveId: 3, empId: 'EMP-001', name: 'Sarah Johnson', type: 'Sick Leave', start: 'Sep 14, 2026', end: 'Sep 14, 2026', days: 1, reason: 'Medical appointment', reqDate: 'Sep 1, 2026', status: 'Approved' },
    { leaveId: 4, empId: 'EMP-003', name: 'Ana Torres', type: 'Vacation', start: 'Aug 25, 2026', end: 'Aug 26, 2026', days: 2, reason: 'Family trip', reqDate: 'Aug 20, 2026', status: 'Approved' },
    { leaveId: 5, empId: 'EMP-004', name: 'Ben Cruz', type: 'Emergency', start: 'Jul 8, 2026', end: 'Jul 8, 2026', days: 1, reason: 'Personal emergency', reqDate: 'Jul 5, 2026', status: 'Rejected' },
    { leaveId: 6, empId: 'EMP-005', name: 'Lea Santos', type: 'Vacation', start: TODAY, end: TODAY, days: 1, reason: 'Personal day', reqDate: 'Sep 15, 2026', status: 'Approved' },
  ];
  fieldWork: InMemFieldWork[] = [
    { fwId: 1, empId: 'EMP-003', name: 'Ana Torres', date: TODAY, location: 'Warehouse B — Pasay', start: '08:00 AM', end: '04:00 PM', hours: '8h', desc: 'Inventory check', status: 'Pending' },
    { fwId: 2, empId: 'EMP-001', name: 'Sarah Johnson', date: 'Sep 11, 2026', location: 'Client Site A — Makati', start: '09:00 AM', end: '05:00 PM', hours: '8h', desc: 'System installation', status: 'Approved' },
    { fwId: 3, empId: 'EMP-002', name: 'Marco Reyes', date: 'Sep 9, 2026', location: 'Partner Office — BGC', start: '09:00 AM', end: '01:00 PM', hours: '4h', desc: 'Client meeting', status: 'Approved' },
    { fwId: 4, empId: 'EMP-003', name: 'Ana Torres', date: 'Sep 4, 2026', location: 'Client Site B — QC', start: '10:00 AM', end: '03:00 PM', hours: '5h', desc: 'Site survey', status: 'Rejected' },
  ];
  attendance: InMemAttendance[] = [
    { attId: 1, empId: 'EMP-001', name: 'Sarah Johnson', dept: 'Engineering', date: 'Sep 18, 2026', clockIn: '08:55 AM', clockOut: '06:00 PM', officeHours: '9h 5m', fieldHours: '—', status: 'Present', mode: 'Office' },
    { attId: 2, empId: 'EMP-002', name: 'Marco Reyes', dept: 'Marketing', date: 'Sep 18, 2026', clockIn: '09:20 AM', clockOut: '06:00 PM', officeHours: '8h 40m', fieldHours: '—', status: 'Late', mode: 'Office' },
    { attId: 3, empId: 'EMP-003', name: 'Ana Torres', dept: 'Operations', date: 'Sep 18, 2026', clockIn: '09:00 AM', clockOut: '06:00 PM', officeHours: '9h', fieldHours: '—', status: 'Present', mode: 'Office' },
    { attId: 4, empId: 'EMP-001', name: 'Sarah Johnson', dept: 'Engineering', date: 'Sep 17, 2026', clockIn: '09:02 AM', clockOut: '06:00 PM', officeHours: '8h 58m', fieldHours: '—', status: 'Present', mode: 'Office' },
    { attId: 5, empId: 'EMP-001', name: 'Sarah Johnson', dept: 'Engineering', date: 'Sep 16, 2026', clockIn: '—', clockOut: '—', officeHours: '—', fieldHours: '—', status: 'Leave', mode: 'Office' },
    { attId: 6, empId: 'EMP-001', name: 'Sarah Johnson', dept: 'Engineering', date: 'Sep 11, 2026', clockIn: '—', clockOut: '—', officeHours: '—', fieldHours: '8h', status: 'Field Work', mode: 'Office' },
  ];
  settings: InMemSettings = {
    companyName: 'StaffSync',
    companyEmail: 'hr@attendtrack.com',
    companyAddress: '123 Business Ave, Makati City',
    workStartTime: '09:00',
    workEndTime: '18:00',
    leaveAllowance: 14,
    workWeek: 'Monday – Friday',
    lateBuffer: 15,
    overtimeBuffer: 30,
  };

  nextId<T extends { leaveId?: number; fwId?: number; attId?: number }>(arr: T[], key: 'leaveId' | 'fwId' | 'attId'): number {
    const max = arr.reduce((m, r) => Math.max(m, Number(r[key]) || 0), 0);
    return max + 1;
  }

  nextEmpId(): string {
    const max = this.employees.reduce((m, e) => {
      const n = parseInt((e.id.match(/\d+/) || ['0'])[0]);
      return Math.max(m, n);
    }, 0);
    return `EMP-${String(max + 1).padStart(3, '0')}`;
  }

  strip<T extends { password?: string; tempPassword?: string }>(obj: T): Omit<T, 'password' | 'tempPassword'> & { demoTempPassword?: string } {
    const { password, tempPassword, ...rest } = obj as any;
    const out: any = { ...rest };
    if (tempPassword) out.demoTempPassword = tempPassword;
    return out;
  }

  loadFromDisk(): boolean {
    const stored = tryReadDBFile();
    if (!stored || typeof stored !== 'object') return false;
    let applied = false;
    for (const key of ['employees', 'leaves', 'fieldWork', 'attendance', 'settings'] as const) {
      const arr = stored[key];
      if (Array.isArray(arr) && (arr.length > 0 || key !== 'settings')) {
        (this as any)[key] = JSON.parse(JSON.stringify(arr));
        applied = true;
      } else if (key === 'settings' && arr && typeof arr === 'object' && !Array.isArray(arr)) {
        this.settings = { ...this.settings, ...arr };
        applied = true;
      }
    }
    if (stored.admin && stored.admin && typeof stored.admin === 'object') {
      this.admin = { ...this.admin, ...(stored.admin as any) };
      applied = true;
    }
    return applied;
  }

  saveToDisk() {
    try {
      const snapshot = {
        employees: this.employees,
        leaves: this.leaves,
        fieldWork: this.fieldWork,
        attendance: this.attendance,
        settings: this.settings,
        admin: this.admin,
      };
      writeFileSync(DB_FILE, JSON.stringify(snapshot, null, 2), 'utf-8');
    } catch {
      // ignore disk write errors — server can still function with in-memory data
    }
  }

  resetFromSeed() {
    // Reset IN-MEMORY state to defaults immediately (works without server restart)
    this.employees = [
      { id: 'EMP-001', name: 'Sarah Johnson', email: 'sarah@company.com', dept: 'Engineering', designation: 'Software Engineer', role: 'Employee', status: 'Active', tempPassword: '', password: hashPw('Sarah@Sync1!'), firstLogin: false },
      { id: 'EMP-002', name: 'Marco Reyes', email: 'marco@company.com', dept: 'Marketing', designation: 'Marketing Specialist', role: 'Employee', status: 'Active', tempPassword: '', password: hashPw('Marco@Sync2!'), firstLogin: false },
      { id: 'EMP-003', name: 'Ana Torres', email: 'ana@company.com', dept: 'Operations', designation: 'Operations Lead', role: 'Employee', status: 'Active', tempPassword: '', password: hashPw('Ana@Sync3!'), firstLogin: false },
      { id: 'EMP-004', name: 'Ben Cruz', email: 'ben@company.com', dept: 'Finance', designation: 'Finance Analyst', role: 'Employee', status: 'Inactive', tempPassword: '', password: hashPw('Ben@Sync4!'), firstLogin: false },
      { id: 'EMP-005', name: 'Lea Santos', email: 'lea@company.com', dept: 'HR', designation: 'HR Manager', role: 'Admin', status: 'Active', tempPassword: '', password: hashPw('Lea@Sync5!'), firstLogin: false },
    ];
    this.admin = { id: 'ADMIN', email: 'admin@company.com', name: 'Admin User', password: hashPw('Admin@Sync0!'), role: 'Admin' };
    this.leaves = [
      { leaveId: 1, empId: 'EMP-001', name: 'Sarah Johnson', type: 'Vacation', start: 'Sep 22, 2026', end: 'Sep 23, 2026', days: 2, reason: 'Travel plans', reqDate: 'Sep 10, 2026', status: 'Pending' },
      { leaveId: 2, empId: 'EMP-002', name: 'Marco Reyes', type: 'Sick Leave', start: 'Sep 20, 2026', end: 'Sep 20, 2026', days: 1, reason: 'Medical check', reqDate: 'Sep 14, 2026', status: 'Pending' },
      { leaveId: 3, empId: 'EMP-001', name: 'Sarah Johnson', type: 'Sick Leave', start: 'Sep 14, 2026', end: 'Sep 14, 2026', days: 1, reason: 'Medical appointment', reqDate: 'Sep 1, 2026', status: 'Approved' },
      { leaveId: 4, empId: 'EMP-003', name: 'Ana Torres', type: 'Vacation', start: 'Aug 25, 2026', end: 'Aug 26, 2026', days: 2, reason: 'Family trip', reqDate: 'Aug 20, 2026', status: 'Approved' },
      { leaveId: 5, empId: 'EMP-004', name: 'Ben Cruz', type: 'Emergency', start: 'Jul 8, 2026', end: 'Jul 8, 2026', days: 1, reason: 'Personal emergency', reqDate: 'Jul 5, 2026', status: 'Rejected' },
      { leaveId: 6, empId: 'EMP-005', name: 'Lea Santos', type: 'Vacation', start: todayStr(), end: todayStr(), days: 1, reason: 'Personal day', reqDate: 'Sep 15, 2026', status: 'Approved' },
    ];
    this.fieldWork = [
      { fwId: 1, empId: 'EMP-003', name: 'Ana Torres', date: todayStr(), location: 'Warehouse B — Pasay', start: '08:00 AM', end: '04:00 PM', hours: '8h', desc: 'Inventory check', status: 'Pending' },
      { fwId: 2, empId: 'EMP-001', name: 'Sarah Johnson', date: 'Sep 11, 2026', location: 'Client Site A — Makati', start: '09:00 AM', end: '05:00 PM', hours: '8h', desc: 'System installation', status: 'Approved' },
      { fwId: 3, empId: 'EMP-002', name: 'Marco Reyes', date: 'Sep 9, 2026', location: 'Partner Office — BGC', start: '09:00 AM', end: '01:00 PM', hours: '4h', desc: 'Client meeting', status: 'Approved' },
      { fwId: 4, empId: 'EMP-003', name: 'Ana Torres', date: 'Sep 4, 2026', location: 'Client Site B — QC', start: '10:00 AM', end: '03:00 PM', hours: '5h', desc: 'Site survey', status: 'Rejected' },
    ];
    this.attendance = [
      { attId: 1, empId: 'EMP-001', name: 'Sarah Johnson', dept: 'Engineering', date: 'Sep 18, 2026', clockIn: '08:55 AM', clockOut: '06:00 PM', officeHours: '9h 5m', fieldHours: '—', status: 'Present', mode: 'Office' },
      { attId: 2, empId: 'EMP-002', name: 'Marco Reyes', dept: 'Marketing', date: 'Sep 18, 2026', clockIn: '09:20 AM', clockOut: '06:00 PM', officeHours: '8h 40m', fieldHours: '—', status: 'Late', mode: 'Office' },
      { attId: 3, empId: 'EMP-003', name: 'Ana Torres', dept: 'Operations', date: 'Sep 18, 2026', clockIn: '09:00 AM', clockOut: '06:00 PM', officeHours: '9h', fieldHours: '—', status: 'Present', mode: 'Office' },
      { attId: 4, empId: 'EMP-001', name: 'Sarah Johnson', dept: 'Engineering', date: 'Sep 17, 2026', clockIn: '09:02 AM', clockOut: '06:00 PM', officeHours: '8h 58m', fieldHours: '—', status: 'Present', mode: 'Office' },
      { attId: 5, empId: 'EMP-001', name: 'Sarah Johnson', dept: 'Engineering', date: 'Sep 16, 2026', clockIn: '—', clockOut: '—', officeHours: '—', fieldHours: '—', status: 'Leave', mode: 'Office' },
      { attId: 6, empId: 'EMP-001', name: 'Sarah Johnson', dept: 'Engineering', date: 'Sep 11, 2026', clockIn: '—', clockOut: '—', officeHours: '—', fieldHours: '8h', status: 'Field Work', mode: 'Office' },
    ];
    this.settings = {
      companyName: 'StaffSync', companyEmail: 'hr@attendtrack.com', companyAddress: '123 Business Ave, Makati City',
      workStartTime: '09:00', workEndTime: '18:00', leaveAllowance: 14, workWeek: 'Monday – Friday', lateBuffer: 15, overtimeBuffer: 30,
    };

    try {
      // Persist defaults to disk so they survive reboot
      writeFileSync(DB_FILE, '{}', 'utf-8');
      this.saveToDisk();
    } catch {}
  }
}

export const memDB = new InMemoryDB();

try {
  memDB.loadFromDisk();
} catch {}

