import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import vercelApiDevPlugin from '../backend/vite-dev-api-plugin.ts'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '..')

// Load root .env early (before plugin execution) so MONGODB_URI is available
// to decide between live Mongo vs in-memory dev backend routing.
function loadRootEnvFile(): Record<string, string> {
  const envFile = path.join(PROJECT_ROOT, '.env')
  const out: Record<string, string> = {}
  if (!fs.existsSync(envFile)) return out
  const raw = fs.readFileSync(envFile, 'utf8')
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx < 0) continue
    const key = trimmed.slice(0, eqIdx).trim()
    let val = trimmed.slice(eqIdx + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    out[key] = val
    if (process.env[key] === undefined) process.env[key] = val
  }
  return out
}

const ROOT_ENV = loadRootEnvFile()
const USE_LIVE_MONGO = Boolean(process.env.MONGODB_URI && process.env.MONGODB_URI.length > 0)

const rootSitePath = path.resolve(__dirname, '../.figma/make/site.json')
const localSitePath = path.resolve(__dirname, './.figma/make/site.json')
let siteConfiguration: any = {
  title: 'StaffSync — Employee Attendance Portal',
  description: 'Employee attendance and leave management system',
}
try {
  if (fs.existsSync(rootSitePath)) siteConfiguration = JSON.parse(fs.readFileSync(rootSitePath, 'utf8'))
  else if (fs.existsSync(localSitePath)) siteConfiguration = JSON.parse(fs.readFileSync(localSitePath, 'utf8'))
} catch { /* keep defaults */ }

const TS_CJS_OPTS = {
  module: ts.ModuleKind.CommonJS,
  target: ts.ScriptTarget.ES2022,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  esModuleInterop: true,
  skipLibCheck: true,
  allowSyntheticDefaultImports: true,
  isolatedModules: true,
  forceConsistentCasingInFileNames: false,
} as ts.CompilerOptions;

function compileTStoCJS(tsFile: string, outCjsFile: string) {
  if (!fs.existsSync(tsFile)) return false;
  const src = fs.readFileSync(tsFile, 'utf8');
  const out = ts.transpileModule(src, { compilerOptions: TS_CJS_OPTS });
  let code = out.outputText;
  code = code.replace(/import\.meta\.url/g, JSON.stringify(`file://${tsFile.replace(/\\/g, '/')}`));
  fs.writeFileSync(outCjsFile, code);
  return true;
}

