import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carga VITE_API_BASE_URL desde .env/.env.local (nunca hardcodeado en este archivo).
  // Configura el valor real en fronted/.env — ver .env.example.
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_BASE_URL || 'http://localhost:8080';
  // secure:false permite certificados self-signed en desarrollo; en producción
  // con un dominio y certificado válido (Fase 1 del plan de mejoras) puede
  // pasarse a true una vez el backend sirva HTTPS con un certificado confiable.
  const proxySecure = apiProxyTarget.startsWith('https://');

  return {
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
          target: apiProxyTarget,
          changeOrigin: true,
          secure: proxySecure
        },
        '/hubs': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: proxySecure,
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
          target: apiProxyTarget,
          changeOrigin: true,
          secure: proxySecure
        },
        '/hubs': {
          target: apiProxyTarget,
          changeOrigin: true,
          secure: proxySecure,
          ws: true
        }
      }
    }
  };
});
