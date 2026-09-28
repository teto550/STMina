import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

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

export default defineConfig({
  // React + Tailwind are only used by the React "islands" (src/react); the rest of the app is unchanged. See docs/REACT.md.
  plugins: [devKillSw, react(), tailwindcss()],
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
