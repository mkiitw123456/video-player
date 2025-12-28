import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/video-player/', // <--- 請注意：這裡要改成 '/您的儲存庫名稱/' (前後都要有斜線)
})