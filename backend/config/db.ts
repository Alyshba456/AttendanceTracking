import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || '';

interface Cached {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  lastError: unknown | null;
  lastErrorTs: number;
  lastForcedReconnectTs: number;
}

declare global {
  var mongooseCache: Cached | undefined;
}

const cached: Cached = global.mongooseCache || { conn: null, promise: null, lastError: null, lastErrorTs: 0, lastForcedReconnectTs: 0 };

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

/**
 * Try to connect to MongoDB.
 *
 * - Returns mongoose connection on success (cached after first success).
 * - If no MONGODB_URI configured, returns null (caller can use inmem fallback if applicable).
 * - If connect attempt fails, throws a friendly error.
 * - Failed attempts are cached for ~15s so every API call doesn't re-try a 30s Atlas timeout.
 */
export async function connectDB(): Promise<typeof mongoose | null> {
  if (!MONGODB_URI) {
    return null;
  }
  if (cached.conn) {
    return cached.conn;
  }

  const now = Date.now();
  // Brief failure backoff — don't hammer Atlas after a fresh failure, BUT:
  // Always force at least ONE clean reconnect attempt every 2 minutes regardless.
  // This ensures long-running dev servers auto-heal after overnight ISP IP rotations.
  const twoMinAgo = now - 120000;
  const withinBackoff = cached.lastError && now - cached.lastErrorTs < 15000;
  const forceCleanReconnect = cached.lastForcedReconnectTs <= twoMinAgo;
  if (withinBackoff && !forceCleanReconnect) {
    const err = cached.lastError instanceof Error
      ? cached.lastError
      : new Error(String(cached.lastError) || 'Database connection failed');
    throw err;
  }
  if (forceCleanReconnect) {
    cached.lastForcedReconnectTs = now;
    cached.promise = null;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 10000,
    };
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
    cached.lastError = null;
    return cached.conn;
  } catch (e) {
    cached.promise = null;
    cached.lastError = e;
    cached.lastErrorTs = now;
    const friendly = new Error(
      'Unable to connect to the StaffSync database right now. ' +
      'If you are on a new Wi-Fi network, please ask your admin to add your current IP to the MongoDB Atlas IP Access List, ' +
      'or verify that the MONGODB_URI in .env / Vercel environment variables is correct. ' +
      `(Reason: ${e instanceof Error ? e.message.split('\n')[0] : String(e)})`
    );
    (friendly as any).cause = e;
    throw friendly;
  }
}

/** True when live Mongo is configured at environment level. (Doesn't mean reachable right now.) */
export function isMongoConfigured(): boolean {
  return Boolean(MONGODB_URI);
}
