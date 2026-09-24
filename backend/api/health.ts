import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectDB, isMongoConfigured } from '../config/db';
import mongoose from 'mongoose';
import { handleCors, sendJson, sendError } from '../utils/helpers';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (handleCors(req, res)) return;
  if (req.method !== 'GET') {
    return sendError(res, 'Method not allowed', 405);
  }

  const report: Record<string, any> = {
    status: 'unknown',
    timestamp: new Date().toISOString(),
    node: process.version,
    runtime: process.env.NODE_ENV || 'unspecified',
    region: process.env.VERCEL_REGION || 'local',
  };

  const mongoUriFull = process.env.MONGODB_URI || '';
  report.env = {
    MONGODB_URI_SET: Boolean(mongoUriFull),
    MONGODB_URI_SCHEME: mongoUriFull ? mongoUriFull.split('://')[0] : null,
    MONGODB_URI_HOST: (() => {
      if (!mongoUriFull) return null;
      try {
        const afterProtocol = mongoUriFull.split('://')[1] || '';
        const beforeSlash = afterProtocol.split('/')[0] || '';
        const hostPart = beforeSlash.split('@').pop() || '';
        return hostPart.split(':')[0];
      } catch { return null; }
    })(),
    MONGODB_URI_DB_NAME: (() => {
      if (!mongoUriFull) return null;
      try {
        const afterProtocol = mongoUriFull.split('://')[1] || '';
        const slashPart = afterProtocol.split('/')[1] || '';
        return slashPart.split('?')[0] || null;
      } catch { return null; }
    })(),
    JWT_SECRET_SET: Boolean(process.env.JWT_SECRET && String(process.env.JWT_SECRET).length > 8),
    JWT_SECRET_LEN: process.env.JWT_SECRET ? String(process.env.JWT_SECRET).length : 0,
    IS_MONGO_CONFIGURED: isMongoConfigured(),
  };

  report.db_connect = {};
  if (!isMongoConfigured()) {
    report.status = 'blocked';
    report.db_connect.ok = false;
    report.db_connect.reason = 'MONGODB_URI is not set in Vercel Environment Variables. Add it in Project Settings → Environment Variables and Redeploy.';
    return sendJson(res, report, 200);
  }

  let connected = false;
  try {
    const startTime = Date.now();
    await connectDB();
    connected = mongoose.connection.readyState === 1;
    const readyStates: Record<number, string> = { 0: 'disconnected', 1: 'connected', 2: 'connecting', 3: 'disconnecting' };
    report.db_connect.readyState = mongoose.connection.readyState;
    report.db_connect.readyStateText = readyStates[mongoose.connection.readyState] || 'unknown';
    report.db_connect.ok = connected;
    report.db_connect.latencyMs = Date.now() - startTime;
    report.db_connect.host = (mongoose.connection.host as string) || null;
    report.db_connect.port = mongoose.connection.port || null;
    report.db_connect.dbName = (mongoose.connection.name as string) || null;
  } catch (e) {
    connected = false;
    report.db_connect.ok = false;
    const msg = e instanceof Error ? e.message : String(e);
    const sanitized = msg.replace(/mongodb\+srv:\/\/[^\s)]+/gi, '[REDACTED_MONGODB_URI]');
    report.db_connect.reason = sanitized;
    report.db_connect.hint = /IP Access List|whitelist|ip|0\.0\.0\.0/i.test(sanitized)
      ? 'Go to MongoDB Atlas → Network Access → ADD IP ADDRESS → "ALLOW ACCESS FROM ANYWHERE" (0.0.0.0/0) → Confirm, wait 90 seconds, refresh this page.'
      : /bad auth|authentication failed|password|credential/i.test(sanitized)
      ? 'Atlas credentials are wrong. Make sure the MONGODB_URI user password matches the Atlas database user password (not your Atlas login password).'
      : /getaddrinfo|ENOTFOUND|DNS|could not be found/i.test(sanitized)
      ? 'Atlas cluster hostname could not be resolved. Check the MONGODB_URI for typos, or confirm the cluster still exists in Atlas.'
      : 'Copy the full "reason" field above into a Google search or the Mongo docs for the specific Mongoose driver error.';
  }

  report.collections = { checked: false };
  if (connected) {
    try {
      const adminDb = mongoose.connection.db!.admin();
      const ping = await adminDb.ping();
      report.collections.ping_ok = Boolean(ping?.ok);
      const list = await mongoose.connection.db!.listCollections(undefined, { nameOnly: true }).toArray();
      report.collections.names = list.map(c => c.name);
      report.collections.count = list.length;
      report.collections.checked = true;
    } catch (e) {
      report.collections.checked = true;
      report.collections.error = e instanceof Error ? e.message : String(e);
    }
  }

  report.status = connected ? 'healthy' : report.env.MONGODB_URI_SET ? 'db_unreachable' : 'blocked';
  report.next_steps = connected
    ? [
        'Backend is healthy. Go to /api/seed to create the default Admin (ADMIN / Admin@Sync0!).',
        'Then log into the frontend with admin@company.com.',
      ]
    : report.env.MONGODB_URI_SET
      ? [
          'MONGODB_URI is set, but StaffSync could not connect.',
          '→ Solve the db_connect.hint above first.',
          '→ When you can click Refresh and this file shows status=healthy, visit /api/seed and then login.',
        ]
      : [
          'In Vercel Project Settings → Environment Variables add:',
          '  - MONGODB_URI = your full Atlas connection string',
          '  - JWT_SECRET   = a random 32+ char string (node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))")',
          'Then click Deployments → (latest) → Redeploy, and come back to /api/health.',
        ];

  return sendJson(res, report, 200);
}
