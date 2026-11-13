import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    basicSsl() // 开启本地 HTTPS 支持
  ],
  server: {
    https: true,
    cors: true
  }
})