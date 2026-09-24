import { useState } from 'react';
import { useData } from '../context/DataContext';
import { hashPw, checkStrength } from '../utils/crypto';
import { api } from '../utils/api';
import { Input, Btn, Card } from '../components/ui';

export default function ChangePassword({ empId, name, onDone }: { empId: string; name: string; onDone: () => void }) {
  const { employees, setEmployees } = useData();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  const strength = checkStrength(form.next);
  const strongEnough = strength.errors.length === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.current || !form.next || !form.confirm) { setError('All fields are required.'); return; }

    const emp = employees.find(e => e.id === empId);
    const tempPw = emp?.tempPassword || form.current;
    if (!emp || hashPw(form.current) !== hashPw(tempPw)) {
      setError('Current / temporary password is incorrect.'); return;
    }
    if (!strongEnough) { setError('New password does not meet strength requirements.'); return; }
    if (form.next === form.current) { setError('New password must differ from the temporary password.'); return; }
    if (form.next !== form.confirm) { setError('Passwords do not match.'); return; }

    setLoading(true);
    try {
      const res = await api.changePassword(empId, form.next);
      if (!res.ok) {
        console.warn('Backend change password:', res.error);
      }
    } catch { /* ignore: fallback to local */ }

    setEmployees(prev => prev.map(e =>
      e.id === empId ? { ...e, firstLogin: false, tempPassword: '', password: hashPw(form.next) } : e
    ));
    setLoading(false);
    onDone();
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="mx-auto mb-3 w-fit">
            <svg width="48" height="48" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="8" fill="#2563EB" />
              <path d="M8 14a6 6 0 1112 0" stroke="white" strokeWidth="2" strokeLinecap="round" />
              <circle cx="14" cy="14" r="2.5" fill="white" />
              <path d="M14 16.5v4" stroke="white" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900">StaffSync</h1>
        </div>

        <Card className="p-6">
          <div className="flex items-start gap-3 mb-5 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <span className="text-amber-500 text-lg leading-none mt-0.5">⚠</span>
            <div>
              <p className="text-sm font-medium text-amber-800">Password Change Required</p>
              <p className="text-xs text-amber-600 mt-0.5">
                For security, please set a strong personal password before continuing.
              </p>
            </div>
          </div>

          <p className="text-sm text-slate-600 mb-4">Hello, <strong>{name}</strong>. This is your first login.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input label="Current / Temporary Password" type="password" placeholder="••••••••" value={form.current} onChange={set('current')} />

            <div>
              <Input label="New Password" type="password" placeholder="Min. 8 chars, mixed case, number, symbol" value={form.next} onChange={set('next')} />
              {form.next && (
                <div className="mt-2 space-y-1.5">
                  <div className="flex gap-1">
                    {[0,1,2,3].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : 'bg-slate-200'}`} />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${strongEnough ? 'text-green-600' : 'text-slate-500'}`}>{strength.label}</p>
                  {strength.errors.length > 0 && (
                    <ul className="text-xs text-slate-500 space-y-0.5 pl-3">
                      {strength.errors.map(e => <li key={e} className="list-disc">{e}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>

            <Input label="Confirm New Password" type="password" placeholder="••••••••" value={form.confirm} onChange={set('confirm')} />
            {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <Btn type="submit" className="w-full justify-center py-2.5" disabled={(!strongEnough && form.next.length > 0) || loading}>
              {loading ? 'Saving...' : 'Set Password & Continue'}
            </Btn>
          </form>
        </Card>
      </div>
    </div>
  );
}
