import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../../backend/config/db';
import Leave from '../../backend/models/Leave';
import { extractToken, verifyToken } from '../../backend/utils/auth';
import { handleCors, sendJson, sendError } from '../../backend/utils/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    await connectDB();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database is temporarily unavailable';
    console.error('Leaves DB connect error:', err);
    return sendError(res, msg, 503);
  }

  try {
    const token = extractToken(req.headers);
    const auth = token ? verifyToken(token) : null;
    if (!auth) return sendError(res, 'Unauthorized', 401);

    if (req.method === 'GET') {
      const empId = req.query.empId as string;
      const query = auth.role === 'Admin' && !empId ? {} : { empId: empId || auth.empId };
      const leaves = await Leave.find(query).sort({ leaveId: -1 });
      return sendJson(res, leaves);
    }

    if (req.method === 'POST') {
      const { empId, name, type, start, end, days, reason, reqDate } = req.body;

      if (!empId || !type || !start || !end || !days || !reason) {
        return sendError(res, 'Missing required fields');
      }

      const last = await Leave.findOne().sort({ leaveId: -1 });
      const nextId = last ? last.leaveId + 1 : 1;

      const leave = await Leave.create({
        leaveId: nextId,
        empId,
        name: name || '',
        type,
        start,
        end,
        days: Number(days),
        reason,
        reqDate: reqDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        status: 'Pending',
      });

      return sendJson(res, leave, 201);
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      if (auth.role !== 'Admin' && !req.body.reconsider) {
        return sendError(res, 'Unauthorized: Admin only', 401);
      }
      const { leaveId, status, reconsidered } = req.body;
      if (!leaveId) return sendError(res, 'Leave ID is required');

      const leave = await Leave.findOne({ leaveId: Number(leaveId) });
      if (!leave) return sendError(res, 'Leave request not found', 404);

      if (status) leave.status = status;
      if (reconsidered !== undefined) leave.reconsidered = reconsidered;

      await leave.save();
      return sendJson(res, leave);
    }

    return sendError(res, 'Method not allowed', 405);
  } catch (err) {
    console.error('Leaves API error:', err);
    const msg =
      err instanceof Error
        ? String(err.message).replace(/mongodb\+srv:\/\/[^\s)]+/gi, '[REDACTED_MONGODB_URI]')
        : 'Server error';
    return sendError(res, msg, 500);
  }
}
