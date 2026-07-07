import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        extension: 'extension.html',
      },
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://34.44.185.224:8080',
        changeOrigin: true,
        secure: false
      },
      '/hubs': {
        target: 'http://34.44.185.224:8080',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: 'http://34.44.185.224:8080',
        changeOrigin: true,
        secure: false
      },
      '/hubs': {
        target: 'http://34.44.185.224:8080',
        changeOrigin: true,
        secure: false,
        ws: true
      }
    }
  }
});