function loadLocalRouterDev() {
  const backendDir = path.resolve(__dirname, '../backend');

  // Compile dependencies first
  compileTStoCJS(
    path.join(backendDir, 'inmem-db.ts'),
    path.join(backendDir, 'inmem-db.dev.cjs')
  );
  // Ensure router points to .dev.cjs version of inmem-db
  const routerTS = path.join(backendDir, 'local-api-router.ts');
  const routerOut = path.join(backendDir, 'local-api-router.dev.cjs');
  if (!compileTStoCJS(routerTS, routerOut)) return null;

  // Patch the require("./inmem-db") -> "./inmem-db.dev.cjs" in the written file
  let routerCode = fs.readFileSync(routerOut, 'utf8');
  routerCode = routerCode.replace(
    /require\(["']\.\/inmem-db["']\)/g,
    'require("./inmem-db.dev.cjs")'
  );
  fs.writeFileSync(routerOut, routerCode);

  try {
    delete require.cache[require.resolve(path.join(backendDir, 'inmem-db.dev.cjs'))];
    delete require.cache[require.resolve(routerOut)];
  } catch {}
  return require(routerOut);
}

function staffsyncLocalApiPlugin(): Plugin {
  return {
    name: 'staffsync-local-api',
    apply: 'serve',
    enforce: 'pre',
    configureServer(vite) {
      // Register API middleware FIRST — before Vite's history fallback that serves index.html
      const middleware = async (req: any, res: any, next: any) => {
        const url = req.url || '';
        if (!url.startsWith('/api/')) return next();
        try {
          const mod = loadLocalRouterDev();
          const dispatch = mod?.dispatchLocalApi || mod?.default?.dispatchLocalApi || mod?.default;
          if (!dispatch) return next();
          const handled = await dispatch(req, res);
          if (!handled) next();
        } catch (e: any) {
          console.error('[staffsync-local-api] error:', e);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          const safeMsg =
            e?.message && typeof e.message === 'string'
              ? String(e.message).replace(/mongodb\+srv:\/\/[^\s)]+/gi, '[REDACTED_MONGODB_URI]')
              : 'Server error';
          res.end(JSON.stringify({ error: safeMsg }));
        }
      };
      vite.middlewares.use(middleware);

      // Also return the post-config to re-insert after Vite's defaults just in case:
      return () => {
        // Lift our middleware to the front if it ended up behind spa-fallback
        try {
          const stack = (vite.middlewares as any).stack || [];
          // Move /api middleware to beginning
          let apiIdx = -1;
          for (let i = 0; i < stack.length; i++) {
            const h = stack[i]?.handle?.toString?.() || '';
            if (h.includes('staffsync') || h.includes('/api/')) { apiIdx = i; break; }
          }
          if (apiIdx > 5) {
            const mw = stack.splice(apiIdx, 1)[0];
            stack.unshift(mw);
          }
        } catch {}
        // Log once the dev server is listening
        vite.httpServer?.once('listening', () => {
          setTimeout(() => {
            const addr = (vite.httpServer?.address() as any);
            const port = addr?.port;
            if (port) {
              const colors = { reset: '\x1b[0m', green: '\x1b[32m', blue: '\x1b[34m', bold: '\x1b[1m' };
              process.stdout.write(`\n  ${colors.green}✓${colors.reset}  Backend API ${colors.bold}active${colors.reset}  →  ${colors.blue}/api/*${colors.reset}  (in-memory, ${colors.blue}no MongoDB needed${colors.reset})\n`);
              process.stdout.write(`  ${colors.green}✓${colors.reset}  Try /api/seed and /api/employees in your browser\n\n`);
            }
          }, 150);
        });
      };
    },
  };
}

// Vite config — https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // .figma/make/deploy-preview passes `--mode development` for cached-preview builds.
  const emitSourcemaps = mode === 'development'

  // Pick the appropriate API backend plugin:
  //  - If MONGODB_URI env var present AND truthy → use real Vercel-style /api/* handlers
  //    connected to live MongoDB Atlas (via vite ssrLoadModule transpile).
  //  - Otherwise → use the lightweight in-memory dev backend (no DB required).
  //
  // (TypeScript note: cast through `any` because backend node_modules installs its own
  //  vite copy for type resolution; the two Plugin type declarations don't unify even
  //  though the runtime value is identical.)
  const apiPlugin: any = USE_LIVE_MONGO
    ? vercelApiDevPlugin(PROJECT_ROOT)
    : staffsyncLocalApiPlugin()

  return {
    base: process.env.FIGMA_PUBLIC_URL ? `${process.env.FIGMA_PUBLIC_URL}/` : '/',
    build: {
      sourcemap: emitSourcemaps ? 'inline' : false,
      minify: !emitSourcemaps,
    },
    plugins: [
      react(),
      tailwindcss(),
      apiPlugin as any,
      figmaSiteConfiguration(siteConfiguration),
      figmaErrorOverlayReplay(),
      figmaReactRefreshBoundaryFallback(),
      figmaMakeKitPlugin({ storiesGlob: '/src/**/*.stories.{ts,tsx,js,jsx}' }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    optimizeDeps: {
      exclude: ['typescript'],
    },
    server: {
      host: process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '5173'),
      strictPort: false,
      watch: {
        ignored: [
          '**/.figma/**',
          '**/backend/*.dev.cjs',
        ],
      },
    },
    preview: {
      host: process.env.FIGMA_DEV_SERVER_HOST || '0.0.0.0',
      port: parseInt(process.env.PORT || '4173'),
      strictPort: false,
    },
  }
})

type FigmaSiteConfiguration = {
  title?: string
  description?: string
  language?: string
  robots?: {
    index?: boolean
  }
  icons?: {
    icon?: string
  }
  openGraph?: {
    image?: string
  }
  analytics?: {
    googleAnalyticsId?: string
  }
  customScripts?: {
    headStart?: string
    headEnd?: string
    bodyStart?: string
    bodyEnd?: string
  }
  accessibility?: {
    addBypassLinks?: boolean
  }
}

