// frontend/vite.config.js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [
      react(),
      // ANALYZE=1 npm run build -> bundle-stats.html / bundle-stats.json (not part of normal builds)
      ...(process.env.ANALYZE ? [
        visualizer({ filename: 'bundle-stats.html', gzipSize: true, template: 'treemap' }),
        visualizer({ filename: 'bundle-stats.json', gzipSize: true, template: 'raw-data' }),
      ] : []),
    ],
    base: '/',
    server: {
      host: '0.0.0.0',
      port: 5173,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:5000',
          changeOrigin: true,
          secure: false,
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              return id.toString().split('node_modules/')[1].split('/')[0].toString();
            }
          },
        },
      },
    },
  };
});