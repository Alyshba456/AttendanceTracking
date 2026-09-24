import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { checkStrength, hashPw } from '../../utils/crypto';
import { api } from '../../utils/api';
import { Input, Btn, Badge } from '../../components/ui';

export default function Profile({ empId }: { empId: string }) {
  const { employees, setEmployees } = useData();
  const emp = employees.find(e => e.id === empId);

  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState(emp?.name ?? '');
  const [email, setEmail] = useState(emp?.email ?? '');
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const strength = checkStrength(pwForm.next);

  if (!emp) return <p className="text-slate-500 text-sm">Employee record not found.</p>;

  function handleSave() {
    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, name, email } : e));
    setEditMode(false);
  }

  const deptDesignationRow = (
    <div className="grid grid-cols-2 gap-4">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Department</label>
        <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500">{emp.dept}</div>
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-slate-700">Designation</label>
        <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500">{emp.designation}</div>
      </div>
    </div>
  );

  return (
    <div className="w-full">
      <div className="mb-8 px-2">
      <h2 className="text-lg font-bold text-slate-900">Profile</h2>
      <p className="text-sm text-slate-500 mt-0.5">View and manage your account details and credentials.</p>
    </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">

        <div className="grid grid-cols-3 gap-10 px-10 py-10">
          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-slate-800">Personal Information</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">Basic profile info shown across the portal and used in reports.</p>
          </div>
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-4 mb-6 pb-4 border-b border-slate-100">
              <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-2xl font-bold">{emp.name[0]}</span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">{emp.name}</h2>
                <p className="text-sm text-slate-500">{emp.designation} · {emp.dept}</p>
                <p className="text-xs font-mono text-slate-400 mt-0.5">{emp.id}</p>
                <div className="mt-1"><Badge status={emp.status} /></div>
              </div>
            </div>
            <Input label="Full Name" value={name} onChange={e => setName(e.target.value)} disabled={!editMode} />
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Employee ID</label>
              <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 font-mono">{emp.id}</div>
            </div>
            <Input label="Company Email" type="email" value={email} onChange={e => setEmail(e.target.value)} disabled={!editMode} />
            {deptDesignationRow}
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">Role</label>
              <div className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 capitalize">{emp.role}</div>
            </div>

            <div className="flex gap-2 pt-2">
              {editMode ? (
                <>
                  <Btn variant="secondary" onClick={() => { setName(emp.name); setEmail(emp.email); setEditMode(false); }}>Cancel</Btn>
                  <Btn onClick={handleSave}>Save Changes</Btn>
                </>
              ) : (
                <Btn variant="secondary" onClick={() => setEditMode(true)}>Edit Profile</Btn>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-10 px-10 py-10">
          <div className="col-span-1">
            <h3 className="text-sm font-semibold text-slate-800">Security</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">Update your account password to keep your account secure.</p>
          </div>
          <div className="col-span-2 space-y-3">
            <h3 className="font-semibold text-slate-800 mb-4">Change Password</h3>
            <Input label="Current Password" type="password" placeholder="••••••••"
              value={pwForm.current} onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))} />
            <div>
              <Input label="New Password" type="password" placeholder="Min. 8 chars, mixed case, number, symbol"
                value={pwForm.next} onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))} />
              {pwForm.next && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[0,1,2,3].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength.score ? strength.color : 'bg-slate-200'}`} />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">{strength.label}{strength.errors[0] ? ` — ${strength.errors[0]}` : ''}</p>
                </div>
              )}
            </div>
            <Input label="Confirm New Password" type="password" placeholder="••••••••"
              value={pwForm.confirm} onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))} />
            {pwError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{pwError}</p>}
            {pwSuccess && <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">Password updated successfully.</p>}
            <div className="pt-2">
              <Btn
                disabled={pwLoading}
                onClick={async () => {
                  setPwError(''); setPwSuccess(false);
                  if (!pwForm.current || !pwForm.next || !pwForm.confirm) { setPwError('All fields are required.'); return; }
                  if (strength.errors.length > 0) { setPwError('New password does not meet strength requirements.'); return; }
                  if (pwForm.next !== pwForm.confirm) { setPwError('Passwords do not match.'); return; }
                  setPwLoading(true);
                  try {
                    const r = await api.changePassword(empId, pwForm.next, pwForm.current);
                    if (!r.ok) { setPwError(r.error || 'Failed to update password.'); return; }
                    setEmployees(prev => prev.map(e => e.id === empId ? { ...e, password: hashPw(pwForm.next), firstLogin: false, tempPassword: '' } : e));
                    setPwForm({ current: '', next: '', confirm: '' });
                    setPwSuccess(true);
                  } finally {
                    setPwLoading(false);
                  }
                }}
              >{pwLoading ? 'Updating...' : 'Update Password'}</Btn>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