/** Applies /.figma/make/site.json to the generated document shell. */
function figmaSiteConfiguration(config: FigmaSiteConfiguration): Plugin {
  function sanitizeHtmlValue(value: string | undefined): string {
    return value?.replace(/[^a-zA-Z0-9_-]/g, '') || ''
  }
  function escapeHtmlText(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }
  function replaceHtmlCommentSlot(html: string, slotName: string, content: string): string {
    return html.replace(`<!-- ${slotName} -->`, content)
  }

  const title = config.title ?? "Figma Make App"
  const description = config.description ?? ''
  const favicon = config.icons?.icon ?? ''
  const socialImage = config.openGraph?.image ?? ''
  const language = sanitizeHtmlValue(config.language) || 'en'
  const googleAnalyticsId = sanitizeHtmlValue(config.analytics?.googleAnalyticsId)
  const headStart = config.customScripts?.headStart ?? ''
  const headEnd = config.customScripts?.headEnd ?? ''
  const bodyStart = config.customScripts?.bodyStart ?? ''
  const bodyEnd = config.customScripts?.bodyEnd ?? ''
  const robotsTxt = config.robots?.index === false ? 'User-agent: *\nDisallow: /\n' : ''

  return {
    name: 'figma-site-configuration',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!robotsTxt || req.url?.split('?')[0] !== '/robots.txt') return next()

        res.setHeader('Content-Type', 'text/plain; charset=utf-8')
        res.end(robotsTxt)
      })
    },
    generateBundle() {
      if (!robotsTxt) return

      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        source: robotsTxt,
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        let result = html
        result = replaceHtmlCommentSlot(result, 'figma:lang', language)
        result = replaceHtmlCommentSlot(result, 'figma:title', escapeHtmlText(title))
        result = replaceHtmlCommentSlot(result, 'figma:head-start', headStart)
        result = replaceHtmlCommentSlot(result, 'figma:head-end', headEnd)
        result = replaceHtmlCommentSlot(result, 'figma:body-start', bodyStart)
        result = replaceHtmlCommentSlot(result, 'figma:body-end', bodyEnd)

        const tags: HtmlTagDescriptor[] = []
        if (description) {
          tags.push({ tag: 'meta', attrs: { name: 'description', content: description }, injectTo: 'head' })
        }
        if (config.robots?.index === false) {
          tags.push({ tag: 'meta', attrs: { name: 'robots', content: 'noindex, nofollow' }, injectTo: 'head' })
        }
        if (favicon) {
          tags.push({ tag: 'link', attrs: { rel: 'icon', href: favicon }, injectTo: 'head' })
        }
        if (title) {
          tags.push({ tag: 'meta', attrs: { property: 'og:title', content: title }, injectTo: 'head' })
        }
        if (description) {
          tags.push({ tag: 'meta', attrs: { property: 'og:description', content: description }, injectTo: 'head' })
        }
        if (socialImage) {
          tags.push(
            { tag: 'meta', attrs: { property: 'og:image', content: socialImage }, injectTo: 'head' },
            { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' }, injectTo: 'head' },
            { tag: 'meta', attrs: { name: 'twitter:image', content: socialImage }, injectTo: 'head' },
          )
        }

        if (googleAnalyticsId) {
          tags.push(
            {
              tag: 'script',
              attrs: {
                async: true,
                src: `https://www.googletagmanager.com/gtag/js?id=${googleAnalyticsId}`,
              },
              injectTo: 'head',
            },
            {
              tag: 'script',
              children: `
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', ${JSON.stringify(googleAnalyticsId)});
`,
              injectTo: 'head',
            },
          )
        }

        if (config.accessibility?.addBypassLinks) {
          tags.push(
            {
              tag: 'style',
              children: `
  .figma-bypass-link {
    position: fixed;
    top: 8px;
    left: 8px;
    z-index: 2147483647;
    transform: translateY(-150%);
    border-radius: 6px;
    background: #111827;
    color: #fff;
    padding: 8px 12px;
    font: 600 14px/1.2 system-ui, sans-serif;
    text-decoration: none;
  }
  .figma-bypass-link:focus {
    transform: translateY(0);
  }
`,
              injectTo: 'head',
            },
            {
              tag: 'a',
              attrs: { class: 'figma-bypass-link', href: '#root' },
              children: 'Skip to content',
              injectTo: 'body-prepend',
            },
          )
        }

        return {
          html: result,
          tags,
        }
      },
    },
  }
}

/**
 * Replay the most recent build error to clients that connect after
 * it was first broadcast. Vite buffers an error payload only while
 * no clients are connected and clears the buffer on the first
 * reconnect (see `bufferedMessage` in `createWebSocketServer`), so
 * if the preview iframe reloads after Vite already delivered an
 * error to a live socket, the new socket misses the payload and
 * the overlay stays hidden even though the build is still broken.
 * We intercept `ws.send` to remember the latest error and replay
 * it on every new connection; the cache clears on a successful
 * `update` or `full-reload` so a stale overlay can't survive a
 * fixed build.
 */
