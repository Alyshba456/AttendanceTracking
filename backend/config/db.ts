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

export async function connectDB(): Promise<typeof mongoose | null> {
  if (!MONGODB_URI) {
    return null;
  }
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  const now = Date.now();
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
    try {
      if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect().catch(() => {});
      }
    } catch {}
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 6000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 45000,
    };
    cached.promise = mongoose.connect(MONGODB_URI, opts).then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
    cached.lastError = null;
    return cached.conn;
  } catch (e) {
    cached.promise = null;
    cached.conn = null;
    const rawMsg = e instanceof Error ? e.message.split('\n')[0] : String(e);
    const code = e instanceof Error
      ? ((e as any).code ?? (e as any).codeName ?? (e as any).errCode ?? null)
      : null;
    const errName = e instanceof Error ? e.name : 'Error';

    let problemHint = '';
    const low = (rawMsg + ' ' + errName + ' ' + String(code)).toLowerCase();

    if (/ip access list|ip (address )?whitelist|whitelist|0\.0\.0\.0/i.test(low)) {
      problemHint = 'Atlas IP whitelist issue. In MongoDB Atlas → Network Access → ADD IP ADDRESS → ALLOW ACCESS FROM ANYWHERE (0.0.0.0/0).';
    } else if (/bad auth|authentication failed|auth failed|credential|password|could not find user/i.test(low)) {
      problemHint = 'Atlas authentication failed. Verify the database user username + password inside MONGODB_URI match the Atlas database user exactly (not your Atlas login password).';
    } else if (/getaddrinfo|enotfound|enoent|dns|could not be found|resolve/i.test(low)) {
      problemHint = 'Could not resolve the Atlas hostname. Check the MONGODB_URI for typos, or confirm the cluster exists in your Atlas project.';
    } else if (/connection timed out|serverselectiontimeouterror|server selection/i.test(low)) {
      problemHint = 'Connection timed out (ServerSelection). Most often Atlas IP whitelist. Add 0.0.0.0/0 to Atlas Network Access. Also verify the cluster is not paused in Atlas.';
    } else if (/tls|ssl|certificate|self signed|cert/i.test(low)) {
      problemHint = 'TLS/SSL issue. Ensure you are connecting via mongodb+srv:// with TLS enabled (Atlas default), and that Vercel can reach outbound 27017/27018.';
    } else if (/quota|exceeded|rate limit|too many connections|maxpoolsize/i.test(low)) {
      problemHint = 'Atlas connection limit reached. On M0/M2/M5 free tiers, reduce concurrent lambdas or scale up the Atlas cluster.';
    } else if (/ns not found|namespace not found|no such collection/i.test(low)) {
      problemHint = 'Query referenced a nonexistent database/collection. Ensure your MONGODB_URI ends with /staffsync?retryWrites=true&w=majority.';
    }

    const friendly = new Error(
      'Unable to connect to the StaffSync database right now. ' +
      (problemHint ? problemHint + ' ' : '') +
      `(${errName}${code ? ` · code=${code}` : ''}: ${rawMsg})`
    );
    (friendly as any).cause = e;
    (friendly as any).originalName = errName;
    (friendly as any).code = code;
    cached.lastError = friendly;
    cached.lastErrorTs = now;
    throw friendly;
  }
}

export function isMongoConfigured(): boolean {
  return Boolean(MONGODB_URI);
}
