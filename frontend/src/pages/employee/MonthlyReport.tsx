import { useState, useMemo } from 'react';
import { useData, recentMonths, fromMins, toMins } from '../../context/DataContext';
import { Card, StatCard, Badge, Table, TR, TD, Select, Btn } from '../../components/ui';

function rowMonthYear(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(String(dateStr).replace(/,\s*(\d{4})$/, ', $1 00:00:00'));
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}
function leaveRowInMonth(l: { start: string; end: string }, m: string): boolean {
  return rowMonthYear(l.start) === m || rowMonthYear(l.end) === m;
}

export default function MonthlyReport({ empId }: { empId: string }) {
  const { attendance, fieldWork, leaves, companySettings } = useData();
  const months = recentMonths(6);
  const [month, setMonth] = useState(months[0]);

  const myAttendance = attendance.filter(a => a.empId === empId);
  const myApprovedFW = fieldWork.filter(f => f.empId === empId && f.status === 'Approved');
  const myApprovedLeaves = leaves.filter(l => l.empId === empId && l.status === 'Approved');

  const filteredAttendance = useMemo(() => myAttendance.filter(a => rowMonthYear(a.date) === month), [myAttendance, month]);
  const filteredFW = useMemo(() => myApprovedFW.filter(f => rowMonthYear(f.date) === month), [myApprovedFW, month]);
  const filteredLeaves = useMemo(() => myApprovedLeaves.filter(l => leaveRowInMonth(l, month)), [myApprovedLeaves, month]);

  const present = filteredAttendance.filter(a => a.status === 'Present' || a.status === 'Late' || a.status === 'Overtime').length;
  const absent = filteredAttendance.filter(a => a.status === 'Absent').length;
  const late = filteredAttendance.filter(a => a.status === 'Late').length;
  const leaveDays = filteredLeaves.reduce((s, l) => s + l.days, 0);

  const officeMins = filteredAttendance.reduce((s, a) => s + toMins(a.officeHours), 0);
  const fieldMins = filteredFW.reduce((s, f) => s + toMins(f.hours), 0);
  const totalMins = officeMins + fieldMins;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-48">
          <Select label="" value={month} onChange={e => setMonth(e.target.value)}>
            {months.map(m => <option key={m}>{m}</option>)}
          </Select>
        </div>
        <Btn variant="secondary">Generate Report</Btn>
        <Btn variant="secondary">⬇ Download</Btn>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Days Present" value={present} color="green" />
        <StatCard label="Days Absent" value={absent} color="red" />
        <StatCard label="Late Days" value={late} color="yellow" />
        <StatCard label="Leaves Taken" value={leaveDays} sub={`of ${companySettings.leaveAllowance} allowed`} color="purple" />
      </div>

      {/* Hours breakdown */}
      <Card className="p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">Hours Summary</p>
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-800">{fromMins(officeMins)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Office Hours</p>
          </div>
          <div className="text-slate-300 text-2xl">+</div>
          <div className="text-center">
            <p className="text-2xl font-bold text-blue-600">{fromMins(fieldMins)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Approved Field Work</p>
          </div>
          <div className="text-slate-300 text-2xl">=</div>
          <div className="text-center">
            <p className="text-2xl font-bold text-green-600">{fromMins(totalMins)}</p>
            <p className="text-xs text-slate-500 mt-0.5">Total Worked Hours</p>
          </div>
        </div>
      </Card>

      {/* Daily breakdown */}
      <Card>
        <div className="p-5 pb-3">
          <p className="font-semibold text-slate-800">Daily Breakdown — {month}</p>
        </div>
        {filteredAttendance.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No records for {month}.</p>
        ) : (
          <Table headers={['Date', 'Status', 'Clock In', 'Clock Out', 'Office Hrs', 'Field Hrs', 'Total Hrs']}>
            {filteredAttendance.map(r => {
              const fw = filteredFW.find(f => f.date === r.date);
              const rowMins = toMins(r.officeHours) + (fw ? toMins(fw.hours) : 0);
              return (
                <TR key={r.id}>
                  <TD className="font-medium">{r.date}</TD>
                  <TD><Badge status={r.status} /></TD>
                  <TD>{r.clockIn}</TD>
                  <TD>{r.clockOut}</TD>
                  <TD>{r.officeHours}</TD>
                  <TD className="text-blue-600">{fw ? fw.hours : '—'}</TD>
                  <TD className="font-medium">{fromMins(rowMins)}</TD>
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
