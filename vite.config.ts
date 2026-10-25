import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Forward API calls to the Spring Boot app, so the browser sees a single
    // origin and the backend doesn't need CORS configuration.
    // Set API_URL to point at a different backend, e.g. API_URL=http://localhost:8081 npm run dev
    proxy: {
      '/api': process.env.API_URL ?? 'http://localhost:8080',
    },
  },
})
