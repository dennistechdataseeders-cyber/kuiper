import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',  // expose to local network
    port: 5173,
    
    proxy: {
      '/api': {
        target: 'http://192.168.1.8:5000', // replace with your actual IP from ipconfig
        changeOrigin: true,
        secure: false,
      },
    },
  },
})