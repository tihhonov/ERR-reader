import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    proxy: {
      '/api/rss': {
        target: 'https://www.err.ee',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/rss/, '/rss'),
        secure: false
      },
      '/api/rus-rss': {
        target: 'https://rus.err.ee',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/rus-rss/, '/rss'),
        secure: false
      },
      '/api/en-rss': {
        target: 'https://news.err.ee',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/en-rss/, '/rss'),
        secure: false
      }
    }
  }
})
