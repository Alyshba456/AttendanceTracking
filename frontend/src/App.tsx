import { useState, useEffect } from 'react';
import { useData } from './context/DataContext';
import { api } from './utils/api';
import Layout from './components/Layout';
import Login from './pages/Login';
import ForgotPassword from './pages/ForgotPassword';
import ChangePassword from './pages/ChangePassword';

import EmployeeDashboard from './pages/employee/Dashboard';
import Attendance from './pages/employee/Attendance';
import FieldWork from './pages/employee/FieldWork';
import Leaves from './pages/employee/Leaves';
import MonthlyReport from './pages/employee/MonthlyReport';
import Profile from './pages/employee/Profile';

import AdminDashboard from './pages/admin/Dashboard';
import AdminEmployees from './pages/admin/Employees';
import AdminAttendance from './pages/admin/Attendance';
import AdminFieldWork from './pages/admin/FieldWork';
import AdminLeaves from './pages/admin/Leaves';
import AdminReports from './pages/admin/Reports';
import AdminSettings from './pages/admin/Settings';

type AuthState = { role: 'employee' | 'admin'; empId: string; name: string } | null;
type Screen = 'login' | 'forgot' | 'change-password';

export default function App() {
  const { setCurrentEmpId, setAuthRole, setCompanySettings, refreshAll } = useData();
  const [auth, setAuth] = useState<AuthState>(null);
  const [screen, setScreen] = useState<Screen>('login');
  const [pendingAuth, setPendingAuth] = useState<{ empId: string; name: string } | null>(null);
  const [page, setPage] = useState('dashboard');
  const [dbWarn, setDbWarn] = useState<string | null>(null);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1]));
          if (payload.empId && payload.role) {
            const role = payload.role === 'Admin' ? 'admin' : 'employee';
            setAuth({ role, empId: payload.empId, name: payload.email?.split('@')[0] || 'User' });
            setAuthRole(payload.role === 'Admin' ? 'Admin' : 'Employee');
            setCurrentEmpId(payload.empId);
            setPage('dashboard');
            setScreen('login');
          }
        }
      } catch { /* ignore */ }
    }
  }, []);

  function handleLogin(role: 'employee' | 'admin', empId: string, name: string, firstLogin: boolean, warn?: string | null) {
    setAuthRole(role === 'admin' ? 'Admin' : 'Employee');
    setDbWarn(warn && warn.trim() ? warn : null);
    if (firstLogin) {
      setPendingAuth({ empId, name });
      setScreen('change-password');
    } else {
      setAuth({ role, empId, name });
      setCurrentEmpId(empId);
      setPage('dashboard');
      refreshAll();
    }
  }

  function handlePasswordChanged() {
    if (pendingAuth) {
      setAuthRole('Employee');
      setAuth({ role: 'employee', empId: pendingAuth.empId, name: pendingAuth.name });
      setCurrentEmpId(pendingAuth.empId);
      setPendingAuth(null);
      setPage('dashboard');
      refreshAll();
    }
    setScreen('login');
  }

  function handleLogout() {
    api.clearToken();
    setAuth(null);
    setAuthRole(null);
    setCurrentEmpId(null);
    setCompanySettings({
      companyName: 'StaffSync',
      companyEmail: 'hr@attendtrack.com',
      companyAddress: '123 Business Ave, Makati City',
      workStartTime: '09:00',
      workEndTime: '18:00',
      leaveAllowance: 14,
      workWeek: 'Monday – Friday',
      lateBuffer: 15,
      overtimeBuffer: 30,
      customDepartments: [],
    });
    setDbWarn(null);
    setScreen('login');
    setPage('dashboard');
  }

  if (!auth) {
    if (screen === 'forgot') return <ForgotPassword onBack={() => setScreen('login')} />;
    if (screen === 'change-password' && pendingAuth) {
      return (
        <ChangePassword
          empId={pendingAuth.empId}
          name={pendingAuth.name}
          onDone={handlePasswordChanged}
        />
      );
    }
    return <Login onLogin={handleLogin} onForgotPassword={() => setScreen('forgot')} />;
  }

  function renderPage() {
    const empId = auth!.empId;

    if (auth!.role === 'employee') {
      switch (page) {
        case 'dashboard':  return <EmployeeDashboard empId={empId} />;
        case 'attendance': return <Attendance empId={empId} />;
        case 'fieldwork':  return <FieldWork empId={empId} />;
        case 'leaves':     return <Leaves empId={empId} />;
        case 'report':     return <MonthlyReport empId={empId} />;
        case 'profile':    return <Profile empId={empId} />;
        default:           return <EmployeeDashboard empId={empId} />;
      }
    } else {
      switch (page) {
        case 'dashboard':  return <AdminDashboard />;
        case 'employees':  return <AdminEmployees />;
        case 'attendance': return <AdminAttendance />;
        case 'fieldwork':  return <AdminFieldWork />;
        case 'leaves':     return <AdminLeaves />;
        case 'reports':    return <AdminReports />;
        case 'settings':   return <AdminSettings />;
        default:           return <AdminDashboard />;
      }
    }
  }

  return (
    <div>
      {dbWarn && auth && (
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-900 flex items-start gap-2.5 flex-wrap">
          <span className="text-amber-600 leading-none pt-0.5 text-base flex-shrink-0">⚠</span>
          <p className="flex-1 leading-relaxed">{dbWarn}</p>
          <button
            onClick={() => setDbWarn(null)}
            className="flex-shrink-0 ml-auto text-xs text-amber-700 hover:text-amber-900 underline hover:no-underline transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
      <Layout role={auth.role} page={page} setPage={setPage} onLogout={handleLogout} userName={auth.name}>
        {renderPage()}
      </Layout>
    </div>
  );
}
