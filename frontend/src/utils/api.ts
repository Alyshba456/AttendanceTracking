const ENV_API_BASE = (import.meta as any).env?.VITE_API_URL;
const DEFAULT_BASE = '/api';

function stripTrailing(url: string): string {
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

const API_BASE = ENV_API_BASE
  ? stripTrailing(String(ENV_API_BASE))
  : DEFAULT_BASE;

function getToken(): string | null {
  return localStorage.getItem('ss_token');
}

function setToken(token: string | null) {
  if (token) localStorage.setItem('ss_token', token);
  else localStorage.removeItem('ss_token');
}

async function request<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ ok: boolean; data: T; error?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  try {
    const url = API_BASE + path;
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: API_BASE.startsWith('http') ? 'include' : 'same-origin',
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, data: null as any, error: data.error || `HTTP ${res.status}` };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, data: null as any, error: (e as Error).message || 'Network error' };
  }
}

export const api = {
  getToken,
  setToken,
  clearToken: () => setToken(null),

  login: (email: string, password: string) =>
    request<{ token: string; role: 'admin' | 'employee'; empId: string; name: string; firstLogin: boolean; _dbWarn?: string }>(
      '/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) }
    ),

  changePassword: (empId: string, newPassword: string, currentPassword?: string) =>
    request<{ success: boolean }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ empId, newPassword, currentPassword }),
    }),

  forgotPassword: (email: string) =>
    request<{ success: boolean; demoTempPassword?: string }>('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  seedDB: (force = false) =>
    request(`/seed${force ? '?force=true' : ''}`, { method: 'GET' }),

  getEmployees: (empId?: string) =>
    request(`/employees${empId ? `?empId=${empId}` : ''}`, { method: 'GET' }),

  createEmployee: (data: any) =>
    request('/employees', { method: 'POST', body: JSON.stringify(data) }),

  updateEmployee: (data: any) =>
    request('/employees', { method: 'PUT', body: JSON.stringify(data) }),

  appendEmployeeRemark: (id: string, text: string, createdBy?: string) =>
    request('/employees', { method: 'PATCH', body: JSON.stringify({ id, action: 'appendRemark', text, createdBy }) }),

  deleteEmployee: (id: string) =>
    request('/employees', { method: 'DELETE', body: JSON.stringify({ id }) }),

  getLeaves: (empId?: string) =>
    request(`/leaves${empId ? `?empId=${empId}` : ''}`, { method: 'GET' }),

  createLeave: (data: any) =>
    request('/leaves', { method: 'POST', body: JSON.stringify(data) }),

  updateLeave: (data: any) =>
    request('/leaves', { method: 'PATCH', body: JSON.stringify(data) }),

  getFieldWork: (empId?: string) =>
    request(`/fieldwork${empId ? `?empId=${empId}` : ''}`, { method: 'GET' }),

  createFieldWork: (data: any) =>
    request('/fieldwork', { method: 'POST', body: JSON.stringify(data) }),

  updateFieldWork: (data: any) =>
    request('/fieldwork', { method: 'PATCH', body: JSON.stringify(data) }),

  getAttendance: (empId?: string, date?: string) => {
    const qs = new URLSearchParams();
    if (empId) qs.set('empId', empId);
    if (date) qs.set('date', date);
    return request(`/attendance${qs.toString() ? '?' + qs.toString() : ''}`, { method: 'GET' });
  },

  clockIn: (empId?: string, mode?: 'Office' | 'WFH') =>
    request('/attendance', {
      method: 'POST',
      body: JSON.stringify({ action: 'clockIn', empId, mode: mode ?? 'Office' }),
    }),

  clockOut: (empId?: string, clockInTime?: string) =>
    request('/attendance', {
      method: 'POST',
      body: JSON.stringify({ action: 'clockOut', empId, clockInTime }),
    }),

  getSettings: () => request('/settings', { method: 'GET' }),

  updateSettings: (data: any) =>
    request('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
};
