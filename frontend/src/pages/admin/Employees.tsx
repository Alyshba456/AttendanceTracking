import { useState, useEffect, useMemo, useRef } from 'react';
import { useData, Employee, departmentList, saveCustomDepartment } from '../../context/DataContext';
import { api } from '../../utils/api';
import { Card, Badge, Table, TR, TD, Btn, SectionHeader, Input, Select, EmployeeCell, Avatar, Banner } from '../../components/ui';

const ICO = {
  edit: (c = 'currentColor') => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  trash: (c = 'currentColor') => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1.2 13.2a2 2 0 01-2 1.8H8.2a2 2 0 01-2-1.8L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  ),
  close: (c = 'currentColor') => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

type Step =
  | 'table'
  | 'add-form' | 'confirmed'
  | 'reset-pw' | 'reset-done'
  | 'view-details'
  | 'edit-form' | 'edit-done';

function nextEmpId(employees: Employee[]) {
  const nums = employees
    .map(e => parseInt(e.id.replace('EMP-', '')))
    .filter(n => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `EMP-${String(max + 1).padStart(3, '0')}`;
}

// Prettier modal wrapper — no backdrop click-to-close, full control of header
function FormModal({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {children}
      </div>
    </div>
  );
}

export default function AdminEmployees() {
  const { employees, setEmployees, companySettings, setCompanySettings } = useData();
  const [step, setStep] = useState<Step>('table');
  const [created, setCreated] = useState<Employee | null>(null);
  const [resetTarget, setResetTarget] = useState<Employee | null>(null);
  const [newTempPw, setNewTempPw] = useState('');
  const [showNewPw, setShowNewPw] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pwCopied, setPwCopied] = useState(false);
  const [viewTargetId, setViewTargetId] = useState<string | null>(null);
  const [editTargetId, setEditTargetId] = useState<string | null>(null);
  const viewTarget: Employee | null = useMemo(
    () => (viewTargetId ? (employees.find(e => e.id === viewTargetId) ?? null) : null),
    [viewTargetId, employees]
  );
  const editTarget: Employee | null = useMemo(
    () => (editTargetId ? (employees.find(e => e.id === editTargetId) ?? null) : null),
    [editTargetId, employees]
  );
  const [editForm, setEditForm] = useState({
    name: '', email: '', dept: '', designation: '', role: 'Employee' as 'Admin' | 'Employee', status: 'Active' as 'Active' | 'Inactive',
  });
  const [editError, setEditError] = useState('');
  const [viewMode, setViewMode] = useState<'view-only' | 'editing'>('view-only');
  const [saveEditLoading, setSaveEditLoading] = useState(false);
  const [resetPwLoading, setResetPwLoading] = useState(false);

  const [form, setForm] = useState({
    name: '', dept: 'Engineering', designation: '', email: '', tempPw: '', confirmPw: '',
  });
  const [addCustomDept, setAddCustomDept] = useState('');
  const [editCustomDept, setEditCustomDept] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const [pageToast, setPageToast] = useState<{ tone: 'success' | 'info' | 'danger' | 'warning'; message: string } | null>(null);
  const autoDismissToast: any = useRef(null);

  function flashToast(tone: 'success' | 'danger' | 'info' | 'warning', message: string) {
    setPageToast({ tone, message });
    if (autoDismissToast.current) clearTimeout(autoDismissToast.current);
    autoDismissToast.current = setTimeout(() => setPageToast(null), 6000);
  }

  const depts = useMemo(() => departmentList(companySettings.customDepartments || [], employees), [companySettings.customDepartments, employees]);
  const OTHER_MARKER = '__OTHER__';

  const selectedAddDeptVal = depts.includes(form.dept) ? form.dept : OTHER_MARKER;
  useEffect(() => {
    if (selectedAddDeptVal === OTHER_MARKER && !form.dept) setAddCustomDept('');
    else if (selectedAddDeptVal !== OTHER_MARKER) setAddCustomDept('');
  }, [selectedAddDeptVal, form.dept]);

  const handleAddDeptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === OTHER_MARKER) {
      setForm(f => ({ ...f, dept: '' }));
      setAddCustomDept('');
    } else {
      setForm(f => ({ ...f, dept: e.target.value }));
      setAddCustomDept('');
    }
  };

  const selectedEditDeptVal = depts.includes(editForm.dept) ? editForm.dept : OTHER_MARKER;
  useEffect(() => {
    if (selectedEditDeptVal === OTHER_MARKER && !editForm.dept) setEditCustomDept('');
    else if (selectedEditDeptVal !== OTHER_MARKER) setEditCustomDept('');
  }, [selectedEditDeptVal, editForm.dept]);

  const handleEditDeptChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === OTHER_MARKER) {
      setEditForm(f => ({ ...f, dept: '' }));
      setEditCustomDept('');
    } else {
      setEditForm(f => ({ ...f, dept: e.target.value }));
      setEditCustomDept('');
    }
  };

  const formBodyRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (error && formBodyRef.current) {
      formBodyRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [error]);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  function resetForm() {
    setForm({ name: '', dept: 'Engineering', designation: '', email: '', tempPw: '', confirmPw: '' });
    setError('');
    setShowPw(false);
  }

  async function handleAdd() {
    // Resolve dept: if user selected "Other", take the typed custom value
    let resolvedDept = (form.dept || '').trim();
    let resolvedCustom = (addCustomDept || '').trim();
    if (selectedAddDeptVal === OTHER_MARKER) {
      if (!resolvedCustom) {
        setError('You chose "Other" as the department. Please type the department name in the box below the dropdown.');
        return;
      }
      resolvedDept = resolvedCustom;
    }
    if (!resolvedDept) {
      setError('Department is required.');
      return;
    }

    // Persist a brand-new custom department into settings so it shows up permanently going forward
    if (selectedAddDeptVal === OTHER_MARKER) {
      try {
        const next = await saveCustomDepartment(resolvedDept, companySettings.customDepartments || []);
        if (next) setCompanySettings(cs => ({ ...cs, customDepartments: next }));
      } catch { /* ignore — save falls back to existing dept just for this employee */ }
    }

    // Basic client-side validation
    if (!form.name.trim() || !form.email.trim() || !form.designation.trim() || !form.tempPw) {
      setError('Name, Designation, Email, and Password are all required.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError('Please enter a valid company email (format: name@company.com).');
      return;
    }
    if (form.tempPw.length < 8) {
      setError('Temporary password must be at least 8 characters.');
      return;
    }
    if (form.tempPw !== form.confirmPw) {
      setError('Passwords do not match. Please type the same password twice.');
      return;
    }

    // Local duplicate email check (fast; server also validates)
    const email = form.email.trim().toLowerCase();
    if (employees.some(e => e.email.toLowerCase() === email)) {
      setError(`An account with email ${email} already exists. Use a different email or go to the existing employee and click Reset Password.`);
      return;
    }

    setError('');
    setAdding(true);
    try {
      const newEmpPartial: Partial<Employee> & Record<string, any> = {
        name: form.name.trim(),
        email,
        dept: resolvedDept,
        designation: form.designation.trim(),
        role: 'Employee',
        status: 'Active',
        password: form.tempPw,
        tempPassword: form.tempPw,
        firstLogin: true,
      };

      const r = await api.createEmployee(newEmpPartial);
      if (!r.ok) {
        setError(r.error || 'Failed to create employee. Please try again.');
        flashToast('danger', 'Account not created. ' + (r.error || 'Please try again.'));
        setAdding(false);
        return;
      }

      const createdEmp: Employee = {
        id: r.data?.id || nextEmpId(employees),
        name: r.data?.name || form.name.trim(),
        email: (r.data?.email || email).toLowerCase(),
        dept: r.data?.dept || resolvedDept,
        designation: r.data?.designation || form.designation.trim(),
        role: (r.data?.role as any) || 'Employee',
        status: (r.data?.status as any) || 'Active',
        tempPassword: r.data?.demoTempPassword || form.tempPw,
        password: '',
        firstLogin: r.data?.firstLogin ?? true,
      };

      // Confirm server actually stored the employee by fetching fresh employee list
      let freshEmpList: Employee[] = [...employees, createdEmp];
      try {
        const fresh = await api.getEmployees();
        if (fresh.ok && Array.isArray(fresh.data)) {
          freshEmpList = fresh.data as Employee[];
          const found = freshEmpList.find(e => e.id === createdEmp.id);
          if (!found) {
            // Doc was returned but didn't appear in list — rare, warn
            flashToast('warning', 'Account was created but the list hasn\'t refreshed yet. Refreshing now…');
            setTimeout(() => api.getEmployees().then(x => x.ok && Array.isArray(x.data) && setEmployees(x.data as Employee[])), 1200);
          }
        }
      } catch { /* ignore */ }

      setEmployees(freshEmpList);
      setCreated(createdEmp);
      setCopied(false);
      flashToast('success', `✅ Employee account created successfully!\n• ${createdEmp.name} (${createdEmp.email})\n• ID: ${createdEmp.id} — Temp password: ${createdEmp.tempPassword}`);
      resetForm();
      setStep('confirmed');
    } finally {
      setAdding(false);
    }
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    if (!newTempPw || newTempPw.length < 8) {
      setEditError('Temporary password must be at least 8 characters.');
      return;
    }
    setEditError('');
    setResetPwLoading(true);
    try {
      const r = await api.updateEmployee({ id: resetTarget.id, tempPassword: newTempPw, firstLogin: true });
      if (!r.ok) {
        setEditError(r.error || 'Failed to reset password.');
        return;
      }
      setEmployees(prev => prev.map(e =>
        e.id === resetTarget.id ? { ...e, firstLogin: true, tempPassword: newTempPw } : e
      ));
      flashToast('success', `🔑 Password reset successfully for ${resetTarget.name}.`);
      setStep('reset-done');
    } finally {
      setResetPwLoading(false);
    }
  }

  async function toggleStatus(id: string) {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    const next = emp.status === 'Active' ? 'Inactive' : 'Active';
    const r = await api.updateEmployee({ id, status: next });
    if (!r.ok) return;
    setEmployees(prev => prev.map(e => e.id === id ? { ...e, status: next } : e));
  }

  function copyCredentials() {
    if (!created) return;
    const text = `Employee: ${created.name}\nID: ${created.id}\nEmail: ${created.email}\nTemporary Password: ${created.tempPassword}`;
    navigator.clipboard.writeText(text).then(() => setCopied(true));
  }

  function setEdit(k: string) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setEditForm(f => ({ ...f, [k]: e.target.value } as typeof f));
    };
  }

  function openEdit(e: Employee) {
    setEditTargetId(e.id);
    setEditForm({
      name: e.name,
      email: e.email,
      dept: e.dept,
      designation: e.designation,
      role: e.role as 'Employee' | 'Admin',
      status: e.status as 'Active' | 'Inactive',
    });
    setEditError('');
    setStep('edit-form');
  }

  async function saveEdit() {
    if (!editTarget) return;
    // Resolve department from "Other" custom field, if applicable
    let resolvedDept = (editForm.dept || '').trim();
    let resolvedCustom = (editCustomDept || '').trim();
    if (selectedEditDeptVal === OTHER_MARKER) {
      if (!resolvedCustom) {
        setEditError('You chose "Other" as the department. Please type the department name in the box below the dropdown.');
        return;
      }
      resolvedDept = resolvedCustom;
    }
    if (!resolvedDept) {
      setEditError('Department is required.');
      return;
    }

    // Persist brand-new custom department into settings if admin typed a new one
    if (selectedEditDeptVal === OTHER_MARKER) {
      try {
        const next = await saveCustomDepartment(resolvedDept, companySettings.customDepartments || []);
        if (next) setCompanySettings(cs => ({ ...cs, customDepartments: next }));
      } catch { /* ignore */ }
    }

    if (!editForm.name || !editForm.email || !editForm.designation) {
      setEditError('Name, Email, and Designation are required.');
      return;
    }
    setSaveEditLoading(true);
    try {
      const r = await api.updateEmployee({
        id: editTarget.id,
        name: editForm.name,
        email: editForm.email,
        dept: resolvedDept,
        designation: editForm.designation,
        role: editForm.role,
        status: editForm.status,
      });
      if (!r.ok) {
        setEditError(r.error || 'Failed to save changes.');
        return;
      }
      // Apply to local state, then re-verify the doc from server list so editTarget is the canonical record.
      setEmployees(prev => prev.map(e => e.id === editTarget.id ? {
        ...e,
        name: editForm.name,
        email: editForm.email.toLowerCase(),
        dept: resolvedDept,
        designation: editForm.designation,
        role: editForm.role,
        status: editForm.status,
      } : e));
      flashToast('success', `✅ Employee updated successfully:\n• ${editForm.name} (${editTarget.id})`);
      // If we're in view-details in-place editing, flip back to view-only mode and refresh the view target
      if (step === 'view-details') {
        const freshList = await api.getEmployees();
        const freshEmp = Array.isArray(freshList.data) ? (freshList.data as Employee[]).find(x => x.id === editTarget?.id) : null;
        if (freshEmp) {
          setEmployees(Array.isArray(freshList.data) ? freshList.data as Employee[] : prev => prev);
          setViewTargetId(freshEmp.id);
        }
        setViewMode('view-only');
      } else {
        setStep('edit-done');
      }
    } finally {
      setSaveEditLoading(false);
    }
  }

  const active = employees.filter(e => e.status === 'Active').length;
  const autoId = nextEmpId(employees);

  return (
    <div className="space-y-5">
      {/* Page-level success/failure toast banner (appears outside modal) */}
      {pageToast && (
        <Banner
          tone={pageToast.tone}
          message={pageToast.message}
          onDismiss={() => setPageToast(null)}
        />
      )}

      <Card>
        <div className="p-5 pb-3 flex items-center justify-between">
          <div>
            <SectionHeader title={`All Employees (${employees.length})`} />
            <p className="text-xs text-slate-500 -mt-3">{active} active · {employees.length - active} inactive</p>
          </div>
          <Btn onClick={() => { resetForm(); setStep('add-form'); }} size="sm">+ Add Employee</Btn>
        </div>
        <Table headers={['Employee ID', 'Name', 'Company Email', 'Department', 'Designation', 'Status', 'Actions']}>
          {employees.map(e => (
            <TR key={e.id}>
              <TD className="font-mono text-xs text-slate-500">{e.id}</TD>
              <TD className="font-medium">{e.name}</TD>
              <TD className="text-slate-500 text-xs">{e.email}</TD>
              <TD>{e.dept}</TD>
              <TD className="text-slate-500">{e.designation}</TD>
              <TD><Badge status={e.status} /></TD>
              <TD>
                <div className="flex gap-2 flex-wrap">
                  <Btn size="sm" variant="ghost" onClick={() => { setViewTargetId(e.id); setViewMode('view-only'); setStep('view-details'); }}>
                    View
                  </Btn>
                  <Btn size="sm" variant="secondary" onClick={() => { setResetTarget(e); setNewTempPw(''); setShowNewPw(false); setEditError(''); setStep('reset-pw'); }}>
                    Reset PW
                  </Btn>
                </div>
                <div className="mt-2">
                  <Btn size="sm" variant={e.status === 'Active' ? 'danger' : 'success'} onClick={() => toggleStatus(e.id)}>
                    {e.status === 'Active' ? 'Deactivate' : 'Activate'}
                  </Btn>
                </div>
              </TD>
            </TR>
          ))}
        </Table>
        <div className="p-4" />
      </Card>

      {/* ── Add Employee Form ── */}
      {step === 'add-form' && (
        <FormModal onClose={() => setStep('table')}>
          {/* Gradient header */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex items-start justify-between flex-shrink-0">
            <div>
              <h2 className="text-lg font-semibold text-white">Add Employee Account</h2>
              <p className="text-blue-200 text-xs mt-0.5">Create login credentials for a new team member</p>
            </div>
            <button onClick={() => setStep('table')} className="text-blue-200 hover:text-white leading-none mt-0.5 transition-colors">{ICO.close()}</button>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
            {/* Info notice */}
            <div className="flex gap-3 p-3.5 bg-blue-50 border border-blue-100 rounded-xl">
              <span className="text-blue-500 text-base leading-none mt-0.5 flex-shrink-0">ℹ</span>
              <p className="text-xs text-blue-700 leading-relaxed">
                The employee will use these credentials to log in. They'll be prompted to change the temporary password on first login.
              </p>
            </div>

            {/* Auto-assigned ID */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Employee ID</p>
                <p className="font-mono font-semibold text-slate-800 text-sm">{autoId}</p>
              </div>
              <span className="text-xs bg-slate-200 text-slate-500 px-2 py-1 rounded-full">Auto-assigned</span>
            </div>

            {/* Name */}
            <Input label="Full Name *" placeholder="e.g. John Dela Cruz" value={form.name} onChange={set('name')} />

            {/* Department + Designation side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Select label="Department" value={selectedAddDeptVal} onChange={handleAddDeptChange}>
                  {depts.map(d => <option key={d} value={d}>{d}</option>)}
                  <option value={OTHER_MARKER}>Other…</option>
                </Select>
                {selectedAddDeptVal === OTHER_MARKER && (
                  <div className="mt-1.5">
                    <input
                      type="text"
                      value={addCustomDept}
                      onChange={e => { setAddCustomDept(e.target.value); setForm(f => ({ ...f, dept: e.target.value })); }}
                      placeholder="Enter department name…"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Saved permanently — this department will appear in the dropdown for all future employees.</p>
                  </div>
                )}
              </div>
              <Input label="Designation *" placeholder="e.g. Software Engineer" value={form.designation} onChange={set('designation')} />
            </div>

            {/* Email */}
            <Input label="Company Email *" type="email" placeholder="john@company.com" value={form.email} onChange={set('email')} />

            {/* Passwords side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-sm font-medium text-slate-700">Temporary Password *</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min. 6 chars"
                    value={form.tempPw}
                    onChange={set('tempPw')}
                    className="w-full px-3 py-2 pr-9 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
                    {showPw ? '🙈' : '👁'}
                  </button>
                </div>
              </div>
              <Input label="Confirm Password *" type={showPw ? 'text' : 'password'} placeholder="Re-enter" value={form.confirmPw} onChange={set('confirmPw')} />
            </div>

            {/* Password strength indicator */}
            {form.tempPw && (
              <div className="flex flex-col gap-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(n => (
                    <div key={n} className={`h-1.5 flex-1 rounded-full ${form.tempPw.length >= n * 2 ? n <= 2 ? 'bg-red-400' : n === 3 ? 'bg-yellow-400' : 'bg-green-500' : 'bg-slate-200'}`} />
                  ))}
                </div>
                <p className="text-xs text-slate-400">
                  {form.tempPw.length < 4 ? 'Too short' : form.tempPw.length < 6 ? 'Weak' : form.tempPw.length < 8 ? 'Fair' : 'Strong'}
                  {form.tempPw.length > 0 && form.tempPw.length < 8 && (
                    <span className="ml-2 text-red-500 font-medium">· Min. 8 chars required</span>
                  )}
                </p>
              </div>
            )}

            {/* Error banner (sticky so it's always visible) */}
            {error && (
              <div ref={formBodyRef} className="sticky top-0 z-20 flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl shadow-sm">
                <span className="text-red-500 text-base">⚠</span>
                <p className="text-xs text-red-700 leading-relaxed flex-1">{error}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-slate-50/50">
            <Btn variant="secondary" onClick={() => setStep('table')} className="flex-1 justify-center">Cancel</Btn>
            <Btn onClick={handleAdd} loading={adding} className="flex-1 justify-center">
              {adding ? 'Creating…' : 'Create Account'}
            </Btn>
          </div>
        </FormModal>
      )}

      {/* ── Confirmation ── */}
      {step === 'confirmed' && created && (
        <FormModal onClose={() => setStep('table')}>
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-5 flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-white text-lg">✓</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Account Created</h2>
                <p className="text-green-100 text-xs mt-0.5">Credentials are ready to share with the employee</p>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 space-y-4">
            {/* Credential card */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-100 border-b border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Login Credentials</p>
              </div>
              <div className="px-4 py-3 space-y-3">
                {[
                  { label: 'Employee Name', value: created.name },
                  { label: 'Employee ID', value: created.id, mono: true },
                  { label: 'Company Email', value: created.email },
                  { label: 'Temporary Password', value: created.tempPassword, mono: true },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="text-xs text-slate-500">{row.label}</span>
                    <span className={`text-sm font-medium text-slate-800 ${row.mono ? 'font-mono' : ''}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">
              The employee will be required to change the temporary password on their first login. Share these credentials securely.
            </p>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-slate-50/50">
            <Btn variant="secondary" onClick={copyCredentials} className="flex-1 justify-center gap-2">
              {copied ? '✓ Copied!' : '⎘ Copy Credentials'}
            </Btn>
            <Btn onClick={() => setStep('table')} className="flex-1 justify-center">Done</Btn>
          </div>
        </FormModal>
      )}

      {/* ── Reset Password ── */}
      {step === 'reset-pw' && resetTarget && (
        <FormModal onClose={() => setStep('table')}>
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex items-start justify-between flex-shrink-0">
            <div>
              <h2 className="text-lg font-semibold text-white">Reset Password</h2>
              <p className="text-blue-100 text-xs mt-0.5">{resetTarget.name} · {resetTarget.id}</p>
            </div>
            <button onClick={() => setStep('table')} className="text-blue-200 hover:text-white leading-none mt-0.5 transition-colors">{ICO.close()}</button>
          </div>

          <div className="px-6 py-5 space-y-4">
            <p className="text-sm text-slate-600">
              Set a new temporary password. The employee will be required to change it on their next login.
            </p>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-slate-700">New Temporary Password *</label>
              <div className="relative">
                <input
                  type={showNewPw ? 'text' : 'password'}
                  placeholder="Min. 8 characters"
                  value={newTempPw}
                  onChange={e => setNewTempPw(e.target.value)}
                  className="w-full px-3 py-2 pr-9 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button type="button" onClick={() => setShowNewPw(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs">
                  {showNewPw ? '🙈' : '👁'}
                </button>
              </div>
              {newTempPw && newTempPw.length < 8 && (
                <p className="text-xs text-red-500">Password must be at least 8 characters.</p>
              )}
            </div>
            {editError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                <span className="text-red-500 text-sm">⚠</span>
                <p className="text-xs text-red-700">{editError}</p>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-slate-50/50">
            <Btn variant="secondary" onClick={() => setStep('table')} className="flex-1 justify-center">Cancel</Btn>
            <Btn onClick={handleResetPassword} loading={resetPwLoading} className="flex-1 justify-center">
              {resetPwLoading ? 'Saving…' : 'Reset Password'}
            </Btn>
          </div>
        </FormModal>
      )}

      {/* ── Reset Done ── */}
      {step === 'reset-done' && resetTarget && (
        <FormModal onClose={() => setStep('table')}>
          <div className="px-6 py-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <span className="text-green-600 text-2xl">✓</span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">Password Reset Successfully</h3>
              <p className="text-sm text-slate-500 mt-1">
                Provide the new temporary password to <strong>{resetTarget.name}</strong> securely.
              </p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-left">
              <p className="text-xs text-slate-500 mb-1">New Temporary Password</p>
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono font-semibold text-slate-800">{newTempPw}</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(newTempPw); setPwCopied(true); setTimeout(() => setPwCopied(false), 2000); }}
                  title="Copy password"
                  className="flex-shrink-0 p-1.5 rounded-md hover:bg-slate-200 transition-colors text-slate-400 hover:text-slate-700"
                >
                  {pwCopied ? (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-600"><polyline points="20 6 9 17 4 12"/></svg>
                  ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  )}
                </button>
              </div>
            </div>
            <Btn onClick={() => setStep('table')} className="w-full justify-center">Done</Btn>
          </div>
        </FormModal>
      )}

      {/* ── View Employee Details ── */}
      {step === 'view-details' && viewTarget && (
        <FormModal onClose={() => setStep('table')}>
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex items-start justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                <span className="text-white font-bold text-base">{viewTarget.name[0]}</span>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">{viewTarget.name}</h2>
                <p className="text-blue-100 text-xs mt-0.5">{viewTarget.id} · {viewTarget.designation}</p>
              </div>
            </div>
            <button onClick={() => setStep('table')} className="text-blue-200 hover:text-white leading-none mt-0.5 transition-colors">{ICO.close()}</button>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
            {viewMode === 'view-only' ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Full Name', value: viewTarget.name },
                    { label: 'Employee ID', value: viewTarget.id, mono: true },
                    { label: 'Company Email', value: viewTarget.email },
                    { label: 'Department', value: viewTarget.dept },
                    { label: 'Designation', value: viewTarget.designation },
                    { label: 'Role', value: viewTarget.role },
                    { label: 'Status', badge: viewTarget.status },
                    { label: 'First Login Required', value: viewTarget.firstLogin ? 'Yes' : 'No' },
                  ].map((row, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">{row.label}</label>
                      {row.badge ? (
                        <div className="mt-1"><Badge status={row.badge} /></div>
                      ) : (
                        <div className={`px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-700 ${row.mono ? 'font-mono' : ''}`}>{row.value || '—'}</div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex gap-3 pt-1">
                  <Btn variant="primary" className="flex-1 justify-center gap-2" onClick={() => {
                    const fresh = employees.find(e => e.id === viewTarget?.id) || viewTarget;
                    if (fresh) {
                      setEditTargetId(fresh.id);
                      setEditForm({
                        name: fresh.name,
                        email: fresh.email,
                        dept: fresh.dept,
                        designation: fresh.designation,
                        role: fresh.role as 'Employee' | 'Admin',
                        status: fresh.status as 'Active' | 'Inactive',
                      });
                    }
                    setEditCustomDept('');
                    setEditError('');
                    setViewMode('editing');
                  }}>
                    {ICO.edit('currentColor')} Edit Employee
                  </Btn>
                  <Btn variant="danger" className="flex-1 justify-center gap-2" onClick={() => { const proceed = confirm(`Permanently DELETE ${viewTarget.name} (${viewTarget.id})? This cannot be undone.`); if (!proceed) return; api.deleteEmployee(viewTarget.id).then(r => { if (r.ok) { setEmployees(prev => prev.filter(e => e.id !== viewTarget.id)); setStep('table'); } else { alert(r.error || 'Failed to delete employee.'); } }); }}>
                    {ICO.trash('currentColor')} Delete
                  </Btn>
                </div>
              </>
            ) : (
              <>
                {/* In-place editable form inside view modal */}
                <div>
                  <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl mb-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Employee ID</p>
                      <p className="font-mono font-semibold text-slate-800 text-sm">{viewTarget.id}</p>
                    </div>
                    <span className="text-xs bg-slate-200 text-slate-500 px-2 py-1 rounded-full">Read-only</span>
                  </div>
                </div>
                <Input label="Full Name *" value={editForm.name} onChange={setEdit('name')} />
                <Input label="Company Email *" type="email" value={editForm.email} onChange={setEdit('email')} />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Select label="Department" value={selectedEditDeptVal} onChange={handleEditDeptChange}>
                      {depts.map(d => <option key={d} value={d}>{d}</option>)}
                      <option value={OTHER_MARKER}>Other…</option>
                    </Select>
                    {selectedEditDeptVal === OTHER_MARKER && (
                      <div className="mt-1.5">
                        <input
                          type="text"
                          value={editCustomDept}
                          onChange={e => { setEditCustomDept(e.target.value); setEditForm(f => ({ ...f, dept: e.target.value })); }}
                          placeholder="Enter department name…"
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    )}
                  </div>
                  <Input label="Designation *" value={editForm.designation} onChange={setEdit('designation')} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Select label="Role" value={editForm.role} onChange={setEdit('role')}>
                    <option value="Employee">Employee</option>
                    <option value="Admin">Admin</option>
                  </Select>
                  <Select label="Status" value={editForm.status} onChange={setEdit('status')}>
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </Select>
                </div>
                {editError && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                    <span className="text-red-500 text-sm">⚠</span>
                    <p className="text-xs text-red-700">{editError}</p>
                  </div>
                )}
                <div className="flex gap-3 pt-1">
                  <Btn variant="secondary" className="flex-1 justify-center" onClick={() => { setEditError(''); setViewMode('view-only'); }}>Cancel</Btn>
                  <Btn className="flex-1 justify-center" loading={saveEditLoading} onClick={saveEdit}>
                    {saveEditLoading ? 'Saving…' : 'Save Changes'}
                  </Btn>
                </div>
              </>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-slate-50/50">
            <Btn variant="secondary" onClick={() => setStep('table')} className="w-full justify-center">Close</Btn>
          </div>
        </FormModal>
      )}

      {/* ── Edit Employee Form ── */}
      {step === 'edit-form' && editTarget && (
        <FormModal onClose={() => setStep('table')}>
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 flex items-start justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
                {ICO.edit('#fff')}
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white">Edit Employee</h2>
                <p className="text-blue-100 text-xs mt-0.5">{editTarget.id} · Updating account details</p>
              </div>
            </div>
            <button onClick={() => setStep('table')} className="text-blue-200 hover:text-white leading-none mt-0.5 transition-colors">{ICO.close()}</button>
          </div>

          <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl">
              <div>
                <p className="text-xs text-slate-500 mb-0.5">Employee ID</p>
                <p className="font-mono font-semibold text-slate-800 text-sm">{editTarget.id}</p>
              </div>
              <span className="text-xs bg-slate-200 text-slate-500 px-2 py-1 rounded-full">Read-only</span>
            </div>

            <Input label="Full Name *" value={editForm.name} onChange={setEdit('name')} />
            <Input label="Company Email *" type="email" value={editForm.email} onChange={setEdit('email')} />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Select label="Department" value={selectedEditDeptVal} onChange={handleEditDeptChange}>
                  {depts.map(d => <option key={d} value={d}>{d}</option>)}
                  <option value={OTHER_MARKER}>Other…</option>
                </Select>
                {selectedEditDeptVal === OTHER_MARKER && (
                  <div className="mt-1.5">
                    <input
                      type="text"
                      value={editCustomDept}
                      onChange={e => { setEditCustomDept(e.target.value); setEditForm(f => ({ ...f, dept: e.target.value })); }}
                      placeholder="Enter department name…"
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">Saved permanently — will appear in all department dropdowns.</p>
                  </div>
                )}
              </div>
              <Input label="Designation *" value={editForm.designation} onChange={setEdit('designation')} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Select label="Role" value={editForm.role} onChange={setEdit('role')}>
                <option value="Employee">Employee</option>
                <option value="Admin">Admin</option>
              </Select>
              <Select label="Status" value={editForm.status} onChange={setEdit('status')}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </Select>
            </div>

            {editError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
                <span className="text-red-500 text-sm">⚠</span>
                <p className="text-xs text-red-700">{editError}</p>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-t border-slate-100 flex gap-3 flex-shrink-0 bg-slate-50/50">
            <Btn variant="secondary" onClick={() => setStep('table')} className="flex-1 justify-center">Cancel</Btn>
            <Btn onClick={saveEdit} className="flex-1 justify-center">Save Changes</Btn>
          </div>
        </FormModal>
      )}

      {/* ── Edit Done ── */}
      {step === 'edit-done' && editTarget && (
        <FormModal onClose={() => setStep('table')}>
          <div className="px-6 py-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <span className="text-green-600 text-2xl">✓</span>
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-800">Employee Updated</h3>
              <p className="text-sm text-slate-500 mt-1">
                Changes to <strong>{editForm.name}</strong> ({editTarget.id}) were saved successfully.
              </p>
            </div>
            <Btn onClick={() => { const fresh = employees.find(e => e.id === editTarget?.id); if (fresh) { setViewTargetId(fresh.id); setStep('view-details'); } else { setStep('table'); } }} className="w-full justify-center">
              View Updated Details
            </Btn>
            <Btn variant="secondary" onClick={() => setStep('table')} className="w-full justify-center">Back to Table</Btn>
          </div>
        </FormModal>
      )}
    </div>
  );
}
