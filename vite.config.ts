import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

// base './' so the build works from any sub-path (GitHub Pages project sites).
export default defineConfig({
  base: './',
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5173 },
  build: { outDir: 'dist', sourcemap: false },
});
