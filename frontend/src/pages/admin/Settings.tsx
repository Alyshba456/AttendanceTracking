import { useState } from 'react';
import { useData } from '../../context/DataContext';
import { api } from '../../utils/api';
import { checkStrength } from '../../utils/crypto';
import { Input, Select, Btn } from '../../components/ui';

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-10 px-10 py-10 border-b border-slate-100 last:border-0">
      <div className="col-span-1">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <p className="text-xs text-slate-500 mt-1 leading-relaxed">{description}</p>
      </div>
      <div className="col-span-2">
        {children}
      </div>
    </div>
  );
}

function BufferInput({ label, sub, value, onChange }: { label: string; sub: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <div>
      <label className="text-sm font-medium text-slate-700 block mb-1">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min="0"
          max="120"
          value={value}
          onChange={onChange}
          className="w-24 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <span className="text-sm text-slate-500">minutes</span>
      </div>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}

export default function AdminSettings() {
  const { companySettings, setCompanySettings, currentEmpId } = useData();

  const [company, setCompany] = useState({ ...companySettings });
  const [companySaved, setCompanySaved] = useState(false);
  const [companyLoading, setCompanyLoading] = useState(false);

  const [schedule, setSchedule] = useState({
    workStartTime: companySettings.workStartTime,
    workEndTime: companySettings.workEndTime,
    workWeek: companySettings.workWeek,
  });
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const [buffers, setBuffers] = useState({
    lateBuffer: String(companySettings.lateBuffer),
    overtimeBuffer: String(companySettings.overtimeBuffer),
  });
  const [buffersSaved, setBuffersSaved] = useState(false);
  const [buffersLoading, setBuffersLoading] = useState(false);

  const [leave, setLeave] = useState({
    leaveAllowance: String(companySettings.leaveAllowance),
  });
  const [leaveSaved, setLeaveSaved] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const pwStrength = checkStrength(pwForm.next);

  const setC = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setCompany(c => ({ ...c, [k]: e.target.value }));

  const setS = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setSchedule(s => ({ ...s, [k]: e.target.value }));

  const setB = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setBuffers(b => ({ ...b, [k]: e.target.value }));

  const setL = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setLeave(l => ({ ...l, [k]: e.target.value }));

  function applySettingsToAllStates(persisted: any) {
    const { _id, __v, createdAt, updatedAt, ...rest } = persisted ?? {};
    const canonical: typeof companySettings = { ...companySettings, ...rest };
    setCompanySettings(canonical);
    setCompany(prev => ({ ...prev,
      companyName: canonical.companyName,
      companyEmail: canonical.companyEmail,
      companyAddress: canonical.companyAddress,
    }));
    setSchedule({
      workStartTime: canonical.workStartTime,
      workEndTime: canonical.workEndTime,
      workWeek: canonical.workWeek,
    });
    setBuffers({
      lateBuffer: String(canonical.lateBuffer),
      overtimeBuffer: String(canonical.overtimeBuffer),
    });
    setLeave({
      leaveAllowance: String(canonical.leaveAllowance),
    });
  }

  async function saveCompany() {
    if (companyLoading) return;
    const payload = { ...company };
    setCompanyLoading(true);
    const r = await api.updateSettings(payload);
    if (r.ok) {
      const fresh = await api.getSettings();
      if (fresh.ok && fresh.data) {
        applySettingsToAllStates(fresh.data);
      } else {
        setCompanySettings(prev => ({ ...prev, ...payload }));
        setCompany({ ...payload });
      }
      setCompanySaved(true);
      setTimeout(() => setCompanySaved(false), 2500);
    } else {
      alert('Failed to save company info: ' + (r.error || 'Unknown error'));
    }
    setCompanyLoading(false);
  }

  async function saveSchedule() {
    if (scheduleLoading) return;
    const payload = {
      workStartTime: schedule.workStartTime,
      workEndTime: schedule.workEndTime,
      workWeek: schedule.workWeek,
    };
    setScheduleLoading(true);
    const r = await api.updateSettings(payload);
    if (r.ok) {
      const fresh = await api.getSettings();
      if (fresh.ok && fresh.data) {
        applySettingsToAllStates(fresh.data);
      } else {
        setCompanySettings(prev => ({ ...prev, ...payload }));
        setSchedule({ ...payload });
      }
      setScheduleSaved(true);
      setTimeout(() => setScheduleSaved(false), 2500);
    } else {
      alert('Failed to save work schedule: ' + (r.error || 'Unknown error'));
    }
    setScheduleLoading(false);
  }

  async function saveBuffers() {
    if (buffersLoading) return;
    const payload = {
      lateBuffer: Math.max(0, parseInt(buffers.lateBuffer) || 0),
      overtimeBuffer: Math.max(0, parseInt(buffers.overtimeBuffer) || 0),
    };
    setBuffersLoading(true);
    const r = await api.updateSettings(payload);
    if (r.ok) {
      const fresh = await api.getSettings();
      if (fresh.ok && fresh.data) {
        applySettingsToAllStates(fresh.data);
      } else {
        setCompanySettings(prev => ({ ...prev, ...payload }));
        setBuffers({
          lateBuffer: String(payload.lateBuffer),
          overtimeBuffer: String(payload.overtimeBuffer),
        });
      }
      setBuffersSaved(true);
      setTimeout(() => setBuffersSaved(false), 2500);
    } else {
      alert('Failed to save buffer times: ' + (r.error || 'Unknown error'));
    }
    setBuffersLoading(false);
  }

  async function saveLeave() {
    if (leaveLoading) return;
    const payload = {
      leaveAllowance: Math.max(1, parseInt(leave.leaveAllowance) || companySettings.leaveAllowance),
    };
    setLeaveLoading(true);
    const r = await api.updateSettings(payload);
    if (r.ok) {
      const fresh = await api.getSettings();
      if (fresh.ok && fresh.data) {
        applySettingsToAllStates(fresh.data);
      } else {
        setCompanySettings(prev => ({ ...prev, ...payload }));
        setLeave({ leaveAllowance: String(payload.leaveAllowance) });
      }
      setLeaveSaved(true);
      setTimeout(() => setLeaveSaved(false), 2500);
    } else {
      alert('Failed to save leave policy: ' + (r.error || 'Unknown error'));
    }
    setLeaveLoading(false);
  }

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="mb-8 px-2">
        <h2 className="text-lg font-bold text-slate-900">Settings</h2>
        <p className="text-sm text-slate-500 mt-0.5">Manage company information and attendance policies.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm divide-y divide-slate-100">

        {/* Company Information */}
        <Section
          title="Company Information"
          description="Basic details shown across the portal and used in reports."
        >
          <div className="space-y-4">
            <Input label="Company Name" value={company.companyName} onChange={setC('companyName')} />
            <Input label="Company Email" type="email" value={company.companyEmail} onChange={setC('companyEmail')} />
            <Input label="Company Address" value={company.companyAddress} onChange={setC('companyAddress')} />
            <div className="pt-1">
              <Btn loading={companyLoading} onClick={saveCompany}>
                {companySaved ? '✓ Saved' : 'Save Company Info'}
              </Btn>
            </div>
          </div>
        </Section>

        {/* Work Schedule */}
        <Section
          title="Work Schedule"
          description="Define official working hours and days. These affect attendance status calculations."
        >
          <div className="space-y-5">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Input label="Work Start Time" type="time" value={schedule.workStartTime} onChange={setS('workStartTime')} />
                <Input label="Work End Time" type="time" value={schedule.workEndTime} onChange={setS('workEndTime')} />
              </div>
              <Select label="Work Week" value={schedule.workWeek} onChange={setS('workWeek')}>
                <option>Monday – Friday</option>
                <option>Monday – Saturday</option>
                <option>Monday – Sunday</option>
              </Select>
            </div>
            <div className="pt-1 flex items-center gap-4">
              <Btn loading={scheduleLoading} onClick={saveSchedule}>
                {scheduleSaved ? '✓ Saved' : 'Save Work Schedule'}
              </Btn>
              {scheduleSaved && (
                <p className="text-xs text-green-600">Work start, end and work week updated.</p>
              )}
            </div>
          </div>
        </Section>

        {/* Buffer Times */}
        <Section
          title="Buffer Times"
          description="Grace periods that determine when an employee is marked Late or qualifies for Overtime."
        >
          <div className="space-y-5">
            <div className="space-y-5">
              <BufferInput
                label="Late Arrival Buffer"
                sub={`Employees clocking in more than ${buffers.lateBuffer} min after ${schedule.workStartTime} will be marked Late.`}
                value={buffers.lateBuffer}
                onChange={setB('lateBuffer')}
              />
              <BufferInput
                label="Overtime Buffer"
                sub={`Employees clocking out more than ${buffers.overtimeBuffer} min after ${schedule.workEndTime} qualify for Overtime.`}
                value={buffers.overtimeBuffer}
                onChange={setB('overtimeBuffer')}
              />

              {/* Visual preview */}
              <div className="bg-slate-50 rounded-xl p-4 text-xs text-slate-600 space-y-2">
                <p className="font-semibold text-slate-700 mb-2">Status thresholds preview</p>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  <span><strong>Present</strong> — clock-in within {buffers.lateBuffer} min of {schedule.workStartTime}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" />
                  <span><strong>Late</strong> — clock-in after {formatBufferTime(schedule.workStartTime, parseInt(buffers.lateBuffer) || 0)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                  <span><strong>Overtime</strong> — clock-out after {formatBufferTime(schedule.workEndTime, parseInt(buffers.overtimeBuffer) || 0)}</span>
                </div>
              </div>
            </div>
            <div className="pt-1 flex items-center gap-4">
              <Btn loading={buffersLoading} onClick={saveBuffers}>
                {buffersSaved ? '✓ Saved' : 'Save Buffer Times'}
              </Btn>
              {buffersSaved && (
                <p className="text-xs text-green-600">Late and overtime buffers updated.</p>
              )}
            </div>
          </div>
        </Section>

        {/* Leave Policy */}
        <Section
          title="Leave Policy"
          description="Annual leave allowance per employee. Changes take effect immediately across all employee portals."
        >
          <div className="space-y-4">
            <div className="max-w-xs">
              <Input
                label="Annual Leave Allowance (days)"
                type="number"
                value={leave.leaveAllowance}
                onChange={setL('leaveAllowance')}
              />
              <p className="text-xs text-slate-400 mt-1">Applied to all active employees immediately.</p>
            </div>
            <div className="pt-1 flex items-center gap-4">
              <Btn loading={leaveLoading} onClick={saveLeave}>
                {leaveSaved ? '✓ Saved' : 'Save Leave Allowance'}
              </Btn>
              {leaveSaved && (
                <p className="text-xs text-green-600">Annual leave allowance updated.</p>
              )}
            </div>
          </div>
        </Section>

        {/* Security — Change Admin Password */}
        <Section
          title="Security"
          description="Update your admin account password. Strong passwords include mixed case, numbers and symbols."
        >
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-800 mb-2">Change Admin Password</h3>
            <Input
              label="Current Password"
              type="password"
              placeholder="••••••••"
              value={pwForm.current}
              onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
            />
            <div>
              <Input
                label="New Password"
                type="password"
                placeholder="Min. 8 chars, mixed case, number, symbol"
                value={pwForm.next}
                onChange={e => setPwForm(f => ({ ...f, next: e.target.value }))}
              />
              {pwForm.next && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1">
                    {[0,1,2,3].map(i => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i <= pwStrength.score ? pwStrength.color : 'bg-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    {pwStrength.label}
                    {pwStrength.errors[0] ? ` — ${pwStrength.errors[0]}` : ''}
                  </p>
                </div>
              )}
            </div>
            <Input
              label="Confirm New Password"
              type="password"
              placeholder="••••••••"
              value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
            />
            {pwError && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{pwError}</p>}
            {pwSuccess && <p className="text-xs text-green-600 bg-green-50 rounded-lg px-3 py-2">Password updated successfully. Use the new password on your next login.</p>}
            <div className="pt-2">
              <Btn
                disabled={pwLoading}
                onClick={async () => {
                  setPwError(''); setPwSuccess(false);
                  if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
                    setPwError('All fields are required.'); return;
                  }
                  if (pwStrength.errors.length > 0) {
                    setPwError('New password does not meet strength requirements.'); return;
                  }
                  if (pwForm.next !== pwForm.confirm) {
                    setPwError('Passwords do not match.'); return;
                  }
                  setPwLoading(true);
                  try {
                    const r = await api.changePassword(currentEmpId || 'ADMIN', pwForm.next, pwForm.current);
                    if (!r.ok) { setPwError(r.error || 'Failed to update password.'); return; }
                    setPwForm({ current: '', next: '', confirm: '' });
                    setPwSuccess(true);
                  } finally { setPwLoading(false); }
                }}
              >{pwLoading ? 'Updating...' : 'Update Password'}</Btn>
            </div>
          </div>
        </Section>

      </div>
    </div>
  );
}

function formatBufferTime(base: string, bufferMins: number): string {
  const [h, m] = base.split(':').map(Number);
  const total = h * 60 + m + bufferMins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  const period = nh >= 12 ? 'PM' : 'AM';
  const displayH = nh % 12 || 12;
  return `${displayH}:${String(nm).padStart(2, '0')} ${period}`;
}
