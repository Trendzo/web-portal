import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// Dashboard for Trendzo (admin + retailer). Talks to the backend monolith on :3099.
// Path alias `@/*` mirrors the backend convention so imports read consistently.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, 'src') },
  },
  server: {
    proxy: {
      // Hits to /api are forwarded to the local backend so cookies/CORS stay simple in dev.
      '/api': { target: 'http://127.0.0.1:3099', changeOrigin: true },
    },
  },
});
