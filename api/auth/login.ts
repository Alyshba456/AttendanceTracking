import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB, isMongoConfigured } from '../../backend/config/db';
import Employee from '../../backend/models/Employee';
import Admin from '../../backend/models/Admin';
import { hashPw, signToken } from '../../backend/utils/auth';
import { handleCors, sendJson, sendError } from '../../backend/utils/helpers';

const DEFAULT_ADMIN_EMAIL = 'admin@company.com';
const DEFAULT_ADMIN_PW = 'Admin@Sync0!';

/**
 * Get or create the admin account.
 * - If MongoDB configured and reachable → uses Admin document from `admins` collection.
 * - If MongoDB is configured but currently unreachable (new Wi-Fi not whitelisted etc.) → falls
 *   back to an in-memory default admin so admins can still log in and diagnose the issue.
 * - If MONGODB_URI not set at all → default admin inmem fallback.
 */
async function getAdminAccount(): Promise<{ id: string; email: string; name: string; role: string; password: string }> {
  const fallback = {
    id: 'ADMIN',
    name: 'Admin User',
    email: DEFAULT_ADMIN_EMAIL,
    role: 'Admin',
    password: hashPw(DEFAULT_ADMIN_PW),
  };
  if (!isMongoConfigured()) return fallback;

  try {
    let admin = await Admin.findOne({ id: 'ADMIN' });
    if (!admin) {
      admin = await Admin.create({
        id: 'ADMIN',
        name: 'Admin User',
        email: DEFAULT_ADMIN_EMAIL,
        password: hashPw(DEFAULT_ADMIN_PW),
        role: 'Admin',
      });
    }
    return admin.toObject();
  } catch (_e) {
    // Mongo unreachable: still allow admin login via well-known default so portal doesn't fully break during transient network/whitelist issues
    return fallback;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Method not allowed', 405);
  }

  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return sendError(res, 'Please enter your email and password.');
  }

  const hashed = hashPw(password);
  const emailLower = String(email).toLowerCase();
  let dbAvailable = true;
  let dbConnectErr: Error | null = null;
  try {
    await connectDB();
  } catch (e) {
    dbAvailable = false;
    dbConnectErr = e instanceof Error ? e : new Error(String(e));
  }

  // Admin login branch (supports in-mem fallback when DB is down)
  if (emailLower === DEFAULT_ADMIN_EMAIL) {
    try {
      const adminDoc = await getAdminAccount();
      if (emailLower !== adminDoc.email.toLowerCase()) {
        return sendError(res, 'No account found with this email.');
      }
      if (hashed !== adminDoc.password) {
        return sendError(res, 'Incorrect password. Please try again.');
      }
      const token = signToken({ empId: adminDoc.id, role: 'Admin' as const, email: adminDoc.email });
      return sendJson(res, {
        token,
        role: 'admin',
        empId: adminDoc.id,
        name: adminDoc.name,
        firstLogin: false,
        _dbWarn:
          !dbAvailable
            ? 'Signed in using the default admin credentials while the database is temporarily offline. Data changes will not persist until StaffSync reconnects to MongoDB.'
            : undefined,
      });
    } catch (err) {
      console.error('Admin login error:', err);
      return sendError(
        res,
        !dbAvailable && dbConnectErr
          ? dbConnectErr.message
          : 'Server error during login. Please try again.',
        500
      );
    }
  }

  // Employee login — requires DB. If DB not available, return a clear user-facing message instead of generic Server error 500.
  if (!dbAvailable) {
    return sendError(
      res,
      'StaffSync cannot reach the database right now, so employee logins are unavailable. ' +
      'If you switched to a new Wi-Fi network, have your admin add your current public IP to the MongoDB Atlas IP Access List. ' +
      (dbConnectErr ? `(Reason: ${dbConnectErr.message})` : ''),
      503
    );
  }

  try {
    const emp = await Employee.findOne({ email: emailLower });
    if (!emp) {
      return sendError(res, 'No account found with this email.');
    }

    if (emp.status === 'Inactive') {
      return sendError(res, 'This account has been deactivated. Contact your Admin.');
    }

    const expectedHash = emp.firstLogin ? hashPw(emp.tempPassword) : emp.password;
    if (hashed !== expectedHash) {
      return sendError(res, 'Incorrect password. Please try again.');
    }

    const token = signToken({ empId: emp.id, role: emp.role, email: emp.email });

    return sendJson(res, {
      token,
      role: emp.role === 'Admin' ? 'admin' : 'employee',
      empId: emp.id,
      name: emp.name,
      firstLogin: emp.firstLogin,
    });
  } catch (err) {
    console.error('Employee login error:', err);
    return sendError(
      res,
      dbConnectErr
        ? dbConnectErr.message
        : 'Server error during login. Please try again.',
      500
    );
  }
}

