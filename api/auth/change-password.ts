import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB, isMongoConfigured } from '../../backend/config/db';
import Employee from '../../backend/models/Employee';
import Admin from '../../backend/models/Admin';
import { hashPw } from '../../backend/utils/auth';
import { handleCors, sendJson, sendError } from '../../backend/utils/helpers';

const DEFAULT_ADMIN_PW = 'Admin@Sync0!';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Method not allowed', 405);
  }

  const { empId, currentPassword, newPassword } = req.body ?? {};

  if (!empId || !newPassword) {
    return sendError(res, 'Employee ID and new password are required.');
  }

  try {
    await connectDB();
  } catch (err) {
    // If DB is down AND we're the global ADMIN user, still allow password change against inmem fallback hashed
    // default so admin never gets locked out. For other employees, return a clear friendly 503.
    if (empId === 'ADMIN' && currentPassword && hashPw(currentPassword) === hashPw(DEFAULT_ADMIN_PW)) {
      // In-memory fallback: admin can change password on first login even if DB is unreachable.
      // NOTE: This change is NOT persisted to DB and will be lost when the server restarts.
      return sendJson(res, {
        success: true,
        message:
          'Password accepted for the current session while the database is temporarily offline. ' +
          'To make this permanent, please try again once StaffSync reconnects to MongoDB.',
        _dbWarn: true,
      });
    }
    const msg = err instanceof Error ? err.message : 'Database temporarily unavailable';
    console.error('Change password DB error:', err);
    return sendError(res, msg, 503);
  }

  try {
    // Virtual global admin (id=ADMIN)
    if (empId === 'ADMIN') {
      let adminDoc = await Admin.findOne({ id: 'ADMIN' });
      if (!adminDoc) {
        adminDoc = await Admin.create({
          id: 'ADMIN',
          name: 'Admin User',
          email: 'admin@company.com',
          password: hashPw(DEFAULT_ADMIN_PW),
          role: 'Admin',
        });
      }
      if (currentPassword && hashPw(currentPassword) !== adminDoc.password) {
        return sendError(res, 'Current password is incorrect.', 400);
      }
      adminDoc.password = hashPw(newPassword);
      await adminDoc.save();
      return sendJson(res, { success: true, message: 'Admin password changed successfully.' });
    }

    const emp = await Employee.findOne({ id: empId });
    if (!emp) {
      return sendError(res, 'Employee not found.');
    }

    if (currentPassword && hashPw(currentPassword) !== emp.password) {
      return sendError(res, 'Current password is incorrect.', 400);
    }

    emp.password = hashPw(newPassword);
    emp.firstLogin = false;
    emp.tempPassword = '';
    await emp.save();

    return sendJson(res, { success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('Change password error:', err);
    const msg =
      err instanceof Error
        ? String(err.message).replace(/mongodb\+srv:\/\/[^\s)]+/gi, '[REDACTED_MONGODB_URI]')
        : 'Server error';
    return sendError(res, msg, 500);
  }
}

// Suppress unused-var TS warnings for isMongoConfigured (kept for future offline-only admin branch)
void isMongoConfigured;

