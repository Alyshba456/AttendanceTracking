import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../config/db';
import Employee from '../models/Employee';
import { extractToken, verifyToken, hashPw } from '../utils/auth';
import { handleCors, sendJson, sendError } from '../utils/helpers';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    await connectDB();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database is temporarily unavailable';
    console.error('Employees DB connect error:', err);
    return sendError(res, msg, 503);
  }

  try {
    const token = extractToken(req.headers);
    const auth = token ? verifyToken(token) : null;

    if (req.method === 'GET') {
      if (!auth || auth.role !== 'Admin') {
        const empId = req.query.empId || (auth ? auth.empId : null);
        if (empId) {
          const emp = await Employee.findOne({ id: empId as string }).select('-password -tempPassword');
          if (!emp) return sendError(res, 'Employee not found', 404);
          return sendJson(res, emp);
        }
        return sendError(res, 'Unauthorized', 401);
      }

      const emps = await Employee.find().select('-password -tempPassword').sort({ id: 1 });
      return sendJson(res, emps);
    }

    if (req.method === 'POST') {
      if (!auth || auth.role !== 'Admin') {
        return sendError(res, 'Unauthorized: Admin only', 401);
      }
      const { id, name, email, dept, designation, role, status, password, tempPassword, firstLogin, remarks } = req.body;

      if (!name || !email || !dept || !designation) {
        return sendError(res, 'Missing required fields: Name, Email, Department, Designation are required.', 400);
      }

      let newId;
      if (id) {
        newId = id;
        const existing = await Employee.findOne({ id: newId });
        if (existing) return sendError(res, `Employee ID ${newId} is already in use.`, 409);
      } else {
        const lastEmp = await Employee.findOne().sort({ id: -1 });
        const nextNum = lastEmp ? parseInt(lastEmp.id.split('-')[1]) + 1 : 1;
        newId = `EMP-${String(nextNum).padStart(3, '0')}`;
      }

      let actualTempPw: string;
      let actualFirstLogin: boolean;
      if (password && String(password).length >= 8) {
        actualTempPw = String(password);
        actualFirstLogin = firstLogin ?? true;
      } else {
        actualTempPw = crypto.randomBytes(4).toString('hex') + '!A1';
        actualFirstLogin = true;
      }

      let newEmp;
      try {
        newEmp = await Employee.create({
          id: newId,
          name,
          email: email.toLowerCase(),
          dept,
          designation,
          role: role || 'Employee',
          status: status || 'Active',
          tempPassword: actualTempPw,
          password: hashPw(actualTempPw),
          firstLogin: actualFirstLogin,
          remarks: (remarks ?? '').toString(),
        });
      } catch (e: any) {
        if (e?.code === 11000 && e?.keyPattern?.email === 1) {
          return sendError(res, `An employee with email ${email.toLowerCase()} already exists. Use a different email or go to the existing row and click Reset Password.`, 409);
        }
        if (e?.code === 11000 && e?.keyPattern?.id === 1) {
          return sendError(res, `Employee ID ${newId} is already assigned. Pick a different ID.`, 409);
        }
        return sendError(res, 'Employee could not be saved. Validation error: ' + (e?.message || 'Unknown'), 400);
      }

      const { password: _pw, ...empWithoutPw } = newEmp.toObject();
      return sendJson(res, { ...empWithoutPw, demoTempPassword: actualTempPw }, 201);
    }

    if (req.method === 'PUT') {
      if (!auth || auth.role !== 'Admin') {
        return sendError(res, 'Unauthorized: Admin only', 401);
      }
      const { id, name, email, dept, designation, role, status, tempPassword, firstLogin, remarks } = req.body;
      if (!id) return sendError(res, 'Employee ID is required', 400);

      const emp = await Employee.findOne({ id });
      if (!emp) return sendError(res, 'Employee not found', 404);

      if (name) emp.name = name;
      if (email) emp.email = email.toLowerCase();
      if (dept) emp.dept = dept;
      if (designation) emp.designation = designation;
      if (role) emp.role = role;
      if (status !== undefined) emp.status = status;
      if (remarks !== undefined) emp.remarks = (remarks ?? '').toString();
      if (tempPassword && String(tempPassword).length >= 8) {
        emp.tempPassword = String(tempPassword);
        emp.password = hashPw(String(tempPassword));
        emp.firstLogin = firstLogin ?? true;
      } else if (tempPassword) {
        return sendError(res, 'Temporary password must be at least 8 characters.', 400);
      }

      await emp.save();
      const { password, ...rest } = emp.toObject();
      return sendJson(res, rest);
    }

    if (req.method === 'PATCH') {
      if (!auth || auth.role !== 'Admin') {
        return sendError(res, 'Unauthorized: Admin only', 401);
      }
      const { id, action } = req.body;
      if (!id) return sendError(res, 'Employee ID is required', 400);
      if (action === 'appendRemark') {
        const { text, createdBy } = req.body;
        if (!text || !String(text).trim()) return sendError(res, 'Remark text is required.', 400);
        const emp = await Employee.findOne({ id });
        if (!emp) return sendError(res, 'Employee not found', 404);
        const now = new Date();
        const entry = {
          text: String(text).trim(),
          createdAt: now,
          createdBy: String(createdBy || auth.name || auth.empId || 'ADMIN'),
          updatedAt: now,
        };
        if (!emp.remarksHistory || !Array.isArray(emp.remarksHistory)) (emp as any).remarksHistory = [];
        emp.remarksHistory.unshift(entry);
        await emp.save();
        const { password, ...rest } = emp.toObject();
        return sendJson(res, rest);
      }
      return sendError(res, `Unknown PATCH action: ${String(action || 'undefined')}`, 400);
    }

    if (req.method === 'DELETE') {
      if (!auth || auth.role !== 'Admin') {
        return sendError(res, 'Unauthorized: Admin only', 401);
      }
      const { id } = req.body;
      if (!id) return sendError(res, 'Employee ID is required');

      const emp = await Employee.findOneAndDelete({ id });
      if (!emp) return sendError(res, 'Employee not found', 404);
      return sendJson(res, { success: true });
    }

    return sendError(res, 'Method not allowed', 405);
  } catch (err) {
    console.error('Employees API error:', err);
    const msg =
      err instanceof Error
        ? String(err.message).replace(/mongodb\+srv:\/\/[^\s)]+/gi, '[REDACTED_MONGODB_URI]')
        : 'Server error';
    return sendError(res, msg, 500);
  }
}
