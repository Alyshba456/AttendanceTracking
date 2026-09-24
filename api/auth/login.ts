import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB, isMongoConfigured } from '../../backend/config/db';
import Employee from '../../backend/models/Employee';
import Admin from '../../backend/models/Admin';
import { hashPw, signToken } from '../../backend/utils/auth';
import { handleCors, sendJson, sendError } from '../../backend/utils/helpers';

const DEFAULT_ADMIN_EMAIL = 'admin@company.com';
const DEFAULT_ADMIN_PW = 'Admin@Sync0!';

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
    return fallback;
  }
}

function errSummary(e: unknown): string {
  if (e instanceof Error) {
    return e.message.replace(/mongodb\+srv:\/\/[^\s)]+/gi, '[REDACTED_MONGODB_URI]');
  }
  return String(e);
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
    console.error('[login] DB unavailable —', errSummary(e));
  }

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
      console.error('[login] Admin login catch:', err instanceof Error ? err.stack ?? err.message : String(err));
      return sendError(
        res,
        !dbAvailable && dbConnectErr
          ? `Database temporarily unavailable: ${dbConnectErr.message}`
          : 'Server error during login. Try again or check that MONGODB_URI + JWT_SECRET are set in Vercel environment variables.',
        500
      );
    }
  }

  if (!dbAvailable) {
    const msg =
      'StaffSync cannot reach the database right now, so employee logins are unavailable. ' +
      'Have your Admin verify the MONGODB_URI environment variable in Vercel Project Settings and that MongoDB Atlas allows connections from 0.0.0.0/0. ' +
      (dbConnectErr ? `(Reason: ${dbConnectErr.message})` : '');
    console.error('[login] Employee login blocked by DB connection:', errSummary(dbConnectErr || 'unknown'));
    return sendError(res, msg, 503);
  }

  try {
    const emp = await Employee.findOne({ email: emailLower }).maxTimeMS(10000);
    if (!emp) {
      return sendError(res, 'No account found with this email. Ask your Admin to create the employee first.');
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
    const reason = errSummary(err);
    const label = err instanceof Error ? (err.name || 'Error') : 'Error';
    console.error(`[login] Employee login catch [${label}]:`, err instanceof Error ? err.stack ?? err.message : String(err));

    let userMsg = `${label} during login. Check that MONGODB_URI + JWT_SECRET are set in Vercel Environment Variables, and Atlas allows 0.0.0.0/0 in Network Access. (${reason})`;
    if (dbConnectErr) {
      userMsg = `DB issue: ${dbConnectErr.message}. (${label}: ${reason})`;
    }
    return sendError(res, userMsg, 500);
  }
}
