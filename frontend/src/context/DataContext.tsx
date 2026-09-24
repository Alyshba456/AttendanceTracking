import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { api } from '../utils/api';
import { hashPw } from '../utils/crypto';
import type { AttendanceStatus, SettingsLike } from '../utils/attendanceStatus';
import {
  computeAttendanceStatus,
  parse24hToMinutes,
  parse12hToMinutes,
  parseAnyTimeToMinutes,
  formatHoursMinutes,
} from '../utils/attendanceStatus';
export type { AttendanceStatus, SettingsLike } from '../utils/attendanceStatus';

export {
  computeAttendanceStatus,
  parse24hToMinutes,
  parse12hToMinutes,
  parseAnyTimeToMinutes,
  formatHoursMinutes,
};

export type EmployeeRemark = {
  _id?: string;
  text: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
};

export type Employee = {
  id: string;
  name: string;
  email: string;
  dept: string;
  designation: string;
  role: string;
  status: string;
  tempPassword: string;
  password: string;
  firstLogin: boolean;
  remarks: string;
  remarksHistory?: EmployeeRemark[];
};

export type Leave = {
  id: number; empId: string; name: string; type: string;
  start: string; end: string; days: number; reason: string; reqDate: string; status: string;
  reconsidered?: boolean;
};

export type FieldWorkEntry = {
  id: number; empId: string; name: string; date: string;
  location: string; start: string; end: string; hours: string; desc: string; status: string;
};

export type AttendanceMode = 'Office' | 'WFH';

export type AttendanceRecord = {
  id: number; empId: string; name: string; dept: string;
  date: string; clockIn: string; clockOut: string; officeHours: string; fieldHours: string; status: AttendanceStatus;
  mode: AttendanceMode;
};

export type CompanySettings = {
  companyName: string;
  companyEmail: string;
  companyAddress: string;
  workStartTime: string;
  workEndTime: string;
  leaveAllowance: number;
  workWeek: string;
  lateBuffer: number;
  overtimeBuffer: number;
  customDepartments: string[];
};

export type NotificationKind = 'leave_pending' | 'fieldwork_pending' | 'leave_decision' | 'fieldwork_decision';

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  subtitle: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  date: string;
  entityId: number | string;
  empId: string;
  empName: string;
};

type Ctx = {
  employees: Employee[];
  setEmployees: (v: Employee[] | ((p: Employee[]) => Employee[])) => void;
  leaves: Leave[];
  setLeaves: (v: Leave[] | ((p: Leave[]) => Leave[])) => void;
  fieldWork: FieldWorkEntry[];
  setFieldWork: (v: FieldWorkEntry[] | ((p: FieldWorkEntry[]) => FieldWorkEntry[])) => void;
  attendance: AttendanceRecord[];
  setAttendance: (v: AttendanceRecord[] | ((p: AttendanceRecord[]) => AttendanceRecord[])) => void;
  todayClockIn: Date | null;
  todayClockOut: Date | null;
  companySettings: CompanySettings;
  setCompanySettings: (v: CompanySettings | ((p: CompanySettings) => CompanySettings)) => void;
  currentEmpId: string | null;
  setCurrentEmpId: (v: string | null) => void;
  authRole: 'Admin' | 'Employee' | null;
  setAuthRole: (v: 'Admin' | 'Employee' | null) => void;
  liveClockTimestamps: Record<string, number>;
  performClockIn: (empId: string, mode?: AttendanceMode) => void;
  performClockOut: (empId: string) => void;
  loading: boolean;
  apiEnabled: boolean;
  refreshAll: () => Promise<void>;
  notifications: NotificationItem[];
  notificationCount: number;
  viewedNotificationIds: Set<string>;
  markAllNotificationsViewed: () => void;
  isNotificationNew: (id: string) => boolean;
};

const DataContext = createContext<Ctx>(null!);
export const useData = () => useContext(DataContext);

