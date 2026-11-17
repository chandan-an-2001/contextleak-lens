import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [{name:'local-development-csp',apply:'serve',transformIndexHtml:{order:'pre',handler:html=>html.replace(/<meta http-equiv="Content-Security-Policy"[^>]*\/>/,'')}},react()],
  base: process.env.VITE_BASE_PATH || './',
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
  build: { target: 'es2022', chunkSizeWarningLimit: 700 },
});
