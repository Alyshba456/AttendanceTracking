import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../../backend/config/db';
import Employee from '../../backend/models/Employee';
import { handleCors, sendJson, sendError } from '../../backend/utils/helpers';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Method not allowed', 405);
  }

  const { email } = req.body ?? {};

  if (!email) {
    return sendError(res, 'Email is required.');
  }

  try {
    await connectDB();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database temporarily unavailable';
    console.error('Forgot password DB connect error:', err);
    return sendError(res, msg, 503);
  }

  try {
    const emp = await Employee.findOne({ email: email.toLowerCase() });
    if (!emp) {
      return sendJson(res, {
        success: true,
        message: 'If this email exists, a temporary password has been generated. (No account matched this email in our system.)',
      });
    }

    const tempPw = crypto.randomBytes(4).toString('hex') + '!A1';
    emp.tempPassword = tempPw;
    emp.firstLogin = true;
    await emp.save();

    return sendJson(res, {
      success: true,
      message: 'A temporary password has been generated. Please check your email (demo mode: password shown below for testing).',
      demoTempPassword: tempPw,
    });
  } catch (err) {
    console.error('Forgot password error:', err);
    const msg =
      err instanceof Error
        ? String(err.message).replace(/mongodb\+srv:\/\/[^\s)]+/gi, '[REDACTED_MONGODB_URI]')
        : 'Server error';
    return sendError(res, msg, 500);
  }
}
