import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const proxyTarget = env.API_PROXY_TARGET || process.env.API_PROXY_TARGET || 'https://test.aiedu.com.kz'

  return {
    plugins: [react(), tailwindcss()],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
          headers: {
            origin: proxyTarget,
            referer: proxyTarget.endsWith('/') ? proxyTarget : proxyTarget + '/'
          }
        }
      }
    }
  }
})
