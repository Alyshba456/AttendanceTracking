import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../../backend/config/db';
import Attendance from '../../backend/models/Attendance';
import Employee from '../../backend/models/Employee';
import { extractToken, verifyToken } from '../../backend/utils/auth';
import { handleCors, sendJson, sendError, todayStr, fromMins } from '../../backend/utils/helpers';
import { getCompanySettings } from '../../backend/utils/getCompanySettings';
import { computeAttendanceStatus } from '../../backend/utils/attendanceStatus';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    await connectDB();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database is temporarily unavailable';
    console.error('Attendance DB connect error:', err);
    return sendError(res, msg, 503);
  }

  try {
    const token = extractToken(req.headers);
    const auth = token ? verifyToken(token) : null;
    if (!auth) return sendError(res, 'Unauthorized', 401);

    // Always load the Admin's persisted settings so the saved buffer/hours config is the single
    // source of truth when computing statuses. Defaults are used only if settings document
    // cannot be retrieved (DB transiently down).
    const settings = await getCompanySettings();

    if (req.method === 'GET') {
      const empId = req.query.empId as string;
      const date = req.query.date as string;
      const query: any = {};
      if (auth.role !== 'Admin' || empId) {
        query.empId = empId || auth.empId;
      }
      if (date) query.date = date;
      const records = await Attendance.find(query).sort({ attId: -1 }).limit(500);
      const normalized = records.map(r => {
        const obj = (r.toObject ? r.toObject() : r) as any;
        return {
          ...obj,
          mode: obj.mode || 'Office',
          status: computeAttendanceStatus(settings, obj.clockIn, obj.clockOut, obj.status),
        };
      });
      return sendJson(res, normalized);
    }

    if (req.method === 'POST') {
      const { action, empId, mode } = req.body;
      const targetEmpId = auth.role === 'Admin' ? (empId || auth.empId) : auth.empId;
      const TODAY = todayStr();
      const saveMode: 'Office' | 'WFH' = mode === 'WFH' ? 'WFH' : 'Office';

      if (action === 'clockIn') {
        const now = new Date();
        const clockInStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const status = computeAttendanceStatus(settings, clockInStr, null, 'Present');

        const existing = await Attendance.findOne({ empId: targetEmpId, date: TODAY });
        if (existing) {
          existing.clockIn = clockInStr;
          existing.status = status;
          existing.mode = saveMode;
          await existing.save();
          const obj = (existing.toObject ? existing.toObject() : existing) as any;
          return sendJson(res, { record: { ...obj, mode: obj.mode || 'Office' }, clockInTime: now.toISOString() });
        }

        const emp = await Employee.findOne({ id: targetEmpId });
        const last = await Attendance.findOne().sort({ attId: -1 });
        const nextId = last ? last.attId + 1 : 1;

        const record = await Attendance.create({
          attId: nextId,
          empId: targetEmpId,
          name: emp?.name || targetEmpId,
          dept: emp?.dept || '—',
          date: TODAY,
          clockIn: clockInStr,
          clockOut: '—',
          officeHours: '—',
          fieldHours: '—',
          status,
          mode: saveMode,
        });

        const obj = (record.toObject ? record.toObject() : record) as any;
        return sendJson(res, { record: { ...obj, mode: obj.mode || 'Office' }, clockInTime: now.toISOString() }, 201);
      }

      if (action === 'clockOut') {
        const { clockInTime } = req.body;
        const now = new Date();
        const clockOutStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

        const record = await Attendance.findOne({ empId: targetEmpId, date: TODAY });
        if (!record) {
          return sendError(res, 'No clock-in found for today');
        }

        const ciTime = clockInTime ? new Date(clockInTime) : now;
        const mins = Math.round((now.getTime() - ciTime.getTime()) / 60000);
        record.clockOut = clockOutStr;
        record.officeHours = fromMins(mins);
        record.status = computeAttendanceStatus(settings, record.clockIn, clockOutStr, record.status);
        await record.save();
        const obj = (record.toObject ? record.toObject() : record) as any;
        return sendJson(res, { record: { ...obj, mode: obj.mode || 'Office' }, clockOutTime: now.toISOString() });
      }

      return sendError(res, 'Invalid action');
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      if (auth.role !== 'Admin') {
        return sendError(res, 'Unauthorized: Admin only', 401);
      }
      const { attId, ...updates } = req.body;
      if (!attId) return sendError(res, 'Attendance ID is required');

      const record = await Attendance.findOne({ attId: Number(attId) });
      if (!record) return sendError(res, 'Attendance record not found', 404);

      Object.assign(record, updates);
      // Recompute status against current settings even after manual edit, unless caller is overriding.
      const candidateClockIn = (record as any).clockIn;
      const candidateClockOut = (record as any).clockOut;
      if (!updates.status && candidateClockIn !== undefined && candidateClockOut !== undefined) {
        (record as any).status = computeAttendanceStatus(settings, candidateClockIn, candidateClockOut, (record as any).status);
      }
      await record.save();
      return sendJson(res, record.toObject ? record.toObject() : record);
    }

    return sendError(res, 'Method not allowed', 405);
  } catch (err) {
    console.error('Attendance API error:', err);
    const msg =
      err instanceof Error
        ? String(err.message).replace(/mongodb\+srv:\/\/[^\s)]+/gi, '[REDACTED_MONGODB_URI]')
        : 'Server error';
    return sendError(res, msg, 500);
  }
}
