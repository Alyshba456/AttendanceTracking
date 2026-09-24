import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB } from '../config/db';
import FieldWork from '../models/FieldWork';
import { extractToken, verifyToken } from '../utils/auth';
import { handleCors, sendJson, sendError } from '../utils/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;

  try {
    await connectDB();
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Database is temporarily unavailable';
    console.error('FieldWork DB connect error:', err);
    return sendError(res, msg, 503);
  }

  try {
    const token = extractToken(req.headers);
    const auth = token ? verifyToken(token) : null;
    if (!auth) return sendError(res, 'Unauthorized', 401);

    if (req.method === 'GET') {
      const empId = req.query.empId as string;
      const query = auth.role === 'Admin' && !empId ? {} : { empId: empId || auth.empId };
      const entries = await FieldWork.find(query).sort({ fwId: -1 });
      return sendJson(res, entries);
    }

    if (req.method === 'POST') {
      const { empId, name, date, location, start, end, hours, desc } = req.body;

      if (!empId || !date || !location || !start || !end || !desc) {
        return sendError(res, 'Missing required fields');
      }

      const last = await FieldWork.findOne().sort({ fwId: -1 });
      const nextId = last ? last.fwId + 1 : 1;

      const fw = await FieldWork.create({
        fwId: nextId,
        empId,
        name: name || '',
        date,
        location,
        start,
        end,
        hours: hours || calculateHours(start, end),
        desc,
        status: 'Pending',
      });

      return sendJson(res, fw, 201);
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      if (auth.role !== 'Admin') {
        return sendError(res, 'Unauthorized: Admin only', 401);
      }
      const { fwId, status } = req.body;
      if (!fwId) return sendError(res, 'Field Work ID is required');

      const fw = await FieldWork.findOne({ fwId: Number(fwId) });
      if (!fw) return sendError(res, 'Field work entry not found', 404);

      if (status) fw.status = status;
      await fw.save();
      return sendJson(res, fw);
    }

    return sendError(res, 'Method not allowed', 405);
  } catch (err) {
    console.error('FieldWork API error:', err);
    const msg =
      err instanceof Error
        ? String(err.message).replace(/mongodb\+srv:\/\/[^\s)]+/gi, '[REDACTED_MONGODB_URI]')
        : 'Server error';
    return sendError(res, msg, 500);
  }
}

function calculateHours(start: string, end: string): string {
  try {
    const parse = (t: string) => {
      const [time, ampm] = t.split(' ');
      const [h, m] = time.split(':').map(Number);
      let hour = h;
      if (ampm === 'PM' && h !== 12) hour += 12;
      if (ampm === 'AM' && h === 12) hour = 0;
      return hour * 60 + m;
    };
    const mins = parse(end) - parse(start);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  } catch {
    return '8h';
  }
}
