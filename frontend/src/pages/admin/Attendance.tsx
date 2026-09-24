import { useMemo, useState } from 'react';
import { useData, todayStr, toMins, fromMins, departmentList, computeAttendanceStatus } from '../../context/DataContext';
import { Card, Badge, StatCard, SectionHeader, Table, TR, TD, Select, DateField, Btn, EmployeeCell } from '../../components/ui';
import { parseAttendanceDate, toMinsCSV, fromMinsCSV } from '../../utils/csv';

function ymdToAttDate(ymd: string): string {
  if (!ymd) return '';
  const [y, m, d] = ymd.split('-');
  const dt = new Date(+y, +m - 1, +d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function attDateToYmd(s: string): string {
  if (!s) return '';
  const d = parseAttendanceDate(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function AdminAttendance() {
  const { attendance, employees, fieldWork, leaves, companySettings } = useData();
  const TODAY = todayStr();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const [filterEmp, setFilterEmp] = useState('all');
  const [filterDept, setFilterDept] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterMode, setFilterMode] = useState<'all' | 'Office' | 'WFH'>('all');
  const [fromYmd, setFromYmd] = useState<string>(() => attDateToYmd(monthStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })));
  const [toYmd, setToYmd] = useState<string>(() => attDateToYmd(monthEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })));

  const depts = departmentList(companySettings.customDepartments || [], employees);

  const fromAttDate = fromYmd ? ymdToAttDate(fromYmd) : null;
  const toAttDate = toYmd ? ymdToAttDate(toYmd) : null;

  // Normalize status for every row against the latest admin buffers (retroactive) —
  // Leave / Field Work / Pending statuses pass through unchanged.
  const normAttendance = useMemo(() => attendance.map(r => ({
    ...r,
    status: computeAttendanceStatus(companySettings, r.clockIn, r.clockOut, r.status),
  })), [attendance, companySettings]);

  // —— Top Stat Cards (Today view) ——
  const activeEmployees = employees.filter(e => e.status === 'Active');
  const activeEmpIds = useMemo(() => new Set(activeEmployees.map(e => e.id)), [activeEmployees]);

  const todayAtt = normAttendance.filter(a => a.date === TODAY);
  const clockedInIds = new Set(todayAtt.filter(a => a.clockIn && a.clockIn !== '—').map(a => a.empId));
  const approvedFWtoday = fieldWork.filter(f => f.date === TODAY && f.status === 'Approved');
  const fwIds = new Set(approvedFWtoday.map(f => f.empId));

  const approvedLeaves = leavesCrossingToday(
    leavesOfEmployees(activeEmployees.map(e => e.id), leaves),
    TODAY
  );
  const leaveIds = new Set(approvedLeaves.map(l => l.empId));

  const presentIds = new Set([...clockedInIds, ...fwIds].filter(id => activeEmpIds.has(id)));
  const onLeaveIds = new Set([...leaveIds].filter(id => !presentIds.has(id) && activeEmpIds.has(id)));
  const absentToday = activeEmployees.filter(e => !presentIds.has(e.id) && !onLeaveIds.has(e.id)).length;

  const monthAtt = normAttendance.filter(a => {
    const d = parseAttendanceDate(a.date);
    return d >= monthStart && d <= monthEnd && activeEmpIds.has(a.empId);
  });
  const presentCount = monthAtt.filter(a => a.status === 'Present' || a.status === 'Late' || a.status === 'Overtime').length;
  const avgAttPct = monthAtt.length > 0 ? `${Math.round((presentCount / monthAtt.length) * 100)}%` : '—';

  const inRange = (dateStr: string) => {
    const d = parseAttendanceDate(dateStr);
    if (fromAttDate) {
      const f = parseAttendanceDate(fromAttDate);
      if (d < f) return false;
    }
    if (toAttDate) {
      const t = parseAttendanceDate(toAttDate);
      t.setHours(23, 59, 59, 999);
      if (d > t) return false;
    }
    return true;
  };

  const filtered = useMemo(() => normAttendance.filter(a => {
    const emp = employees.find(e => e.id === a.empId);
    if (filterEmp !== 'all' && a.empId !== filterEmp) return false;
    if (filterDept !== 'all' && emp?.dept !== filterDept) return false;
    if (filterStatus !== 'all' && a.status.toLowerCase() !== filterStatus) return false;
    const rowMode = a.mode === 'WFH' ? 'WFH' : 'Office';
    if (filterMode !== 'all' && rowMode !== filterMode) return false;
    if (!inRange(a.date)) return false;
    return true;
  }), [normAttendance, employees, filterEmp, filterDept, filterStatus, filterMode, fromAttDate, toAttDate]);

  const thisMonth = () => {
    setFromYmd(attDateToYmd(monthStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })));
    setToYmd(attDateToYmd(monthEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })));
  };
  const lastMonth = () => {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const last = new Date(now.getFullYear(), now.getMonth(), 0);
    setFromYmd(attDateToYmd(first.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })));
    setToYmd(attDateToYmd(last.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })));
  };
  const allDates = () => { setFromYmd(''); setToYmd(''); };

  const resetFilters = () => {
    setFilterEmp('all'); setFilterDept('all'); setFilterStatus('all'); setFilterMode('all'); thisMonth();
  };

  return (
    <div className="space-y-5">
      {/* ── Top Stat Cards ── */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Present Today" value={presentIds.size} color="green" />
        <StatCard label="Absent Today" value={absentToday} color="red" />
        <StatCard label="Field Work Today" value={approvedFWtoday.length} sub="onsite" color="yellow" />
        <StatCard label="Avg. Attendance" value={avgAttPct} sub="This month" color="blue" />
      </div>

      {/* ── Separate Filters Card ── */}
      <Card>
        <div className="px-7 pt-6 pb-5">
          <div className="flex items-center justify-between mb-5">
            <SectionHeader title="Filters" />
            <p className="text-sm text-slate-500 self-end pb-0.5">{filtered.length} record{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-x-6 gap-y-5 items-end">
            <div>
              <Select label="Employee" value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
                <option value="all">All Employees</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </Select>
            </div>
            <div>
              <Select label="Department" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                <option value="all">All Departments</option>
                {depts.map(d => <option key={d}>{d}</option>)}
              </Select>
            </div>
            <div>
              <Select label="Status" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="overtime">Overtime</option>
                <option value="leave">Leave</option>
                <option value="field work">Field Work</option>
                <option value="absent">Absent</option>
              </Select>
            </div>
            <div>
              <Select label="Mode" value={filterMode} onChange={e => setFilterMode(e.target.value as any)}>
                <option value="all">All</option>
                <option value="Office">Office</option>
                <option value="WFH">Work From Home</option>
              </Select>
            </div>
            <div>
              <DateField label="From" value={fromYmd} onChange={e => setFromYmd(e.target.value)} />
            </div>
            <div>
              <DateField label="To" value={toYmd} onChange={e => setToYmd(e.target.value)} />
            </div>
          </div>
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <Btn size="sm" variant="ghost" onClick={thisMonth}>This Month</Btn>
            <Btn size="sm" variant="ghost" onClick={lastMonth}>Last Month</Btn>
            <Btn size="sm" variant="ghost" onClick={allDates}>All</Btn>
            <Btn size="sm" variant="secondary" onClick={resetFilters}>Reset</Btn>
          </div>
        </div>
      </Card>

      {/* ── Separate Daily Attendance Logs Card ── */}
      <Card>
        <div className="px-5 pt-5 pb-3">
          <SectionHeader title="Daily Attendance Logs" />
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No records match the selected filters.</p>
        ) : (
          <Table headers={['Employee', 'Date', 'Clock In', 'Clock Out', 'Mode', 'Office Hrs', 'Field Hrs', 'Total Hrs', 'Status']}>
            {filtered.map(r => {
              const emp = employees.find(e => e.id === r.empId);
              const fw = fieldWork.find(f => f.empId === r.empId && f.date === r.date && f.status === 'Approved');
              const fwHrs = fw?.hours ?? '—';
              const totalMins = toMinsCSV(r.officeHours ?? '') + toMinsCSV(fwHrs);
              const total = totalMins > 0 ? fromMinsCSV(totalMins) : '—';
              const rowMode = r.mode === 'WFH' ? 'WFH' : 'Office';
              return (
                <TR key={r.id}>
                  <TD><EmployeeCell name={r.name} sub={emp?.email ?? emp?.designation ?? ''} /></TD>
                  <TD>{r.date}</TD>
                  <TD>{r.clockIn}</TD>
                  <TD>{r.clockOut}</TD>
                  <TD><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${rowMode === 'WFH' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>{rowMode}</span></TD>
                  <TD>{r.officeHours}</TD>
                  <TD className="text-blue-600">{fwHrs}</TD>
                  <TD className="font-medium">{total}</TD>
                  <TD><Badge status={r.status} /></TD>
                </TR>
              );
            })}
          </Table>
        )}
        <div className="p-4" />
      </Card>
    </div>
  );
}

function leavesOfEmployees(empIds: string[], leaves: any[]): any[] {
  const set = new Set(empIds);
  return leaves.filter(l => set.has(l.empId) && l.status === 'Approved');
}
function leavesCrossingToday(approvedLeaves: any[], today: string): any[] {
  const t = parseAttendanceDate(today);
  return approvedLeaves.filter(l => {
    const s = parseAttendanceDate(l.start);
    const e = parseAttendanceDate(l.end);
    return t >= s && t <= e;
  });
}
