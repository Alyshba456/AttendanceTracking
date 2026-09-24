import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../backend/config/db';
import Employee from '../backend/models/Employee';
import Leave from '../backend/models/Leave';
import FieldWork from '../backend/models/FieldWork';
import Attendance from '../backend/models/Attendance';
import CompanySettings from '../backend/models/CompanySettings';
import Admin from '../backend/models/Admin';
import { hashPw } from '../backend/utils/auth';
import { handleCors, sendJson, sendError } from '../backend/utils/helpers';

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

const AdminModel = Admin as any;
const EmployeeModel = Employee as any;
const LeaveModel = Leave as any;
const FieldWorkModel = FieldWork as any;
const AttendanceModel = Attendance as any;
const CompanySettingsModel = CompanySettings as any;

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

    const adminCount = await AdminModel.countDocuments();
    if (force || adminCount === 0) {
      if (force) await AdminModel.deleteMany({});
      await AdminModel.create({
        id: 'ADMIN',
        name: 'Admin User',
        email: 'admin@company.com',
        password: hashPw('Admin@Sync0!'),
        role: 'Admin',
      });
      results.admin = force ? 'Reset' : 'Seeded';
    } else results.admin = 'Already exists';

    const empCount = await EmployeeModel.countDocuments();
    if (force) {
      await EmployeeModel.deleteMany({});
      results.employees = 'Reset (empty)';
    } else if (empCount === 0) {
      results.employees = 'Empty — add via Employees tab';
    } else {
      results.employees = 'Already exists';
    }

    const leaveCount = await LeaveModel.countDocuments();
    if (force) {
      await LeaveModel.deleteMany({});
      results.leaves = 'Reset (empty)';
    } else if (leaveCount === 0) {
      results.leaves = 'Empty';
    } else {
      results.leaves = 'Already exists';
    }

    const fwCount = await FieldWorkModel.countDocuments();
    if (force) {
      await FieldWorkModel.deleteMany({});
      results.fieldwork = 'Reset (empty)';
    } else if (fwCount === 0) {
      results.fieldwork = 'Empty';
    } else {
      results.fieldwork = 'Already exists';
    }

    const attCount = await AttendanceModel.countDocuments();
    if (force) {
      await AttendanceModel.deleteMany({});
      results.attendance = 'Reset (empty)';
    } else if (attCount === 0) {
      results.attendance = 'Empty';
    } else {
      results.attendance = 'Already exists';
    }

    const setCount = await CompanySettingsModel.countDocuments();
    if (force || setCount === 0) {
      if (force) await CompanySettingsModel.deleteMany({});
      await CompanySettingsModel.create(defaultSettings);
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
