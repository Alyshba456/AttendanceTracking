import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { api } from '../../utils/api';
import { Card, Badge, Table, TR, TD, Input, Textarea, Btn, SectionHeader, Modal, StatCard } from '../../components/ui';

function to12h(t: string) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  return `${((h % 12) || 12).toString().padStart(2, '0')}:${m.toString().padStart(2, '0')} ${ampm}`;
}

function calcHours(start: string, end: string) {
  if (!start || !end) return '—';
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  if (mins <= 0) return '—';
  return mins % 60 > 0 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${Math.floor(mins / 60)}h`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function hoursToMins(h: string): number {
  if (!h || h === '—') return 0;
  let total = 0;
  const hm = h.match(/(\d+)h/);
  const mm = h.match(/(\d+)m/);
  if (hm) total += parseInt(hm[1]) * 60;
  if (mm) total += parseInt(mm[1]);
  return total;
}
function minsToHours(m: number): string {
  if (m <= 0) return '0h';
  const h = Math.floor(m / 60);
  const min = m % 60;
  return min > 0 ? `${h}h ${min}m` : `${h}h`;
}
function isThisMonth(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function FieldWork({ empId }: { empId: string }) {
  const { employees, fieldWork, setFieldWork } = useData();
  const emp = employees.find(e => e.id === empId);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ date: '', start: '', end: '', location: '', desc: '' });
  const [error, setError] = useState('');

  const myEntries = fieldWork.filter(f => f.empId === empId);
  const approvedMins = myEntries.filter(f => f.status === 'Approved').reduce((s, f) => s + hoursToMins(f.hours), 0);
  const approvedHours = minsToHours(approvedMins);
  const pendingCount = myEntries.filter(f => f.status === 'Pending').length;
  const monthMins = myEntries.filter(f => f.status === 'Approved' && isThisMonth(f.date)).reduce((s, f) => s + hoursToMins(f.hours), 0);
  const thisMonthHours = minsToHours(monthMins);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit() {
    if (!form.date || !form.start || !form.end || !form.location) {
      setError('Please fill in all required fields.');
      return;
    }
    const h = calcHours(form.start, form.end);
    if (h === '—') { setError('End time must be after start time.'); return; }

    const payload = {
      empId,
      name: emp?.name ?? '',
      date: fmtDate(form.date),
      location: form.location,
      start: to12h(form.start),
      end: to12h(form.end),
      hours: h,
      desc: form.desc,
      status: 'Pending' as const,
    };
    const r = await api.createFieldWork(payload);
    if (!r.ok) { setError(r.error || 'Failed to submit field work entry.'); return; }

    setFieldWork(prev => [{ ...r.data, id: r.data.id ?? r.data.fwId }, ...prev]);
    setForm({ date: '', start: '', end: '', location: '', desc: '' });
    setError('');
    setShowForm(false);
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Approved Hours" value={approvedHours} sub="All-time approved field work" color="blue" />
        <StatCard label="This Month" value={thisMonthHours} sub="Approved hours logged this month" color="green" />
        <StatCard label="Pending Review" value={pendingCount} sub="Awaiting admin approval" color="yellow" />
      </div>

      <Card>
        <div className="p-5 pb-3 flex items-start justify-between gap-4 flex-wrap">
          <div className="max-w-2xl">
            <SectionHeader title={`Field Work History (${myEntries.length})`} />
            <p className="text-sm text-slate-500 mt-1 leading-relaxed">
              Log hours worked outside the office. Field work submissions are reviewed by Admin before counting toward your monthly total.
            </p>
          </div>
          <Btn onClick={() => { setShowForm(true); setError(''); }}>+ Add Field Work</Btn>
        </div>
        {myEntries.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-full bg-violet-50 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-500">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-800">No field work entries yet.</p>
              <p className="text-xs text-slate-500 mt-1">Log your first site visit, client meeting or on-site work above.</p>
            </div>
          </div>
        ) : (
          <Table headers={['Date', 'Location / Site', 'Start', 'End', 'Hours', 'Description', 'Status']}>
            {myEntries.map(r => (
              <TR key={r.id}>
                <TD>{r.date}</TD>
                <TD className="max-w-36">{r.location}</TD>
                <TD>{r.start}</TD>
                <TD>{r.end}</TD>
                <TD className="font-medium">{r.hours}</TD>
                <TD className="max-w-48 text-slate-500 text-xs">{r.desc || <span className="text-slate-300 italic">No description</span>}</TD>
                <TD><Badge status={r.status} /></TD>
              </TR>
            ))}
          </Table>
        )}
        <div className="p-4" />
      </Card>

      {showForm && (
        <Modal title="Add Field Work" onClose={() => setShowForm(false)}>
          <div className="space-y-3">
            <Input label="Date *" type="date" value={form.date} onChange={set('date')} />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Start Time *" type="time" value={form.start} onChange={set('start')} />
              <Input label="End Time *" type="time" value={form.end} onChange={set('end')} />
            </div>
            {form.start && form.end && (
              <div className="flex items-center gap-2 text-sm p-2.5 bg-violet-50 rounded-lg border border-violet-100">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-violet-600">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-slate-500">Total Hours:</span>
                <span className="font-semibold text-violet-700">{calcHours(form.start, form.end)}</span>
              </div>
            )}
            <Input label="Location / Site *" placeholder="e.g. Client Site, Makati CBD" value={form.location} onChange={set('location')} />
            <Textarea label="Purpose / Description" placeholder="Describe the work done..." value={form.desc} onChange={set('desc') as never} />
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div className="flex gap-2 pt-2">
              <Btn variant="secondary" onClick={() => setShowForm(false)} className="flex-1 justify-center">Cancel</Btn>
              <Btn onClick={handleSubmit} className="flex-1 justify-center">Submit</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
