import type { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCors, sendJson } from '../backend/utils/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') {
    return sendJson(res, { ok: false, error: 'Method not allowed' }, 405);
  }

  return sendJson(res, {
    ok: true,
    service: 'StaffSync Backend API',
    layout: 'monorepo (Root Directory = /)',
    node: process.version,
    region: process.env.VERCEL_REGION || 'local',
    timestamp: new Date().toISOString(),
    vercel_api_detected: true,
    endpoints: {
      health: '/api/health',
      seed: '/api/seed',
      login: 'POST /api/auth/login',
      changePassword: 'POST /api/auth/change-password',
      forgotPassword: 'POST /api/auth/forgot-password',
      employees: 'GET/POST/PUT/PATCH/DELETE /api/employees',
      attendance: 'GET/POST/PATCH /api/attendance',
      leaves: 'GET/POST/PATCH /api/leaves',
      fieldwork: 'GET/POST/PATCH /api/fieldwork',
      settings: 'GET/PATCH /api/settings',
    },
    next_steps: [
      'Open /api/health first — returns structured JSON health report (env vars, DB connectivity, Atlas ping).',
      'After /api/health shows status=healthy, open /api/seed to create the default Admin.',
      'Default admin login (post-seed): admin@company.com / Admin@Sync0!',
    ],
  }, 200);
}
