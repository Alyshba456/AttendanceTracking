import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../config/db';
import Employee from '../models/Employee';
import Leave from '../models/Leave';
import FieldWork from '../models/FieldWork';
import Attendance from '../models/Attendance';
import CompanySettings from '../models/CompanySettings';
import Admin from '../models/Admin';
import { hashPw } from '../utils/auth';
import { handleCors, sendJson, sendError } from '../utils/helpers';

const defaultSettings = {
  companyName: 'StaffSync',
  companyEmail: 'hr@attendtrack.com',
  companyAddress: '123 Business Ave, Makati City',
  workStartTime: '09:00',
  workEndTime: '18:00',
  leaveAllowance: 14,
  workWeek: 'Monday – Friday',
  lateBuffer: 15,
  overtimeBuffer: 30,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  const force = req.query.force === 'true';

  try {
    await connectDB();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database is temporarily unavailable';
    console.error('Seed DB connect error:', err);
    return sendError(res, msg, 503);
  }

  try {
    const results: Record<string, string> = {};

    const adminCount = await Admin.countDocuments();
    if (force || adminCount === 0) {
      if (force) await Admin.deleteMany({});
      await Admin.create({
        id: 'ADMIN',
        name: 'Admin User',
        email: 'admin@company.com',
        password: hashPw('Admin@Sync0!'),
        role: 'Admin',
      });
      results.admin = force ? 'Reset' : 'Seeded';
    } else results.admin = 'Already exists';

    const empCount = await Employee.countDocuments();
    if (force) {
      await Employee.deleteMany({});
      results.employees = 'Reset (empty)';
    } else if (empCount === 0) {
      results.employees = 'Empty — add via Employees tab';
    } else {
      results.employees = 'Already exists';
    }

    const leaveCount = await Leave.countDocuments();
    if (force) {
      await Leave.deleteMany({});
      results.leaves = 'Reset (empty)';
    } else if (leaveCount === 0) {
      results.leaves = 'Empty';
    } else {
      results.leaves = 'Already exists';
    }

    const fwCount = await FieldWork.countDocuments();
    if (force) {
      await FieldWork.deleteMany({});
      results.fieldwork = 'Reset (empty)';
    } else if (fwCount === 0) {
      results.fieldwork = 'Empty';
    } else {
      results.fieldwork = 'Already exists';
    }

    const attCount = await Attendance.countDocuments();
    if (force) {
      await Attendance.deleteMany({});
      results.attendance = 'Reset (empty)';
    } else if (attCount === 0) {
      results.attendance = 'Empty';
    } else {
      results.attendance = 'Already exists';
    }

    const setCount = await CompanySettings.countDocuments();
    if (force || setCount === 0) {
      if (force) await CompanySettings.deleteMany({});
      await CompanySettings.create(defaultSettings);
      results.settings = force ? 'Reset (defaults)' : 'Seeded (defaults)';
    } else results.settings = 'Already exists';

    return sendJson(res, { success: true, results });
  } catch (err) {
    console.error('Seed error:', err);
    const msg =
      err instanceof Error
        ? String(err.message).replace(/mongodb\+srv:\/\/[^\s)]+/gi, '[REDACTED_MONGODB_URI]')
        : 'Seeding failed';
    return sendError(res, msg, 500);
  }
}
