import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
  },
  server: {
    proxy: {
      '/api/airquality': {
        target: 'https://airquality.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/airquality/, ''),
      },
      '/api/weather': {
        target: 'https://weather.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/weather/, ''),
      },
      '/api/pollen': {
        target: 'https://pollen.googleapis.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/pollen/, ''),
      },
    },
  },
});
