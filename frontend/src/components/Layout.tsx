import { ReactNode, useState, useEffect, useRef } from 'react';
import { useData, NotificationItem } from '../context/DataContext';

function Icon({ d, filled = false }: { d: string | string[]; filled?: boolean }) {
  const paths = Array.isArray(d) ? d : [d];
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      className="flex-shrink-0"
    >
      {paths.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  dashboard: <Icon d={['M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z', 'M9 22V12h6v10']} />,
  employees: <Icon d={['M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2', 'M9 7a4 4 0 108 0 4 4 0 00-8 0', 'M23 21v-2a4 4 0 00-3-3.87', 'M16 3.13a4 4 0 010 7.75']} />,
  attendance: <Icon d={['M9 11l3 3L22 4', 'M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11']} />,
  fieldwork: <Icon d={['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z', 'M12 13a3 3 0 100-6 3 3 0 000 6z']} />,
  leaves: <Icon d={['M8 6h13', 'M8 12h13', 'M8 18h13', 'M3 6h.01', 'M3 12h.01', 'M3 18h.01']} />,
  report:  <Icon d={['M18 20V10', 'M12 20V4', 'M6 20v-6']} />,
  reports: <Icon d={['M18 20V10', 'M12 20V4', 'M6 20v-6']} />,
  profile: <Icon d={['M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2', 'M12 11a4 4 0 100-8 4 4 0 000 8z']} />,
  settings: <Icon d={['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z']} />,
  logout: <Icon d={['M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4', 'M16 17l5-5-5-5', 'M21 12H9']} />,
  menu: <Icon d={['M3 6h18', 'M3 12h18', 'M3 18h18']} />,
  close: <Icon d={['M18 6L6 18', 'M6 6l12 12']} />,
};

type NavItem = { label: string; key: string };

const employeeNav: NavItem[] = [
  { label: 'Dashboard', key: 'dashboard' },
  { label: 'Attendance', key: 'attendance' },
  { label: 'Field Work', key: 'fieldwork' },
  { label: 'Leaves', key: 'leaves' },
  { label: 'Monthly Report', key: 'report' },
  { label: 'Profile', key: 'profile' },
];

const adminNav: NavItem[] = [
  { label: 'Dashboard', key: 'dashboard' },
  { label: 'Employees', key: 'employees' },
  { label: 'Attendance', key: 'attendance' },
  { label: 'Field Work', key: 'fieldwork' },
  { label: 'Leaves', key: 'leaves' },
  { label: 'Reports', key: 'reports' },
  { label: 'Settings', key: 'settings' },
];

function StatusChip({ s }: { s: 'Pending' | 'Approved' | 'Rejected' }) {
  const map = {
    Pending:  'bg-amber-50 text-amber-700 border-amber-200',
    Approved: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    Rejected: 'bg-red-50 text-red-700 border-red-200',
  } as const;
  const dot = {
    Pending:  'bg-amber-500',
    Approved: 'bg-emerald-500',
    Rejected: 'bg-red-500',
  } as const;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border ${map[s]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[s]}`} />{s}
    </span>
  );
}

function KindIcon({ kind }: { kind: NotificationItem['kind'] }) {
  if (kind === 'leave_pending' || kind === 'leave_decision') {
    return (
      <div className="w-9 h-9 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><circle cx="3" cy="6" r="1"/><circle cx="3" cy="12" r="1"/><circle cx="3" cy="18" r="1"/></svg>
      </div>
    );
  }
  return (
    <div className="w-9 h-9 rounded-full bg-violet-50 text-violet-600 flex items-center justify-center flex-shrink-0">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
    </div>
  );
}

function NotifListEmpty({ role }: { role: 'employee' | 'admin' }) {
  const text = role === 'admin'
    ? 'No pending requests right now — you\'re all caught up!'
    : 'No new notifications yet. New decisions on your requests will appear here.';
  return (
    <div className="flex flex-col items-center justify-center py-10 px-6 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
      </div>
      <p className="text-sm font-medium text-slate-700">All caught up</p>
      <p className="text-xs text-slate-500 mt-1 max-w-xs leading-relaxed">{text}</p>
    </div>
  );
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="8" fill="#2563EB" />
      <path d="M8 14a6 6 0 1112 0" stroke="white" strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="14" r="2.5" fill="white" />
      <path d="M14 16.5v4" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function Sidebar({
  nav, page, setPage, onLogout, role, onClose,
}: {
  nav: NavItem[]; page: string; setPage: (p: string) => void;
  onLogout: () => void; role: 'employee' | 'admin';
  onClose?: () => void;
}) {
  return (
    <div className="h-full w-56 flex-shrink-0 bg-slate-900 flex flex-col">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <Logo />
          <div>
            <p className="text-white text-sm font-semibold leading-tight">StaffSync</p>
            <p className="text-slate-500 text-xs capitalize">{role} Portal</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <p className="text-slate-600 text-xs font-semibold uppercase tracking-widest px-2 mb-2">Menu</p>
        <ul className="space-y-0.5">
          {nav.map(item => (
            <li key={item.key}>
              <button
                onClick={() => { setPage(item.key); onClose?.(); }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                  page === item.key
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`}
              >
                {ICONS[item.key]}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="px-3 py-4 border-t border-slate-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors"
        >
          {ICONS.logout}
          Logout
        </button>
      </div>
    </div>
  );
}

