import { useState } from 'react';
import { useData } from '../context/DataContext';
import { hashPw } from '../utils/crypto';
import { api } from '../utils/api';
import { Input, Btn } from '../components/ui';

type Props = {
  onLogin: (role: 'employee' | 'admin', empId: string, name: string, firstLogin: boolean, dbWarn?: string | null) => void;
  onForgotPassword: () => void;
};

export default function Login({ onLogin, onForgotPassword }: Props) {
  const { employees } = useData();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email || !password) { setError('Please enter your email and password.'); return; }

    setLoading(true);
    try {
      const res = await api.login(email, password);
      if (res.ok) {
        api.setToken(res.data.token);
        onLogin(res.data.role, res.data.empId, res.data.name, res.data.firstLogin, res.data._dbWarn ?? null);
        return;
      }
      setError(res.error || 'Login failed');
    } catch {
      const hashed = hashPw(password);
      if (email === 'admin@company.com' && hashed === hashPw('Admin@Sync0!')) {
        onLogin('admin', 'ADMIN', 'Admin User', false);
        return;
      }
      const emp = employees.find(e => e.email.toLowerCase() === email.toLowerCase());
      if (!emp) { setError('No account found with this email.'); setLoading(false); return; }
      if (emp.status === 'Inactive') { setError('This account has been deactivated. Contact your Admin.'); setLoading(false); return; }
      const expectedHash = emp.firstLogin ? hashPw(emp.tempPassword) : emp.password;
      if (hashed !== expectedHash) { setError('Incorrect password. Please try again.'); setLoading(false); return; }
      if (emp.role === 'Admin') onLogin('admin', emp.id, emp.name, emp.firstLogin);
      else onLogin('employee', emp.id, emp.name, emp.firstLogin);
    } finally {
      setLoading(false);
    }
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
          <p className="text-slate-500 text-sm mt-1">Employee Attendance Portal</p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-slate-800 mb-5">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Company Email"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />

            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
            )}

            <div className="text-right">
              <button type="button" onClick={onForgotPassword} className="text-xs text-blue-600 hover:underline">
                Forgot password?
              </button>
            </div>

            <Btn type="submit" className="w-full justify-center py-2.5" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Btn>
          </form>

          <div className="mt-5 p-3 bg-slate-50 rounded-lg text-xs text-slate-500 space-y-1">
            <p className="font-medium text-slate-600">Demo credentials:</p>
            <p>Employee: <span className="font-mono">sarah@company.com</span> / <span className="font-mono">Sarah@Sync1!</span></p>
            <p>Admin: <span className="font-mono">admin@company.com</span> / <span className="font-mono">Admin@Sync0!</span></p>
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Access is provided by your company administrator.
        </p>
      </div>
    </div>
  );
}
