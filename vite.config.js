import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: { outDir: 'dist' },
  server: {
    port: 5173,
    // Proxy API calls to the backend so you don't get CORS errors in dev
    proxy: {
      '/api': {
        target:       'http://localhost:5000',
        changeOrigin: true,
      }
    }
  }
});
