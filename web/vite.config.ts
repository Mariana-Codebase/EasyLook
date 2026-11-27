import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the dev server forwards /api to the EasyLook API, so the browser
// talks to a single origin. In production set VITE_API_URL to the API base URL.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      ['/api', '/docs', '/openapi.json'].map((path) => [
        path,
        { target: process.env.API_PROXY_TARGET ?? 'http://localhost:3000', changeOrigin: true },
      ]),
    ),
  },
})