export function todayStr() {
  return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const PORTAL_LAUNCH_MONTH: Readonly<{ year: number; monthIdx: number }> = {
  year: 2026,
  monthIdx: 8, // September (0-indexed)
};

export function availableMonths(count = 6): string[] {
  const out: string[] = [];
  const now = new Date();
  // Clamp start: never earlier than the Sep-2026 launch.
  const startYear = Math.max(PORTAL_LAUNCH_MONTH.year, now.getFullYear());
  const startMonthIdx = startYear === PORTAL_LAUNCH_MONTH.year
    ? Math.max(PORTAL_LAUNCH_MONTH.monthIdx, now.getMonth())
    : now.getMonth();
  for (let i = 0; i < count; i++) {
    const d = new Date(startYear, startMonthIdx + i, 1);
    out.push(d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }));
  }
  return out;
}

// Kept for backwards compatibility; alias to the new forward-looking list.
export function recentMonths(count = 6): string[] {
  return availableMonths(count);
}

export function toMins(s: string): number {
  if (!s || s === '—') return 0;
  const m = s.match(/(\d+)h\s*(\d*)m?/);
  return m ? parseInt(m[1]) * 60 + (parseInt(m[2]) || 0) : 0;
}

export function fromMins(m: number): string {
  if (m <= 0) return '—';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}

const TODAY = todayStr();

const seedEmployees: Employee[] = [
  { id: 'EMP-001', name: 'Sarah Johnson', email: 'sarah@company.com', dept: 'Engineering', designation: 'Software Engineer', role: 'Employee', status: 'Active', tempPassword: '', password: hashPw('Sarah@Sync1!'), firstLogin: false, remarks: '' },
  { id: 'EMP-002', name: 'Marco Reyes', email: 'marco@company.com', dept: 'Marketing', designation: 'Marketing Specialist', role: 'Employee', status: 'Active', tempPassword: '', password: hashPw('Marco@Sync2!'), firstLogin: false, remarks: '' },
  { id: 'EMP-003', name: 'Ana Torres', email: 'ana@company.com', dept: 'Operations', designation: 'Operations Lead', role: 'Employee', status: 'Active', tempPassword: '', password: hashPw('Ana@Sync3!'), firstLogin: false, remarks: '' },
  { id: 'EMP-004', name: 'Ben Cruz', email: 'ben@company.com', dept: 'Finance', designation: 'Finance Analyst', role: 'Employee', status: 'Inactive', tempPassword: '', password: hashPw('Ben@Sync4!'), firstLogin: false, remarks: '' },
  { id: 'EMP-005', name: 'Lea Santos', email: 'lea@company.com', dept: 'HR', designation: 'HR Manager', role: 'Admin', status: 'Active', tempPassword: '', password: hashPw('Lea@Sync5!'), firstLogin: false, remarks: '' },
];

const seedLeaves: Leave[] = [
  { id: 1, empId: 'EMP-001', name: 'Sarah Johnson', type: 'Vacation', start: 'Sep 22, 2026', end: 'Sep 23, 2026', days: 2, reason: 'Travel plans', reqDate: 'Sep 10, 2026', status: 'Pending' },
  { id: 2, empId: 'EMP-002', name: 'Marco Reyes', type: 'Sick Leave', start: 'Sep 20, 2026', end: 'Sep 20, 2026', days: 1, reason: 'Medical check', reqDate: 'Sep 14, 2026', status: 'Pending' },
  { id: 3, empId: 'EMP-001', name: 'Sarah Johnson', type: 'Sick Leave', start: 'Sep 14, 2026', end: 'Sep 14, 2026', days: 1, reason: 'Medical appointment', reqDate: 'Sep 1, 2026', status: 'Approved' },
  { id: 4, empId: 'EMP-003', name: 'Ana Torres', type: 'Vacation', start: 'Aug 25, 2026', end: 'Aug 26, 2026', days: 2, reason: 'Family trip', reqDate: 'Aug 20, 2026', status: 'Approved' },
  { id: 5, empId: 'EMP-004', name: 'Ben Cruz', type: 'Emergency', start: 'Jul 8, 2026', end: 'Jul 8, 2026', days: 1, reason: 'Personal emergency', reqDate: 'Jul 5, 2026', status: 'Rejected' },
  { id: 6, empId: 'EMP-005', name: 'Lea Santos', type: 'Vacation', start: TODAY, end: TODAY, days: 1, reason: 'Personal day', reqDate: 'Sep 15, 2026', status: 'Approved' },
];

