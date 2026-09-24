import { useState } from 'react';
import { api } from '../utils/api';
import { Input, Btn } from '../components/ui';

export default function ForgotPassword({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<'email' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [demoTemp, setDemoTemp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { setError('Please enter your company email.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.forgotPassword(email);
      if (res.ok && res.data.demoTempPassword) {
        setDemoTemp(res.data.demoTempPassword);
      }
    } catch { /* fallback */ }
    setLoading(false);
    setStep('done');
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
          {step === 'email' ? (
            <>
              <h2 className="text-base font-semibold text-slate-800 mb-1">Forgot your password?</h2>
              <p className="text-sm text-slate-500 mb-5">
                Enter your company email. Your administrator will be notified to reset your credentials.
              </p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  label="Company Email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
                {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
                <Btn type="submit" className="w-full justify-center py-2.5" disabled={loading}>
                  {loading ? 'Submitting...' : 'Submit Request'}
                </Btn>
              </form>
            </>
          ) : (
            <div className="text-center py-2">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                <span className="text-green-600 text-xl">✓</span>
              </div>
              <h2 className="text-base font-semibold text-slate-800 mb-2">Request Sent</h2>
              <p className="text-sm text-slate-500 mb-3">
                Your password reset request has been sent to your administrator. They will provide you with new login credentials.
              </p>
              {demoTemp && (
                <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-left">
                  <p className="text-xs font-medium text-amber-800">Demo mode — Temporary password:</p>
                  <p className="font-mono text-sm text-amber-900 mt-1 break-all">{demoTemp}</p>
                </div>
              )}
            </div>
          )}

          <button onClick={onBack} className="w-full text-center text-sm text-blue-600 hover:underline mt-3">
            ← Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
}