export default function Layout({
  role, page, setPage, onLogout, userName, children,
}: {
  role: 'employee' | 'admin';
  page: string;
  setPage: (p: string) => void;
  onLogout: () => void;
  userName: string;
  children: ReactNode;
}) {
  const nav = role === 'admin' ? adminNav : employeeNav;
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { notifications, notificationCount, markAllNotificationsViewed, isNotificationNew } = useData();
  const notifWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (notifOpen) {
      const t = setTimeout(() => markAllNotificationsViewed(), 400);
      return () => clearTimeout(t);
    }
  }, [notifOpen, markAllNotificationsViewed]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!notifOpen && !menuOpen) return;
      const el = e.target as Node;
      if (notifOpen && notifWrapRef.current && !notifWrapRef.current.contains(el)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [notifOpen, menuOpen]);

  const pendingLeaveCount = notifications.filter(n => n.kind === 'leave_pending').length;
  const pendingFieldWorkCount = notifications.filter(n => n.kind === 'fieldwork_pending').length;
  const totalDecisions = notifications.length - pendingLeaveCount - pendingFieldWorkCount;

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const pageLabel = nav.find(n => n.key === page)?.label ?? 'Portal';

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Desktop sidebar */}
      {!isMobile && (
        <Sidebar nav={nav} page={page} setPage={setPage} onLogout={onLogout} role={role} />
      )}

      {/* Mobile nav overlay */}
      {isMobile && mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="shrink-0 animate-[slideIn_0.2s_ease-out]">
            <div className="absolute top-3 right-3 z-10">
              <button
                onClick={() => setMobileNavOpen(false)}
                className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700"
              >
                {ICONS.close}
              </button>
            </div>
            <Sidebar
              nav={nav} page={page} setPage={setPage}
              onLogout={() => { onLogout(); setMobileNavOpen(false); }}
              role={role}
              onClose={() => setMobileNavOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-3 md:px-6 flex-shrink-0 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isMobile && (
              <button
                onClick={() => setMobileNavOpen(true)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-600 -ml-1"
              >
                {ICONS.menu}
              </button>
            )}
            <h1 className="text-base font-semibold text-slate-800 truncate">{pageLabel}</h1>
          </div>
          <div className="flex items-center gap-2 md:gap-3 shrink-0">
            <div ref={notifWrapRef} className="relative">
              <button
                onClick={() => { setNotifOpen(v => !v); setMenuOpen(false); }}
                className={`relative text-slate-500 hover:text-slate-700 p-1.5 rounded-lg transition-colors ${notifOpen ? 'bg-slate-100 text-slate-800' : 'hover:bg-slate-100'}`}
                aria-label={`${notificationCount} notifications`}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 01-3.46 0" />
                </svg>
                {notificationCount > 0 && (
                  <span className={`absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full text-white text-[10px] font-bold flex items-center justify-center shadow-sm ${notificationCount > 99 ? 'bg-rose-600' : 'bg-red-500'}`}>
                    {notificationCount > 99 ? '99+' : String(notificationCount).padStart(2, '0')}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-full mt-2 w-[calc(100vw-2rem)] sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  {/* Header */}
                  <div className="px-5 py-4 bg-slate-50/60 border-b border-slate-100 flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-900">Notifications</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {role === 'admin'
                          ? notifications.length > 0
                            ? `${pendingLeaveCount} leave request${pendingLeaveCount === 1 ? '' : 's'} · ${pendingFieldWorkCount} field work request${pendingFieldWorkCount === 1 ? '' : 's'}`
                            : 'No pending requests awaiting your review.'
                          : notifications.length > 0
                            ? `${totalDecisions} update${totalDecisions === 1 ? '' : 's'} on your request${totalDecisions === 1 ? '' : 's'}.`
                            : 'No new updates on your requests yet.'}
                      </p>
                    </div>
                    {notificationCount > 0 && (
                      <button
                        onClick={() => setNotifOpen(false)}
                        className="text-[11px] text-slate-500 hover:text-blue-600 font-medium px-2 py-1 rounded-md hover:bg-white transition-colors"
                      >
                        Dismiss
                      </button>
                    )}
                  </div>

                  {/* Summary strip (admin: pending counts) */}
                  {role === 'admin' && notificationCount > 0 && (
                    <div className="px-5 pt-4 pb-2 grid grid-cols-2 gap-3">
                      <div className={`rounded-xl border p-3 ${pendingLeaveCount ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                        <p className={`text-[11px] font-medium uppercase tracking-wide ${pendingLeaveCount ? 'text-blue-600' : 'text-slate-400'}`}>Pending Leaves</p>
                        <p className={`text-xl font-bold mt-0.5 ${pendingLeaveCount ? 'text-blue-700' : 'text-slate-400'}`}>{pendingLeaveCount}</p>
                      </div>
                      <div className={`rounded-xl border p-3 ${pendingFieldWorkCount ? 'bg-violet-50 border-violet-100' : 'bg-slate-50 border-slate-100'}`}>
                        <p className={`text-[11px] font-medium uppercase tracking-wide ${pendingFieldWorkCount ? 'text-violet-600' : 'text-slate-400'}`}>Pending Field Work</p>
                        <p className={`text-xl font-bold mt-0.5 ${pendingFieldWorkCount ? 'text-violet-700' : 'text-slate-400'}`}>{pendingFieldWorkCount}</p>
                      </div>
                    </div>
                  )}

                  {/* Notifications list */}
                  {notifications.length === 0 ? (
                    <NotifListEmpty role={role} />
                  ) : (
                    <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100">
                      {notifications.map(n => {
                        const isNew = isNotificationNew(n.id);
                        return (
                          <div key={n.id}
                            className={`px-5 py-4 flex gap-3 transition-colors cursor-pointer border-l-4 ${isNew ? 'bg-slate-100/80 border-l-indigo-500 hover:bg-slate-100' : 'bg-white border-l-transparent hover:bg-slate-50/70'}`}
                            onClick={() => setNotifOpen(false)}>
                            <div className="relative shrink-0">
                              <KindIcon kind={n.kind} />
                              {isNew && (
                                <span className="absolute -top-0.5 -left-0.5 w-2.5 h-2.5 rounded-full bg-indigo-600 border-2 border-white shadow-sm" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className={`text-sm leading-snug ${isNew ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>{n.title}</p>
                                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">{n.subtitle}</p>
                                </div>
                                <StatusChip s={n.status} />
                              </div>
                              <p className="text-[11px] text-slate-400 mt-2">
                                {isNew && <span className="mr-2 inline-flex items-center gap-1 text-indigo-600 font-semibold"><span className="w-1 h-1 rounded-full bg-indigo-600" /> NEW</span>}
                                {n.date}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Footer */}
                  <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
                    <span>
                      {role === 'admin'
                        ? 'Review in Leaves & Field Work pages.'
                        : 'Check Leave / Field Work tabs for details.'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => { setMenuOpen(v => !v); setNotifOpen(false); }}
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center">
                  <span className="text-white text-xs font-medium">{userName[0]?.toUpperCase()}</span>
                </div>
                <span className="text-sm font-medium text-slate-700 hidden sm:inline">{userName}</span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-20">
                    <button
                      onClick={() => { setPage('profile'); setMenuOpen(false); setMobileNavOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      Profile
                    </button>
                    <button
                      onClick={() => { onLogout(); setMenuOpen(false); setMobileNavOpen(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-slate-50"
                    >
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-3 md:p-6">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      <style>{`
        @keyframes slideIn {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
