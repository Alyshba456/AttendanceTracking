import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendJson } from '../utils/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  return sendJson(res, {
    ok: true,
    service: 'StaffSync Backend API',
    layout: 'standalone-backend',
    endpoints: {
      root: '/api',
      seed: '/api/seed',
      health: '/api/health',
      login: '/api/auth/login',
      changePassword: '/api/auth/change-password',
      forgotPassword: '/api/auth/forgot-password',
      employees: '/api/employees',
      attendance: '/api/attendance',
      leaves: '/api/leaves',
      fieldwork: '/api/fieldwork',
      settings: '/api/settings',
    },
  });
}
