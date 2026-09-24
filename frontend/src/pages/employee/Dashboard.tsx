import { useData, fromMins, toMins, computeAttendanceStatus, formatHoursMinutes, AttendanceMode } from '../../context/DataContext';
import { StatCard, Card, Badge, SectionHeader, Table, TR, TD, Btn } from '../../components/ui';
import { useState } from 'react';

function fmt(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function duration(a: Date, b: Date) {
  const mins = Math.round((b.getTime() - a.getTime()) / 60000);
  return formatHoursMinutes(mins);
}

export default function EmployeeDashboard({ empId }: { empId: string }) {
  const { employees, leaves, fieldWork, attendance, todayClockIn, todayClockOut, companySettings, performClockIn, performClockOut, currentEmpId } = useData();

  const emp = employees.find(e => e.id === empId);
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Restore saved mode from localStorage (same key used by DataContext)
  const todayDateStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const lsSaved = (() => {
    try {
      if (!empId) return null;
      const k = `ss_clock|${empId}|${todayDateStr}`;
      const raw = localStorage.getItem(k);
      if (!raw) return null;
      const v = JSON.parse(raw);
      return (v && v.mode) || null;
    } catch { return null; }
  })();
  const todayAttendance = attendance.find(a => a.empId === empId && a.date === todayDateStr);
  const initialMode: AttendanceMode = lsSaved || (todayAttendance?.mode === 'WFH' ? 'WFH' : 'Office');
  const [modeSel, setModeSel] = useState<AttendanceMode>(initialMode);

  // Always keep selector state aligned with today's saved record once it exists.
  // When no record exists yet, let the user's selector choice win.
  const activeTodayMode: AttendanceMode =
    todayAttendance?.mode === 'WFH' ? 'WFH' :
    todayAttendance?.mode === 'Office' ? 'Office' :
    lsSaved || modeSel;

  const todayModeDisplay: AttendanceMode = activeTodayMode;

  const myLeaves = leaves.filter(l => l.empId === empId);
  const approvedLeaveDays = myLeaves.filter(l => l.status === 'Approved').reduce((s, l) => s + l.days, 0);
  const pendingLeaves = myLeaves.filter(l => l.status === 'Pending').length;
  const remaining = Math.max(0, companySettings.leaveAllowance - approvedLeaveDays);

  const myApprovedFW = fieldWork.filter(f => f.empId === empId && f.status === 'Approved');
  const fieldMins = myApprovedFW.reduce((s, f) => s + toMins(f.hours), 0);

  const myAttendance = attendance.filter(a => a.empId === empId);
  const officeMins = myAttendance.reduce((s, a) => s + toMins(a.officeHours), 0);

  const recentAttendance = myAttendance.slice(0, 5).map(r => ({
    ...r,
    status: computeAttendanceStatus(companySettings, r.clockIn, r.clockOut, r.status),
  }));
  const todayClockInStr = todayClockIn ? fmt(todayClockIn) : '—';
  const todayClockOutStr = todayClockOut ? fmt(todayClockOut) : '—';
  const todayStatus = computeAttendanceStatus(companySettings, todayClockInStr, todayClockOutStr, todayClockIn ? 'Present' : 'Absent');

  if (!emp) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Good morning, {emp.name.split(' ')[0]}! 👋</h2>
          <p className="text-slate-500 text-sm mt-0.5">{dateStr}</p>
        </div>
        <Badge status={todayStatus} />
      </div>

      {/* Clock in/out */}
      <Card className="p-5">
        <div className="grid grid-cols-4 divide-x divide-slate-100">
          <div className="pr-5">
            <p className="text-xs text-slate-500 mb-1">Today's Clock In</p>
            <p className="text-lg font-bold text-slate-800">{todayClockIn ? fmt(todayClockIn) : '—'}</p>
          </div>
          <div className="px-5">
            <p className="text-xs text-slate-500 mb-1">Today's Clock Out</p>
            <p className="text-lg font-bold text-slate-800">{todayClockOut ? fmt(todayClockOut) : '—'}</p>
          </div>
          <div className="px-5">
            <p className="text-xs text-slate-500 mb-1">Office Hours Today</p>
            <p className="text-lg font-bold text-slate-800">
              {todayClockIn && todayClockOut ? duration(todayClockIn, todayClockOut) : todayClockIn ? 'In progress…' : '—'}
            </p>
          </div>
          <div className="pl-5">
            <p className="text-xs text-slate-500 mb-1">Today's Mode</p>
            <p className="text-lg font-bold text-slate-800">{todayModeDisplay}</p>
          </div>
        </div>
        <div className="flex gap-3 mt-5 items-center">
          <Btn
            onClick={() => { if (!todayClockIn) performClockIn(empId, modeSel); }}
            variant={todayClockIn ? 'secondary' : 'primary'}
            className="flex-1 justify-center py-2.5"
          >
            {todayClockIn ? `✓ Clocked In at ${fmt(todayClockIn)}` : '⏺ Clock In'}
          </Btn>
          <Btn
            onClick={() => { if (todayClockIn && !todayClockOut) performClockOut(empId); }}
            variant={todayClockOut ? 'secondary' : todayClockIn ? 'danger' : 'secondary'}
            className="flex-1 justify-center py-2.5"
          >
            {todayClockOut ? `✓ Clocked Out at ${fmt(todayClockOut)}` : '⏹ Clock Out'}
          </Btn>
          <div className="inline-flex rounded-lg border border-slate-300 p-1 bg-white shadow-sm shrink-0 z-10">
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setModeSel('Office'); }}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors cursor-pointer select-none ${
                modeSel === 'Office'
                  ? 'bg-slate-900 text-white shadow'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              Office
            </button>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setModeSel('WFH'); }}
              className={`px-4 py-2 rounded-md text-sm font-semibold transition-colors cursor-pointer select-none ${
                modeSel === 'WFH'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-600 hover:bg-indigo-50 hover:text-indigo-700'
              }`}
            >
              Work From Home
            </button>
          </div>
        </div>
        {!todayClockIn && (
          <p className="text-xs text-slate-400 text-center mt-3">Click Clock In to start tracking your office hours</p>
        )}
      </Card>

      {/* Live stats */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Office Hours (Month)" value={fromMins(officeMins)} sub={`+${fromMins(fieldMins)} field work`} color="blue" />
        <StatCard label="Pending Leaves" value={pendingLeaves} sub="Awaiting approval" color="yellow" />
        <StatCard label="Approved Leaves" value={approvedLeaveDays} sub={`day${approvedLeaveDays !== 1 ? 's' : ''} used`} color="green" />
        <StatCard label="Remaining Leaves" value={remaining} sub={`of ${companySettings.leaveAllowance} annual days`} color="slate" />
      </div>

      {/* Recent attendance */}
      <Card>
        <div className="p-5 pb-3">
          <SectionHeader title="Recent Attendance" />
        </div>
        {recentAttendance.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No attendance records yet.</p>
        ) : (
          <Table headers={['Date', 'Clock In', 'Clock Out', 'Mode', 'Hours', 'Status']}>
            {recentAttendance.map(r => (
              <TR key={r.id}>
                <TD>{r.date}</TD>
                <TD>{r.clockIn}</TD>
                <TD>{r.clockOut}</TD>
                <TD><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.mode === 'WFH' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>{r.mode}</span></TD>
                <TD className="font-medium">{r.officeHours}</TD>
                <TD><Badge status={r.status} /></TD>
              </TR>
            ))}
          </Table>
        )}
        <div className="p-4" />
      </Card>
    </div>
  );
}
