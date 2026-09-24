import { useState, useEffect } from 'react';
import { useData, todayStr, computeAttendanceStatus, formatHoursMinutes } from '../../context/DataContext';
import { api } from '../../utils/api';
import { StatCard, Card, Badge, Table, TR, TD, Btn, SectionHeader, Modal, EmployeeCell } from '../../components/ui';

export default function AdminDashboard() {
  const { employees, leaves, fieldWork, attendance, setLeaves, setFieldWork, liveClockTimestamps, companySettings, refreshAll } = useData();
  const [modal, setModal] = useState<{ type: 'approve' | 'reject'; entity: 'leave' | 'fw'; id: number; leaveId?: number; fwId?: number; name: string; label: string } | null>(null);
  const [savingAction, setSavingAction] = useState<{ entity: 'leave' | 'fw'; id: number } | null>(null);
  const [, setTick] = useState(0); // forces re-render every minute for live hours

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 10000);
    return () => clearInterval(id);
  }, []);

  const TODAY = todayStr();
  const activeEmployees = employees.filter(e => e.status === 'Active');
  const now = new Date();

  // Parse "08:00 AM" / "04:00 PM" into a Date for today
  function parseTime(t: string): Date | null {
    const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (!m) return null;
    let h = parseInt(m[1]);
    const min = parseInt(m[2]);
    const meridiem = m[3].toUpperCase();
    if (meridiem === 'PM' && h !== 12) h += 12;
    if (meridiem === 'AM' && h === 12) h = 0;
    const d = new Date();
    d.setHours(h, min, 0, 0);
    return d;
  }

  // Approved field work today where current time falls within start–end window
  const fieldWorkersToday = fieldWork.filter(f => {
    if (f.date !== TODAY || f.status !== 'Approved') return false;
    const start = parseTime(f.start);
    const end = parseTime(f.end);
    if (!start || !end) return true; // if unparseable, include them
    return now >= start && now <= end;
  });

  const onLeaveToday = leaves.filter(l =>
    l.status === 'Approved' && (l.start === TODAY || l.end === TODAY)
  );

  const onLeaveIds = new Set(onLeaveToday.map(l => l.empId));

  // Present = attendance records for today + live clock-in sessions + approved field workers in window
  // liveClockTimestamps is the source of truth for in-progress sessions; attendance records persist after logout
  const todayClockedIn = new Set([
    ...attendance.filter(a => a.date === TODAY && a.clockIn !== '—').map(a => a.empId),
    ...Object.keys(liveClockTimestamps), // anyone actively clocked in right now
  ]);
  const presentIds = new Set([...todayClockedIn, ...fieldWorkersToday.map(f => f.empId)]);
  const absentCount = activeEmployees.filter(e => !presentIds.has(e.id)).length;

  // Total working hours for the month = Mon–Fri days elapsed × hours per workday (from settings)
  const [startH, startM] = companySettings.workStartTime.split(':').map(Number);
  const [endH, endM] = companySettings.workEndTime.split(':').map(Number);
  const workHoursPerDay = (endH * 60 + endM - (startH * 60 + startM)) / 60;

  let workDaysElapsed = 0;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  for (let d = new Date(monthStart); d <= now; d.setDate(d.getDate() + 1)) {
    const day = d.getDay(); // 0=Sun,6=Sat
    if (day !== 0 && day !== 6) workDaysElapsed++;
  }
  const totalHrs = `${Math.round(workDaysElapsed * workHoursPerDay)}h`;

  const pendingLeaves = leaves.filter(l => l.status === 'Pending');
  const pendingFieldWork = fieldWork.filter(f => f.status === 'Pending');

  // Build today's rows: attendance records + any live sessions not yet in attendance + field + leave
  const todayAttendanceRows = attendance.filter(a => a.date === TODAY && a.clockIn !== '—');
  const shownEmpIds = new Set(todayAttendanceRows.map(r => r.empId));

  // Live clock-in sessions that haven't yet produced an attendance record (edge case)
  const liveOnlyRows = Object.entries(liveClockTimestamps)
    .filter(([empId]) => !shownEmpIds.has(empId))
    .map(([empId, ts]) => {
      const emp = employees.find(e => e.id === empId);
      const mins = Math.floor((Date.now() - ts) / 60000);
      const clockInStr = new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const status = computeAttendanceStatus(companySettings, clockInStr, null, 'Present');
      try {
        const k = `ss_clock|${empId}|${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        const raw = localStorage.getItem(k);
        let rowMode: 'Office' | 'WFH' = 'Office';
        if (raw) {
          const v = JSON.parse(raw);
          if (v && v.mode === 'WFH') rowMode = 'WFH';
        }
        return {
          empId, name: emp?.name ?? empId, dept: emp?.dept ?? '—',
          clockIn: clockInStr,
          clockOut: '—',
          officeH: formatHoursMinutes(mins),
          fieldH: '—', status, mode: rowMode,
        };
      } catch {
        return {
          empId, name: emp?.name ?? empId, dept: emp?.dept ?? '—',
          clockIn: clockInStr,
          clockOut: '—',
          officeH: formatHoursMinutes(mins),
          fieldH: '—', status, mode: 'Office' as const,
        };
      }
    });

  function liveOfficeHours(empId: string, clockOut: string): string {
    if (clockOut !== '—') return ''; // completed — use stored value
    const ts = liveClockTimestamps[empId];
    if (!ts) return 'In progress';
    const mins = Math.floor((Date.now() - ts) / 60000);
    return formatHoursMinutes(mins);
  }

  const todayRows = [
    ...liveOnlyRows,
    ...todayAttendanceRows.map(r => {
      const normStatus = computeAttendanceStatus(companySettings, r.clockIn, r.clockOut, r.status);
      return {
        empId: r.empId, name: r.name, dept: r.dept,
        clockIn: r.clockIn, clockOut: r.clockOut,
        officeH: r.clockOut !== '—' ? r.officeHours : liveOfficeHours(r.empId, r.clockOut),
        fieldH: r.fieldHours, status: normStatus, mode: r.mode === 'WFH' ? 'WFH' : 'Office',
      };
    }),
    ...fieldWorkersToday.filter(f => !shownEmpIds.has(f.empId)).map(f => ({
      empId: f.empId, name: f.name,
      dept: employees.find(e => e.id === f.empId)?.dept ?? '—',
      clockIn: '—', clockOut: '—', officeH: '—', fieldH: f.hours, status: 'Field Work' as const, mode: 'Office' as const,
    })),
    ...onLeaveToday.filter(l => !shownEmpIds.has(l.empId)).map(l => ({
      empId: l.empId, name: l.name,
      dept: employees.find(e => e.id === l.empId)?.dept ?? '—',
      clockIn: '—', clockOut: '—', officeH: '—', fieldH: '—', status: 'Leave' as const, mode: 'Office' as const,
    })),
  ];

  async function handleAction() {
    if (!modal) return;
    const newStatus = modal.type === 'approve' ? 'Approved' : 'Rejected';
    setSavingAction({ entity: modal.entity, id: modal.id });
    try {
      if (modal.entity === 'leave') {
        const res = await api.updateLeave({ leaveId: modal.leaveId ?? modal.id, status: newStatus });
        if (!res.ok) {
          alert(`Failed to update leave: ${res.error || 'Please try again.'}`);
          return;
        }
        setLeaves(prev => prev.map(l => (l.id === modal.id || (l as any).leaveId === modal.leaveId)
          ? { ...l, status: newStatus }
          : l
        ));
      } else {
        const res = await api.updateFieldWork({ fwId: modal.fwId ?? modal.id, status: newStatus });
        if (!res.ok) {
          alert(`Failed to update field work: ${res.error || 'Please try again.'}`);
          return;
        }
        setFieldWork(prev => prev.map(f => (f.id === modal.id || (f as any).fwId === modal.fwId)
          ? { ...f, status: newStatus }
          : f
        ));
      }
      await refreshAll();
    } finally {
      setSavingAction(null);
      setModal(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4 lg:grid-cols-5">
        <StatCard label="Total Employees" value={activeEmployees.length} color="blue" />
        <StatCard label="Present Today" value={presentIds.size} color="green" />
        <StatCard label="Absent Today" value={absentCount} color="red" />
        <StatCard label="Field Work" value={fieldWorkersToday.length} sub="out today" color="yellow" />
        <StatCard label="Hrs This Month" value={totalHrs} color="slate" />
      </div>

      <Card>
        <div className="p-5 pb-3">
          <SectionHeader title={`Today's Attendance — ${TODAY}`} />
        </div>
        {todayRows.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No attendance recorded yet today.</p>
        ) : (
          <Table headers={['Employee', 'Department', 'Clock In', 'Clock Out', 'Mode', 'Office Hrs', 'Field Hrs', 'Status']}>
            {todayRows.map((r, i) => (
              <TR key={i}>
                <TD className="font-medium">{r.name}</TD>
                <TD>{r.dept}</TD>
                <TD>{r.clockIn}</TD>
                <TD>{r.clockOut}</TD>
                <TD><span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${r.mode === 'WFH' ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>{r.mode}</span></TD>
                <TD>{r.officeH}</TD>
                <TD>{r.fieldH}</TD>
                <TD><Badge status={r.status} /></TD>
              </TR>
            ))}
          </Table>
        )}
        <div className="p-4" />
      </Card>

      <Card>
        <div className="p-5 pb-3">
          <SectionHeader title={`Pending Leave Requests (${pendingLeaves.length})`} />
        </div>
        {pendingLeaves.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No pending leave requests.</p>
        ) : (
          <Table headers={['Employee', 'Leave Type', 'Start', 'End', 'Days', 'Status', 'Actions']}>
            {pendingLeaves.map(r => (
              <TR key={r.id}>
                <TD><EmployeeCell name={r.name} sub={r.empId} /></TD>
                <TD>{r.type}</TD>
                <TD>{r.start}</TD>
                <TD>{r.end}</TD>
                <TD>{r.days}</TD>
                <TD><Badge status={r.status} /></TD>
                <TD>
                  <div className="flex gap-2">
                    <Btn
                      size="sm"
                      variant="success"
                      loading={savingAction?.entity === 'leave' && savingAction.id === r.id}
                      onClick={() => setModal({ type: 'approve', entity: 'leave', id: r.id, leaveId: (r as any).leaveId ?? r.id, name: r.name, label: r.type })}
                    >Approve</Btn>
                    <Btn
                      size="sm"
                      variant="danger"
                      loading={savingAction?.entity === 'leave' && savingAction.id === r.id}
                      onClick={() => setModal({ type: 'reject', entity: 'leave', id: r.id, leaveId: (r as any).leaveId ?? r.id, name: r.name, label: r.type })}
                    >Reject</Btn>
                  </div>
                </TD>
              </TR>
            ))}
          </Table>
        )}
        <div className="p-4" />
      </Card>

      <Card>
        <div className="p-5 pb-3">
          <SectionHeader title={`Pending Field Work Requests (${pendingFieldWork.length})`} />
        </div>
        {pendingFieldWork.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No pending field work requests.</p>
        ) : (
          <Table headers={['Employee', 'Date', 'Location / Site', 'Hours', 'Time Window', 'Status', 'Actions']}>
            {pendingFieldWork.map(r => (
              <TR key={r.id}>
                <TD><EmployeeCell name={r.name} sub={r.empId} /></TD>
                <TD>{r.date}</TD>
                <TD className="max-w-40">{r.location}</TD>
                <TD className="font-medium">{r.hours}</TD>
                <TD className="text-slate-500">{r.start} – {r.end}</TD>
                <TD><Badge status={r.status} /></TD>
                <TD>
                  <div className="flex gap-2">
                    <Btn
                      size="sm"
                      variant="success"
                      loading={savingAction?.entity === 'fw' && savingAction.id === r.id}
                      onClick={() => setModal({ type: 'approve', entity: 'fw', id: r.id, fwId: (r as any).fwId ?? r.id, name: r.name, label: r.location })}
                    >Approve</Btn>
                    <Btn
                      size="sm"
                      variant="danger"
                      loading={savingAction?.entity === 'fw' && savingAction.id === r.id}
                      onClick={() => setModal({ type: 'reject', entity: 'fw', id: r.id, fwId: (r as any).fwId ?? r.id, name: r.name, label: r.location })}
                    >Reject</Btn>
                  </div>
                </TD>
              </TR>
            ))}
          </Table>
        )}
        <div className="p-4" />
      </Card>

      {modal && (
        <Modal
          title={modal.type === 'approve'
            ? `Approve ${modal.entity === 'leave' ? 'Leave' : 'Field Work'} Request`
            : `Reject ${modal.entity === 'leave' ? 'Leave' : 'Field Work'} Request`}
          onClose={() => setModal(null)}
        >
          <p className="text-sm text-slate-600 mb-4">
            Confirm <strong>{modal.type}</strong> for <strong>{modal.name}</strong>
            {modal.label ? ` (${modal.label})` : ''}
            {modal.entity === 'leave' ? "'s leave request?" : ' field work request?'}
          </p>
          <div className="flex gap-2">
            <Btn variant="secondary" onClick={() => setModal(null)} className="flex-1 justify-center">Cancel</Btn>
            <Btn variant={modal.type === 'approve' ? 'success' : 'danger'} onClick={handleAction} className="flex-1 justify-center capitalize">
              {modal.type}
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