const seedFieldWork: FieldWorkEntry[] = [
  { id: 1, empId: 'EMP-003', name: 'Ana Torres', date: TODAY, location: 'Warehouse B — Pasay', start: '08:00 AM', end: '04:00 PM', hours: '8h', desc: 'Inventory check', status: 'Pending' },
  { id: 2, empId: 'EMP-001', name: 'Sarah Johnson', date: 'Sep 11, 2026', location: 'Client Site A — Makati', start: '09:00 AM', end: '05:00 PM', hours: '8h', desc: 'System installation', status: 'Approved' },
  { id: 3, empId: 'EMP-002', name: 'Marco Reyes', date: 'Sep 9, 2026', location: 'Partner Office — BGC', start: '09:00 AM', end: '01:00 PM', hours: '4h', desc: 'Client meeting', status: 'Approved' },
  { id: 4, empId: 'EMP-003', name: 'Ana Torres', date: 'Sep 4, 2026', location: 'Client Site B — QC', start: '10:00 AM', end: '03:00 PM', hours: '5h', desc: 'Site survey', status: 'Rejected' },
];

const seedAttendance: AttendanceRecord[] = [
  { id: 1, empId: 'EMP-001', name: 'Sarah Johnson', dept: 'Engineering', date: 'Sep 18, 2026', clockIn: '08:55 AM', clockOut: '06:00 PM', officeHours: '9h 5m', fieldHours: '—', status: 'Present', mode: 'Office' },
  { id: 2, empId: 'EMP-002', name: 'Marco Reyes', dept: 'Marketing', date: 'Sep 18, 2026', clockIn: '09:20 AM', clockOut: '06:00 PM', officeHours: '8h 40m', fieldHours: '—', status: 'Late', mode: 'Office' },
  { id: 3, empId: 'EMP-003', name: 'Ana Torres', dept: 'Operations', date: 'Sep 18, 2026', clockIn: '09:00 AM', clockOut: '06:00 PM', officeHours: '9h', fieldHours: '—', status: 'Present', mode: 'Office' },
  { id: 4, empId: 'EMP-001', name: 'Sarah Johnson', dept: 'Engineering', date: 'Sep 17, 2026', clockIn: '09:02 AM', clockOut: '06:00 PM', officeHours: '8h 58m', fieldHours: '—', status: 'Present', mode: 'Office' },
  { id: 5, empId: 'EMP-001', name: 'Sarah Johnson', dept: 'Engineering', date: 'Sep 16, 2026', clockIn: '—', clockOut: '—', officeHours: '—', fieldHours: '—', status: 'Leave', mode: 'Office' },
  { id: 6, empId: 'EMP-001', name: 'Sarah Johnson', dept: 'Engineering', date: 'Sep 11, 2026', clockIn: '—', clockOut: '—', officeHours: '—', fieldHours: '8h', status: 'Field Work', mode: 'Office' },
];

const defaultSettings: CompanySettings = {
  companyName: 'StaffSync',
  companyEmail: 'hr@attendtrack.com',
  companyAddress: '123 Business Ave, Makati City',
  workStartTime: '09:00',
  workEndTime: '18:00',
  leaveAllowance: 14,
  workWeek: 'Monday – Friday',
  lateBuffer: 15,
  overtimeBuffer: 30,
  customDepartments: [],
};

export const CORE_DEPARTMENTS = [
  'Engineering',
  'Marketing',
  'Sales',
  'Human Resources',
  'Finance',
  'Operations',
  'Customer Support',
  'Information Technology',
  'Legal',
  'Product',
  'Design',
  'Administration',
];

export function departmentList(custom: string[] = [], employees: { dept: string }[] = []): string[] {
  const set = new Set<string>();
  for (const d of CORE_DEPARTMENTS) set.add(d);
  for (const d of (custom || [])) {
    const v = (d || '').trim();
    if (v) set.add(v);
  }
  for (const e of (employees || [])) {
    const v = (e.dept || '').trim();
    if (v) set.add(v);
  }
  return [...set];
}

