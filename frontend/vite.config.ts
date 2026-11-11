import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  // 같은 Wi-Fi의 폰에서 https://<PC IP>:5173 으로 접속하기 위해 외부 노출
  server: { host: true },
})
