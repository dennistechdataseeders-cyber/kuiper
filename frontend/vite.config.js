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
      rolldownOptions: {
        output: {
          // A few long-lived vendor groups instead of one chunk per npm package (which made
          // dozens of requests). Heavy libraries get their own chunk so only the pages that use
          // them download them: three (sidebar particles / login background), charts, excel.
          // Higher priority wins when a module matches several groups (each group also pulls in
          // its dependencies, so react must be claimed by react-vendor first).
          codeSplitting: {
            groups: [
              { name: 'react-vendor', test: /[\/]node_modules[\/](react|react-dom|scheduler)[\/]/, priority: 50 },
              { name: 'router', test: /[\/]node_modules[\/](react-router|react-router-dom)[\/]/, priority: 40 },
              { name: 'ui', test: /[\/]node_modules[\/](framer-motion|motion-dom|motion-utils|lucide-react|react-hot-toast|goober)[\/]/, priority: 30 },
              { name: 'three', test: /[\/]node_modules[\/](three|three-stdlib|@react-three|maath|its-fine|suspend-react|zustand|react-use-measure|troika-three-text|troika-three-utils|troika-worker-utils|camera-controls|meshline|stats-gl|stats\.js|three-mesh-bvh|detect-gpu|@monogrid|hls\.js|tunnel-rat|use-sync-external-store)[\/]/, priority: 20 },
              { name: 'charts', test: /[\/]node_modules[\/](chart\.js|react-chartjs-2|@kurkle)[\/]/, priority: 20 },
              { name: 'excel', test: /[\/]node_modules[\/](xlsx|exceljs|file-saver|jszip)[\/]/, priority: 20 },
            ],
          },
        },
      },
    },
  };
});