export async function saveCustomDepartment(department: string, currentCustom: string[] = []): Promise<string[] | null> {
  const name = (department || '').trim();
  if (!name) return null;
  if (CORE_DEPARTMENTS.includes(name)) return currentCustom;
  if ((currentCustom || []).includes(name)) return currentCustom;
  const next = [...(currentCustom || []), name];
  const r = await api.updateSettings({ customDepartments: next });
  if (!r.ok) return null;
  // After a successful PUT, re-read the canonical persisted doc so the write actually went through the DB
  const fresh = await api.getSettings();
  if (fresh.ok && fresh.data && Array.isArray(fresh.data.customDepartments)) {
    return fresh.data.customDepartments;
  }
  return next;
}

const lsKey = (empId: string) => `ss_clock|${empId}|${todayStr()}`;

function deriveNotifications(
  role: 'Admin' | 'Employee' | null,
  empId: string | null,
  leaves: Leave[],
  fieldWork: FieldWorkEntry[],
): NotificationItem[] {
  const items: NotificationItem[] = [];

  if (role === 'Admin') {
    for (const l of leaves) {
      if (l.status !== 'Pending') continue;
      items.push({
        id: `lv-${l.id}`,
        kind: 'leave_pending',
        title: `Leave Request · ${l.type}`,
        subtitle: `${l.name} · ${l.days} day${l.days === 1 ? '' : 's'} · ${l.start}${l.start !== l.end ? ' – ' + l.end : ''}`,
        status: 'Pending',
        date: l.reqDate,
        entityId: l.id,
        empId: l.empId,
        empName: l.name,
      });
    }
    for (const f of fieldWork) {
      if (f.status !== 'Pending') continue;
      items.push({
        id: `fw-${f.id}`,
        kind: 'fieldwork_pending',
        title: `Field Work · On-site visit`,
        subtitle: `${f.name} · ${f.location} · ${f.hours}`,
        status: 'Pending',
        date: f.date,
        entityId: f.id,
        empId: f.empId,
        empName: f.name,
      });
    }
    items.sort((a, b) => (a.date < b.date ? 1 : -1));
    return items;
  }

  if (role === 'Employee' && empId) {
    for (const l of leaves) {
      if (l.empId !== empId) continue;
      if (l.status === 'Pending') continue;
      items.push({
        id: `lv-${l.id}`,
        kind: 'leave_decision',
        title: `Leave Update: ${l.status}`,
        subtitle: `${l.type} · ${l.start}${l.start !== l.end ? ' – ' + l.end : ''} (${l.days} day${l.days === 1 ? '' : 's'})`,
        status: l.status as any,
        date: l.reqDate,
        entityId: l.id,
        empId: l.empId,
        empName: l.name,
      });
    }
    for (const f of fieldWork) {
      if (f.empId !== empId) continue;
      if (f.status === 'Pending') continue;
      items.push({
        id: `fw-${f.id}`,
        kind: 'fieldwork_decision',
        title: `Field Work: ${f.status}`,
        subtitle: `${f.location} · ${f.date} · ${f.hours}`,
        status: f.status as any,
        date: f.date,
        entityId: f.id,
        empId: f.empId,
        empName: f.name,
      });
    }
    items.sort((a, b) => (a.date < b.date ? 1 : -1));
    return items;
  }

  return items;
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [fieldWork, setFieldWork] = useState<FieldWorkEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [todayClockIn, setTodayClockIn] = useState<Date | null>(null);
  const [todayClockOut, setTodayClockOut] = useState<Date | null>(null);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(defaultSettings);
  const [currentEmpId, setCurrentEmpId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiEnabled, setApiEnabled] = useState(false);

  const [liveClockTimestamps, setLiveClockTimestamps] = useState<Record<string, number>>(() => {
    const result: Record<string, number> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith('ss_clock|')) continue;
      const parts = key.slice('ss_clock|'.length).split('|');
      if (parts[1] !== todayStr()) continue;
      try {
        const val = JSON.parse(localStorage.getItem(key)!);
        if (val.clockIn && !val.clockOut) result[parts[0]] = new Date(val.clockIn).getTime();
      } catch { /* ignore */ }
    }
    return result;
  });

  const employeesRef = useRef(employees);
  employeesRef.current = employees;

  const currentEmp = employees.find(e => e.id === currentEmpId) || null;
  const [authRole, setAuthRole] = useState<'Admin' | 'Employee' | null>(null);
  const currentRole: 'Admin' | 'Employee' | null =
    authRole || (currentEmp?.role as 'Admin' | 'Employee' | undefined) || null;

  const notifications = deriveNotifications(currentRole, currentEmpId, leaves, fieldWork);

  const viewedStorageKey = currentEmpId ? `ss_viewed_notifs|${currentEmpId}` : null;
  const [viewedNotificationIds, setViewedNotificationIds] = useState<Set<string>>(() => {
    try {
      const raw = viewedStorageKey ? localStorage.getItem(viewedStorageKey) : null;
      return raw ? new Set<string>(JSON.parse(raw)) : new Set<string>();
    } catch { return new Set<string>(); }
  });

  useEffect(() => {
    try {
      if (!viewedStorageKey) {
        setViewedNotificationIds(new Set<string>());
        return;
      }
      const raw = localStorage.getItem(viewedStorageKey);
      setViewedNotificationIds(raw ? new Set<string>(JSON.parse(raw)) : new Set<string>());
    } catch {
      setViewedNotificationIds(new Set<string>());
    }
  }, [viewedStorageKey]);

  const markAllNotificationsViewed = useCallback(() => {
    if (!viewedStorageKey) return;
    const ids = new Set<string>(notifications.map(n => n.id));
    setViewedNotificationIds(ids);
    try { localStorage.setItem(viewedStorageKey, JSON.stringify([...ids])); } catch {}
  }, [viewedStorageKey, notifications]);

  const isNotificationNew = useCallback((id: string) => !viewedNotificationIds.has(id), [viewedNotificationIds]);

  const notificationCount = notifications.filter(n => isNotificationNew(n.id)).length;

  // —— Name/Dept enricher: all entity rows come back with empId from DB; to avoid storing denormalized
  //    stale names in MongoDB after an employee edit, we ALWAYS look up the canonical name/dept from
  //    the employees list on every context load / poll. Falls back to whatever the doc had (old empId).
  function enrichRow<T extends { empId: string; name?: string; dept?: string }>(
    row: T,
    employeesList: Employee[]
  ): T {
    const emp = employeesList.find(e => e.id === row.empId);
    if (!emp) return row;
    return { ...row, name: emp.name, dept: emp.dept };
  }

  const refreshAll = async () => {
    try {
      const results = await Promise.allSettled([
        api.getEmployees(),
        api.getLeaves(),
        api.getFieldWork(),
        api.getAttendance(),
        api.getSettings(),
      ]);

      const [empRes, leaveRes, fwRes, attRes, setRes] = results;

      let employeesList: Employee[] = [];
      if (empRes.status === 'fulfilled' && empRes.value.ok && Array.isArray(empRes.value.data)) {
        setApiEnabled(true);
        employeesList = empRes.value.data.map((e: any) => ({
          ...e,
          password: e.password || '',
          tempPassword: e.tempPassword || '',
        }));
        setEmployees(employeesList);
      }
      if (leaveRes.status === 'fulfilled' && leaveRes.value.ok && Array.isArray(leaveRes.value.data)) {
        const mapped: Leave[] = leaveRes.value.data.map((l: any) =>
          enrichRow({ ...l, id: l.leaveId ?? l.id } as any, employeesList));
        setLeaves(mapped);
      }
      if (fwRes.status === 'fulfilled' && fwRes.value.ok && Array.isArray(fwRes.value.data)) {
        const mapped: FieldWorkEntry[] = fwRes.value.data.map((f: any) =>
          enrichRow({ ...f, id: f.fwId ?? f.id } as any, employeesList));
        setFieldWork(mapped);
      }
      if (attRes.status === 'fulfilled' && attRes.value.ok && Array.isArray(attRes.value.data)) {
        const mapped: AttendanceRecord[] = attRes.value.data.map((a: any) =>
          enrichRow({ ...a, id: a.attId ?? a.id, mode: a.mode === 'WFH' ? 'WFH' : 'Office' } as any, employeesList));
        setAttendance(mapped);
      }
      if (setRes.status === 'fulfilled' && setRes.value.ok && setRes.value.data) {
        const { _id, __v, createdAt, updatedAt, ...rest } = setRes.value.data;
        setCompanySettings(rest as CompanySettings);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAll().then(() => {
      const token = api.getToken();
      if (token) {
        try {
          const parts = token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            if (payload.empId) setCurrentEmpId(payload.empId);
          }
        } catch { /* ignore */ }
      }
    });
  }, []);

  // ── Polling: refresh leave + field work + employees + attendance + settings every 15s so notification counts + stats update live ──
  useEffect(() => {
    if (!currentEmpId) return;
    const poll = async () => {
      try {
        const [lv, fw, emp, att, setg] = await Promise.allSettled([
          api.getLeaves(),
          api.getFieldWork(),
          api.getEmployees(),
          api.getAttendance(),
          api.getSettings(),
        ]);

        let latestEmployees: Employee[] = employees;
        if (emp.status === 'fulfilled' && emp.value.ok && Array.isArray(emp.value.data)) {
          latestEmployees = emp.value.data.map((e: any) => ({
            ...e,
            password: e.password || '',
            tempPassword: e.tempPassword || '',
          }));
          setEmployees(latestEmployees);
        }
        if (lv.status === 'fulfilled' && lv.value.ok && Array.isArray(lv.value.data)) {
          setLeaves(lv.value.data.map((l: any) =>
            enrichRow({ ...l, id: l.leaveId ?? l.id } as any, latestEmployees)));
        }
        if (fw.status === 'fulfilled' && fw.value.ok && Array.isArray(fw.value.data)) {
          setFieldWork(fw.value.data.map((f: any) =>
            enrichRow({ ...f, id: f.fwId ?? f.id } as any, latestEmployees)));
        }
        if (att.status === 'fulfilled' && att.value.ok && Array.isArray(att.value.data)) {
          setAttendance(att.value.data.map((a: any) =>
            enrichRow({ ...a, id: a.attId ?? a.id } as any, latestEmployees)));
        }
        if (setg.status === 'fulfilled' && setg.value.ok && setg.value.data) {
          const { _id, __v, createdAt, updatedAt, ...rest } = setg.value.data;
          setCompanySettings(prev => ({ ...prev, ...rest } as CompanySettings));
        }
      } catch { /* silent */ }
    };
    const id = setInterval(poll, 15000);
    poll();
    return () => clearInterval(id);
  }, [currentEmpId, employees]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (!e.key?.startsWith('ss_clock|') || !e.newValue) return;
      const parts = e.key.slice('ss_clock|'.length).split('|');
      const empId = parts[0];
      const date = parts[1];
      if (date !== todayStr()) return;

      try {
        const val = JSON.parse(e.newValue);
        const TODAY = todayStr();

        if (val.clockIn && !val.clockOut) {
          const ts = new Date(val.clockIn).getTime();
          const clockInStr = new Date(val.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const status = computeAttendanceStatus(companySettings, clockInStr, null, 'Present');
          setLiveClockTimestamps(prev => ({ ...prev, [empId]: ts }));
          setAttendance(prev => {
            if (prev.some(a => a.empId === empId && a.date === TODAY)) {
              return prev.map(a => a.empId === empId && a.date === TODAY
                ? { ...a, clockIn: clockInStr, status } : a);
            }
            const emp = employeesRef.current.find(e => e.id === empId);
            return [{ id: Date.now(), empId, name: emp?.name ?? empId, dept: emp?.dept ?? '—',
              date: TODAY, clockIn: clockInStr, clockOut: '—', officeHours: '—', fieldHours: '—', status }, ...prev];
          });
        } else if (val.clockIn && val.clockOut) {
          setLiveClockTimestamps(prev => { const n = { ...prev }; delete n[empId]; return n; });
          const mins = Math.round((new Date(val.clockOut).getTime() - new Date(val.clockIn).getTime()) / 60000);
          const hoursStr = formatHoursMinutes(mins);
          const clockInStr = new Date(val.clockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          const clockOutStr = new Date(val.clockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          setAttendance(prev => prev.map(a => {
            if (!(a.empId === empId && a.date === TODAY)) return a;
            const status = computeAttendanceStatus(companySettings, clockInStr, clockOutStr, a.status);
            return { ...a, clockIn: clockInStr, clockOut: clockOutStr, officeHours: hoursStr, status };
          }));
        }
      } catch { /* ignore malformed */ }
    }

    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [companySettings]);

  useEffect(() => {
    if (!currentEmpId) { setTodayClockIn(null); setTodayClockOut(null); return; }
    const saved = localStorage.getItem(lsKey(currentEmpId));
    if (saved) {
      const val = JSON.parse(saved);
      const ci = val.clockIn ? new Date(val.clockIn) : null;
      const co = val.clockOut ? new Date(val.clockOut) : null;
      setTodayClockIn(ci);
      setTodayClockOut(co);
      if (ci && !co) setLiveClockTimestamps(prev => ({ ...prev, [currentEmpId]: ci.getTime() }));
    } else {
      setTodayClockIn(null);
      setTodayClockOut(null);
    }
  }, [currentEmpId]);

  function performClockIn(empId: string, mode: AttendanceMode = 'Office') {
    const now = new Date();
    const emp = employeesRef.current.find(e => e.id === empId);
    if (!emp) return;
    const saveMode: AttendanceMode = mode === 'WFH' ? 'WFH' : 'Office';

    setTodayClockIn(now);
    setLiveClockTimestamps(prev => ({ ...prev, [empId]: now.getTime() }));
    localStorage.setItem(lsKey(empId), JSON.stringify({ clockIn: now.toISOString(), clockOut: null, mode: saveMode }));

    const clockInStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const status = computeAttendanceStatus(companySettings, clockInStr, null, 'Present');
    const TODAY = todayStr();
    setAttendance(prev => {
      if (prev.some(a => a.empId === empId && a.date === TODAY)) {
        return prev.map(a => a.empId === empId && a.date === TODAY ? { ...a, clockIn: clockInStr, status, mode: saveMode } : a);
      }
      return [{ id: Date.now(), empId, name: emp.name, dept: emp.dept, date: TODAY, clockIn: clockInStr, clockOut: '—', officeHours: '—', fieldHours: '—', status, mode: saveMode }, ...prev];
    });

    api.clockIn(empId, saveMode).catch(() => {});
  }

  function performClockOut(empId: string) {
    const now = new Date();
    const ts = liveClockTimestamps[empId];
    setTodayClockOut(now);
    setLiveClockTimestamps(prev => { const n = { ...prev }; delete n[empId]; return n; });

    const existing = JSON.parse(localStorage.getItem(lsKey(empId)) || '{}');
    localStorage.setItem(lsKey(empId), JSON.stringify({ ...existing, clockOut: now.toISOString() }));

    const clockInTime = ts ? new Date(ts) : now;
    const mins = Math.round((now.getTime() - clockInTime.getTime()) / 60000);
    const hoursStr = formatHoursMinutes(mins);
    const clockOutStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const TODAY = todayStr();
    setAttendance(prev => prev.map(a => {
      if (!(a.empId === empId && a.date === TODAY)) return a;
      const status = computeAttendanceStatus(companySettings, a.clockIn, clockOutStr, a.status);
      return { ...a, clockOut: clockOutStr, officeHours: hoursStr, status };
    }));

    api.clockOut(empId, clockInTime.toISOString()).catch(() => {});
  }

  return (
    <DataContext.Provider value={{
      employees, setEmployees,
      leaves, setLeaves,
      fieldWork, setFieldWork,
      attendance, setAttendance,
      todayClockIn, todayClockOut,
      companySettings, setCompanySettings,
      currentEmpId, setCurrentEmpId,
      authRole, setAuthRole,
      liveClockTimestamps,
      performClockIn, performClockOut,
      loading, apiEnabled, refreshAll,
      notifications, notificationCount,
      viewedNotificationIds, markAllNotificationsViewed, isNotificationNew,
    }}>
      {children}
    </DataContext.Provider>
  );
}
