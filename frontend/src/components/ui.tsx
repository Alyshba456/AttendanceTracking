import { ReactNode } from 'react';

export function Badge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    present: 'bg-green-100 text-green-700',
    approved: 'bg-green-100 text-green-700',
    absent: 'bg-red-100 text-red-700',
    rejected: 'bg-red-100 text-red-700',
    pending: 'bg-yellow-100 text-yellow-700',
    late: 'bg-orange-100 text-orange-700',
    overtime: 'bg-violet-100 text-violet-700',
    active: 'bg-green-100 text-green-700',
    inactive: 'bg-gray-100 text-gray-500',
    'field work': 'bg-blue-100 text-blue-700',
    leave: 'bg-purple-100 text-purple-700',
  };
  const cls = variants[status.toLowerCase()] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {status}
    </span>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function Avatar({ name, size = 'md', className = '' }: { name: string; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const sizes = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-9 h-9 text-sm',
    lg: 'w-10 h-10 text-sm',
    xl: 'w-14 h-14 text-base',
  };
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const palette = ['bg-indigo-600', 'bg-blue-600', 'bg-sky-600', 'bg-violet-600', 'bg-purple-600', 'bg-fuchsia-600', 'bg-pink-600', 'bg-rose-600', 'bg-orange-600', 'bg-amber-600', 'bg-emerald-600', 'bg-teal-600'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const bg = palette[hash % palette.length];
  return (
    <div className={`${sizes[size]} rounded-full ${bg} text-white font-semibold flex items-center justify-center flex-shrink-0 ${className}`}>
      {initial}
    </div>
  );
}

export function EmployeeCell({ name, sub }: { name: string; sub?: string }) {
  return (
    <div className="flex items-center gap-3 min-w-[200px]">
      <Avatar name={name} size="md" />
      <div className="min-w-0">
        <p className="font-medium text-slate-800 text-sm truncate">{name}</p>
        {sub !== undefined && sub !== '' && <p className="text-xs text-slate-500 truncate">{sub}</p>}
      </div>
    </div>
  );
}

export function StatCard({ label, value, sub, color = 'blue' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const accent: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    red: 'bg-red-50 text-red-600',
    yellow: 'bg-yellow-50 text-yellow-600',
    purple: 'bg-purple-50 text-purple-600',
    slate: 'bg-slate-50 text-slate-600',
  };
  return (
    <Card className="p-5">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent[color]?.split(' ')[1] ?? 'text-slate-800'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </Card>
  );
}

export function Btn({
  children, onClick, variant = 'primary', size = 'md', className = '', type = 'button', disabled = false, loading = false,
}: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string; type?: 'button' | 'submit'; disabled?: boolean; loading?: boolean;
}) {
  const base = 'inline-flex items-center gap-1.5 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1';
  const sizes = { xs: 'px-2 py-1 text-[11px]', sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-400',
    danger: 'bg-red-100 text-red-700 hover:bg-red-200 focus:ring-red-400 disabled:bg-red-50 disabled:text-red-400',
    ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 focus:ring-slate-400 disabled:text-slate-400',
    success: 'bg-green-100 text-green-700 hover:bg-green-200 focus:ring-green-400 disabled:bg-green-50 disabled:text-green-400',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`${base} ${sizes[size]} ${variants[variant]} ${(disabled || loading) ? 'cursor-not-allowed opacity-70' : ''} ${className}`}
    >
      {loading && (
        <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-b-transparent align-middle"></span>
      )}
      {children}
    </button>
  );
}

export function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        {...props}
        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
      />
    </div>
  );
}

export function Select({ label, children, ...props }: { label: string } & React.SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <select
        {...props}
        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
      >
        {children}
      </select>
    </div>
  );
}

export function DateField({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type="date"
        {...props}
        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700"
      />
    </div>
  );
}

export function Textarea({ label, ...props }: { label: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <textarea
        {...props}
        rows={3}
        className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />
    </div>
  );
}

export function Table({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            {headers.map(h => (
              <th key={h} className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wide py-3 px-4 first:pl-5 last:pr-5">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function TR({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <tr className={`border-b border-slate-50 hover:bg-slate-50 transition-colors ${className}`}>
      {children}
    </tr>
  );
}

export function TD({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <td className={`py-3 px-4 first:pl-5 last:pr-5 text-slate-700 ${className}`}>{children}</td>
  );
}

/* ---------- Toast Banner ---------- */
export function Banner({
  tone = 'info',
  message,
  onDismiss,
}: {
  tone?: 'info' | 'success' | 'danger' | 'warning';
  message: string;
  onDismiss?: () => void;
}) {
  const tones = {
    info: 'bg-blue-50 text-blue-700 border-blue-200',
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    danger: 'bg-red-50 text-red-700 border-red-200',
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
  } as const;
  return (
    <div className={`w-full border rounded-xl px-4 py-3 flex items-center justify-between gap-3 text-sm ${tones[tone]}`}>
      <div className="flex-1 whitespace-pre-wrap leading-relaxed">{message}</div>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="opacity-60 hover:opacity-100 text-base leading-none font-bold px-2 py-1">×</button>
      )}
    </div>
  );
}

/* ---------- Modal ---------- */
export function Modal({ title, onClose, children, maxWidthClass }: { title: string; onClose: () => void; children: ReactNode; maxWidthClass?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <Card className={`relative z-10 w-full ${maxWidthClass || 'max-w-md'} shadow-xl overflow-hidden`}>
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-5 py-4 flex items-start justify-between flex-shrink-0">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="text-blue-200 hover:text-white leading-none transition-colors -mt-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="p-5">
          {children}
        </div>
      </Card>
    </div>
  );
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      {action}
    </div>
  );
}
