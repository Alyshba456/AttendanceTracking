import { useState, useMemo } from 'react';
import { useData, recentMonths, fromMins, toMins, computeAttendanceStatus, formatHoursMinutes } from '../../context/DataContext';
import { Card, Badge, Table, TR, TD, Select } from '../../components/ui';

function fmt(date: Date) {
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function duration(a: Date, b: Date) {
  return formatHoursMinutes(Math.round((b.getTime() - a.getTime()) / 60000));
}

function rowMonthYear(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(String(dateStr).replace(/,\s*(\d{4})$/, ', $1 00:00:00'));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export default function Attendance({ empId }: { empId: string }) {
  const { attendance, todayClockIn, todayClockOut, companySettings } = useData();
  const months = recentMonths(6);
  const [month, setMonth] = useState(months[0]);

  const myRecords = useMemo(() => attendance.filter(a => a.empId === empId).map(r => ({
    ...r,
    status: computeAttendanceStatus(companySettings, r.clockIn, r.clockOut, r.status),
  })), [attendance, empId, companySettings]);

  const filteredRecords = useMemo(() => myRecords.filter(r => rowMonthYear(r.date) === month), [myRecords, month]);
  const monthlyMins = filteredRecords.reduce((s, a) => s + toMins(a.officeHours), 0);
  const monthlyTotal = fromMins(monthlyMins);

  const todayOfficeHours = todayClockIn && todayClockOut
    ? duration(todayClockIn, todayClockOut)
    : todayClockIn ? 'In progress…' : '—';

  const todayClockInStr = todayClockIn ? fmt(todayClockIn) : '—';
  const todayClockOutStr = todayClockOut ? fmt(todayClockOut) : '—';
  const todayStatus = computeAttendanceStatus(companySettings, todayClockInStr, todayClockOutStr, todayClockIn ? 'Present' : 'Absent');

  const todayDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Today's card */}
      <Card className="p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
          Today's Attendance — {todayDate}
        </p>
        <div className="grid grid-cols-4 gap-6">
          <div>
            <p className="text-xs text-slate-500 mb-1">Clock In</p>
            <p className="font-semibold text-slate-800">{todayClockIn ? fmt(todayClockIn) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Clock Out</p>
            <p className="font-semibold text-slate-800">{todayClockOut ? fmt(todayClockOut) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Total Office Hours</p>
            <p className="font-semibold text-slate-800">{todayOfficeHours}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 mb-1">Status</p>
            <Badge status={todayStatus} />
          </div>
        </div>
      </Card>

      {/* History */}
      <Card>
        <div className="p-5 pb-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-slate-800">Attendance History</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Monthly total: <span className="font-medium text-slate-700">{monthlyTotal}</span>
            </p>
          </div>
          <div className="w-48">
            <Select label="" value={month} onChange={e => setMonth(e.target.value)}>
              {months.map(m => <option key={m}>{m}</option>)}
            </Select>
          </div>
        </div>
        {filteredRecords.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No attendance records for {month}.</p>
        ) : (
          <Table headers={['Date', 'Clock In', 'Clock Out', 'Mode', 'Total Hours', 'Status']}>
            {filteredRecords.map(r => (
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