function figmaErrorOverlayReplay(): Plugin {
  return {
    name: 'figma-error-overlay-replay',
    apply: 'serve',
    configureServer(server) {
      let lastError: object | null = null

      const origSend = server.ws.send.bind(server.ws) as (...args: any[]) => void
      server.ws.send = ((...args: any[]) => {
        const payload = args[0]
        if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
          const type = (payload as { type?: string }).type
          if (type === 'error') {
            lastError = payload as object
          } else if (type === 'update' || type === 'full-reload') {
            lastError = null
          }
        }
        return origSend(...args)
      }) as typeof server.ws.send

      server.ws.on('connection', (socket) => {
        if (lastError !== null) {
          socket.send(JSON.stringify(lastError))
        }
      })
    },
  }
}

/**
 * Reload when a module that previously defined a React Refresh boundary stops
 * defining one. This happens when an agent moves a component into a new file
 * and replaces the old module with a re-export:
 *
 *   export { default } from './app/App'
 *
 * Vite otherwise accepts the update using the previous module's HMR boundary,
 * but the re-export-only transform no longer registers a replacement for the
 * mounted component family. React reports a successful refresh while leaving
 * the old tree mounted until the page is reloaded.
 */
function figmaReactRefreshBoundaryFallback(): Plugin {
  const hadRefreshBoundary = new Map<string, boolean>()
  let sendFullReload: (() => void) | null = null

  return {
    name: 'figma-react-refresh-boundary-fallback',
    apply: 'serve',
    enforce: 'post',
    configureServer(server) {
      sendFullReload = () => server.ws.send({ type: 'full-reload', path: '*' })
    },
    transform(code, id) {
      if (!/\.[jt]sx?(?:\?|$)/.test(id) || id.includes('/node_modules/')) return null

      const moduleId = id.split('?')[0] ?? id
      const hasRefreshBoundary = code.includes('registerExportsForReactRefresh')
      const previousHadRefreshBoundary = hadRefreshBoundary.get(moduleId)
      hadRefreshBoundary.set(moduleId, hasRefreshBoundary)

      if (previousHadRefreshBoundary && !hasRefreshBoundary) {
        queueMicrotask(() => sendFullReload?.())
      }

      return null
    },
  }
}

/**
 * Serves a blank render-target page at /.figma/make/kit.html that
 * the Figma preview script drives directly. The page exposes a
 * registry of every file matching `storiesGlob` on
 * window.__FIGMA__.stories so the design surface can dynamically
 * import + mount each entry into its own grid view.
 *
 * Dev-only: `apply: 'serve'` gates the plugin to `vite dev`. Prod
 * builds (`vite build`) skip it entirely so the route doesn't leak
 * into shipped bundles.
 */
function figmaMakeKitPlugin(options: { storiesGlob: string | string[] }): Plugin {
  const storiesGlob = Array.isArray(options.storiesGlob) ? options.storiesGlob : [options.storiesGlob]
  const ROUTE = '/.figma/make/kit.html'
  const VIRTUAL_ID = 'virtual:figma-stories'
  const RESOLVED_ID = '\0' + VIRTUAL_ID
  const STORIES_MODULE = `export const stories = import.meta.glob(${JSON.stringify(storiesGlob)})`
  const HTML_BOOTSTRAP = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body>
<div id="figma-make-kit-root"></div>
<script type="module">
  import { stories } from 'virtual:figma-stories'
  window.__FIGMA__ = Object.assign(window.__FIGMA__ ?? {}, { stories })
  window.dispatchEvent(new CustomEvent('figma.ready'))
</script>
</body>
</html>`

  return {
    name: 'figma-make-kit',
    apply: 'serve',
    resolveId(id) {
      if (id === VIRTUAL_ID) return RESOLVED_ID
      return null
    },
    load(id) {
      if (id !== RESOLVED_ID) return null
      return STORIES_MODULE
    },
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url || ''
        if (url.split('?')[0] !== ROUTE) return next()

        try {
          res.setHeader('Content-Type', 'text/html')
          res.end(await server.transformIndexHtml(url, HTML_BOOTSTRAP))
        } catch (err) {
          next(err as Error)
        }
      })
    },
  }
}
