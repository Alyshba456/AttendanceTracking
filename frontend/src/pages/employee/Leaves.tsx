import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { api } from '../../utils/api';
import { Card, StatCard, Badge, Table, TR, TD, Input, Select, Textarea, Btn, Modal, SectionHeader } from '../../components/ui';

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function calcDays(start: string, end: string) {
  if (!start || !end) return 0;
  return Math.max(1, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1);
}

export default function Leaves({ empId }: { empId: string }) {
  const { employees, leaves, setLeaves, companySettings } = useData();
  const emp = employees.find(e => e.id === empId);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: '', start: '', end: '', reason: '' });
  const [error, setError] = useState('');

  const myLeaves = leaves.filter(l => l.empId === empId);
  const approvedDays = myLeaves.filter(l => l.status === 'Approved').reduce((s, l) => s + l.days, 0);
  const pendingCount = myLeaves.filter(l => l.status === 'Pending').length;
  const remaining = Math.max(0, companySettings.leaveAllowance - approvedDays);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const days = calcDays(form.start, form.end);

  async function handleSubmit() {
    if (!form.type || !form.start || !form.end) { setError('Please fill in all required fields.'); return; }
    if (new Date(form.end) < new Date(form.start)) { setError('End date must be on or after start date.'); return; }

    const payload = {
      empId,
      name: emp?.name ?? '',
      type: form.type,
      start: fmtDate(form.start),
      end: fmtDate(form.end),
      days,
      reason: form.reason,
      reqDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      status: 'Pending' as const,
    };
    const r = await api.createLeave(payload);
    if (!r.ok) { setError(r.error || 'Failed to submit leave request.'); return; }

    setLeaves(prev => [{ ...r.data, id: r.data.id ?? r.data.leaveId }, ...prev]);
    setForm({ type: '', start: '', end: '', reason: '' });
    setError('');
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        <StatCard label="Total Allowance" value={companySettings.leaveAllowance} sub="Days per year" color="slate" />
        <StatCard label="Leaves Used" value={approvedDays} sub="Approved days" color="blue" />
        <StatCard label="Remaining" value={remaining} sub="Days left" color="green" />
        <StatCard label="Pending" value={pendingCount} sub="Awaiting approval" color="yellow" />
      </div>

      <Card>
        <div className="p-5 pb-3 flex items-center justify-between">
          <SectionHeader title={`Leave History (${myLeaves.length})`} />
          <Btn onClick={() => { setShowForm(true); setError(''); }} size="sm">+ Request Leave</Btn>
        </div>
        {myLeaves.length === 0 ? (
          <p className="text-center text-sm text-slate-400 py-8">No leave requests yet.</p>
        ) : (
          <Table headers={['Request Date', 'Type', 'Start Date', 'End Date', 'Days', 'Reason', 'Status']}>
            {myLeaves.map(r => (
              <TR key={r.id}>
                <TD>{r.reqDate}</TD>
                <TD>{r.type}</TD>
                <TD>{r.start}</TD>
                <TD>{r.end}</TD>
                <TD>{r.days}</TD>
                <TD className="text-slate-500 text-xs max-w-40">{r.reason}</TD>
                <TD><Badge status={r.status} /></TD>
              </TR>
            ))}
          </Table>
        )}
        <div className="p-4" />
      </Card>

      {showForm && (
        <Modal title="Request Leave" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <Select label="Leave Type *" value={form.type} onChange={set('type')}>
              <option value="">Select type</option>
              <option>Sick Leave</option>
              <option>Vacation</option>
              <option>Emergency</option>
              <option>Maternity/Paternity</option>
              <option>Other</option>
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start Date *" type="date" value={form.start} onChange={set('start')} />
              <Input label="End Date *" type="date" value={form.end} onChange={set('end')} />
            </div>
            {days > 0 && <p className="text-sm text-blue-600 font-medium">Number of days: {days}</p>}
            <Textarea label="Reason" placeholder="Briefly describe the reason..." value={form.reason} onChange={set('reason') as never} />
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2 pt-2">
              <Btn variant="secondary" onClick={() => setShowForm(false)} className="flex-1 justify-center">Cancel</Btn>
              <Btn onClick={handleSubmit} className="flex-1 justify-center">Submit Request</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
