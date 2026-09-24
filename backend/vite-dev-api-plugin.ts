import type { Plugin, ViteDevServer } from 'vite';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type VercelLikeRequest = IncomingMessage & {
  query: Record<string, string | string[] | undefined>;
  cookies: Record<string, string>;
  body: any;
};

export type VercelLikeResponse = ServerResponse & {
  status: (code: number) => VercelLikeResponse;
  setHeader: (name: string, value: string | string[]) => VercelLikeResponse;
  json: (data: any) => void;
  send: (body: any) => void;
  redirect: (status: number, url?: string) => void;
  revalidate: number | undefined;
};

function parseCookies(cookieHeader?: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(';')) {
    const [k, ...v] = part.split('=');
    if (k) cookies[k.trim()] = decodeURIComponent(v.join('='));
  }
  return cookies;
}

async function readBody(req: IncomingMessage): Promise<any> {
  if ((req as any).body !== undefined) return (req as any).body;
  const ct = req.headers['content-type'] || '';
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return undefined;
  return new Promise<any>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks);
      if (raw.length === 0) return resolve(undefined);
      try {
        if (ct.includes('application/json')) {
          resolve(JSON.parse(raw.toString('utf8')));
        } else if (ct.includes('application/x-www-form-urlencoded')) {
          const params = new URLSearchParams(raw.toString('utf8'));
          const obj: Record<string, any> = {};
          params.forEach((v, k) => (obj[k] = v));
          resolve(obj);
        } else {
          resolve(raw.toString('utf8'));
        }
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function resolveHandler(root: string, urlPath: string): string | null {
  // Strip query string
  const clean = urlPath.split('?')[0];
  if (!clean.startsWith('/api/')) return null;

  const relative = clean.slice(1); // "api/foo/bar"
  const folder = path.resolve(root, path.dirname(relative)); // <root>/api/foo
  const base = path.basename(clean); // "bar"

  const candidates = [
    path.join(folder, `${base}.ts`),
    path.join(folder, `${base}.js`),
    path.join(folder, base, 'index.ts'),
    path.join(folder, base, 'index.js'),
  ];
  // Using fs here would be ideal but we can just attempt loading; for simplicity,
  // use predictable paths: api/<segment>/index.ts OR api/<segment>.ts
  // We'll simply try them via fs.existsSync via Node fs.
  const fs = require('node:fs');
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

async function callHandler(
  vite: ViteDevServer,
  handlerPath: string,
  req: IncomingMessage,
  res: ServerResponse
) {
  try {
    const mod: any = await vite.ssrLoadModule(handlerPath);
    const handler = mod?.default || mod?.handler;
    if (typeof handler !== 'function') {
      res.statusCode = 500;
      res.end(`Invalid handler at ${handlerPath}: no default export function`);
      return;
    }

    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const body = await readBody(req);

    const query: Record<string, string | string[] | undefined> = {};
    for (const [k, v] of url.searchParams.entries()) {
      if (query[k] === undefined) query[k] = v;
      else if (Array.isArray(query[k])) (query[k] as string[]).push(v);
      else query[k] = [query[k] as string, v];
    }

    const vercelReq = req as VercelLikeRequest;
    vercelReq.query = query;
    vercelReq.cookies = parseCookies(req.headers.cookie);
    vercelReq.body = body;

    let statusSent = false;
    const headersSent = new Map<string, string | string[]>();

    const vercelRes = res as VercelLikeResponse;
    vercelRes.status = (code: number) => {
      if (!statusSent) {
        res.statusCode = code;
        statusSent = true;
      }
      return vercelRes;
    };
    const origSetHeader = res.setHeader.bind(res);
    vercelRes.setHeader = (name: string, value: string | string[]) => {
      if (!res.headersSent) origSetHeader(name, value);
      headersSent.set(name, value);
      return vercelRes;
    };
    vercelRes.json = (data: any) => {
      const ct = (res.getHeader('content-type') as string) || 'application/json';
      if (!res.headersSent) res.setHeader('Content-Type', ct);
      if (!statusSent) vercelRes.status(200);
      res.end(JSON.stringify(data));
    };
    vercelRes.send = (body: any) => {
      if (typeof body === 'object' && body !== null && !Buffer.isBuffer(body) && !(body instanceof Readable)) {
        return vercelRes.json(body);
      }
      res.end(body);
    };
    vercelRes.redirect = (status: number, url?: string) => {
      let s = status;
      let u = url;
      if (typeof status === 'string') { u = status; s = 307; }
      res.statusCode = s as number;
      res.setHeader('Location', u as string);
      res.end();
    };

    await handler(vercelReq, vercelRes);
  } catch (err: any) {
    // Print Vite-captured SSR error with source maps
    vite.ssrFixStacktrace?.(err);
    console.error(`[api] Error in ${handlerPath}:`, err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
    }
    // Return user-friendly message (NOT stack traces or raw error strings that may contain credentials/URIs)
    const safeMessage =
      err?.message && typeof err.message === 'string'
        ? String(err.message).replace(/mongodb\+srv:\/\/[^\s)]+/gi, '[REDACTED_MONGODB_URI]')
        : 'Internal server error';
    res.end(JSON.stringify({ error: safeMessage }));
  }
}

export default function vercelApiDevPlugin(rootDir?: string): Plugin {
  const projectRoot = rootDir || path.resolve(__dirname, '..');

  return {
    name: 'vite-plugin-vercel-api-dev',
    apply: 'serve',
    enforce: 'pre',
    configureServer(vite: ViteDevServer) {
      // Register immediately in the middleware stack (before Vite history fallback)
      vite.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url || '/';
        if (!url.startsWith('/api/')) return next();

        const handlerPath = resolveHandler(projectRoot, url);
        if (!handlerPath) {
          res.statusCode = 404;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: `API route not found: ${url.split('?')[0]}` }));
          return;
        }

        await callHandler(vite, handlerPath, req, res);
      });

      // Also return a post-config to lift the middleware to the very front if it ended up behind spa-fallback
      return () => {
        try {
          const stack: any[] = (vite.middlewares as any).stack || [];
          let apiIdx = -1;
          for (let i = 0; i < stack.length; i++) {
            const h = stack[i]?.handle?.toString?.() || '';
            if (h.includes('/api/')) { apiIdx = i; break; }
          }
          if (apiIdx > 5) {
            const mw = stack.splice(apiIdx, 1)[0];
            stack.unshift(mw);
          }
        } catch {}
      };
    },
  };
}
