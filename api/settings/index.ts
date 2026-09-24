import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../../backend/config/db';
import CompanySettings from '../../backend/models/CompanySettings';
import { extractToken, verifyToken } from '../../backend/utils/auth';
import { handleCors, sendJson, sendError } from '../../backend/utils/helpers';

const DEFAULTS = {
  companyName: 'StaffSync',
  companyEmail: 'hr@attendtrack.com',
  companyAddress: '123 Business Ave, Makati City',
  workStartTime: '09:00',
  workEndTime: '18:00',
  leaveAllowance: 14,
  workWeek: 'Monday – Friday',
  lateBuffer: 15,
  overtimeBuffer: 30,
  customDepartments: [] as string[],
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    await connectDB();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database is temporarily unavailable';
    console.error('Settings DB connect error:', err);
    return sendError(res, msg, 503);
  }

  try {
    const token = extractToken(req.headers);
    const auth = token ? verifyToken(token) : null;

    if (req.method === 'GET') {
      let settings = await CompanySettings.findOne();
      if (!settings) {
        settings = await CompanySettings.create(DEFAULTS);
      }
      return sendJson(res, settings);
    }

    if (req.method === 'POST' || req.method === 'PATCH' || req.method === 'PUT') {
      if (!auth || auth.role !== 'Admin') {
        return sendError(res, 'Unauthorized: Admin only', 401);
      }

      let settings = await CompanySettings.findOne();
      if (!settings) {
        settings = await CompanySettings.create({ ...DEFAULTS, ...req.body });
        return sendJson(res, settings, 201);
      }

      Object.assign(settings, req.body);
      await settings.save();
      return sendJson(res, settings);
    }

    return sendError(res, 'Method not allowed', 405);
  } catch (err) {
    console.error('Settings API error:', err);
    const msg =
      err instanceof Error
        ? String(err.message).replace(/mongodb\+srv:\/\/[^\s)]+/gi, '[REDACTED_MONGODB_URI]')
        : 'Server error';
    return sendError(res, msg, 500);
  }
}
