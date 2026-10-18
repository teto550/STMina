import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

// base './' so the build works from any sub-path (GitHub Pages project sites).
// Dev only: answer /sw.js with a worker that removes itself and its caches, so a production
// service worker left over from an earlier visit to localhost can't serve stale code.
const devKillSw = {
  name: 'dev-kill-service-worker',
  apply: 'serve' as const,
  configureServer(server) {
    server.middlewares.use('/sw.js', (_req, res) => {
      res.setHeader('Content-Type', 'text/javascript');
      res.setHeader('Cache-Control', 'no-store');
      res.end(`self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) await caches.delete(k);
  await self.registration.unregister();
  for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url);
})()));`);
    });
  },
};

// VERSION NUMBER = "version" in package.json. It is raised (npm run version:bump) before every deployment: see CLAUDE.md.
// BUILD ID = that number + the commit + the time of THIS build. The id is written into the bundle (__APP_BUILD__) and into version.json
// next to it: the running app asks the server for version.json and, when the build differs from its own, offers a reload
// (src/api/version.ts). The service worker's cache name also comes from the version number (see sw-cache-version below).
const VERSION = JSON.parse(readFileSync(fileURLToPath(new URL('./package.json', import.meta.url)), 'utf8')).version as string;
const BUILT_AT = new Date().toISOString();
const GIT = (() => {
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim();
  } catch {
    return 'nogit';
  }
})();
const BUILD_ID = `${VERSION}-${GIT}-${BUILT_AT}`;

const emitVersionFile = {
  name: 'emit-version-json',
  apply: 'build' as const,
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: VERSION, build: BUILD_ID, builtAt: BUILT_AT }) });
  },
};

// public/sw.js is copied as it is; the cache name inside it follows the version number, so every new version starts a fresh cache
const swCacheVersion = {
  name: 'sw-cache-version',
  apply: 'build' as const,
  closeBundle() {
    const file = fileURLToPath(new URL('./dist/sw.js', import.meta.url));
    try {
      writeFileSync(file, readFileSync(file, 'utf8').replace(/const CACHE_VERSION = '[^']*';/, `const CACHE_VERSION = 'v${VERSION}';`));
    } catch (e) {
      console.warn('sw.js cache version was not set:', e);
    }
  },
};

export default defineConfig({
  // React + Tailwind are only used by the React "islands" (src/react); the rest of the app is unchanged. See docs/REACT.md.
  plugins: [devKillSw, emitVersionFile, swCacheVersion, react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(VERSION), __APP_BUILD__: JSON.stringify(BUILD_ID), __APP_BUILT_AT__: JSON.stringify(BUILT_AT) },
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: false },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
});
