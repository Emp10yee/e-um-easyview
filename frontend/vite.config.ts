import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  // 같은 Wi-Fi의 폰에서 https://<PC IP>:5173 으로 접속하기 위해 외부 노출
  server: {
    host: true,
    // 백엔드(http://127.0.0.1:3000)를 같은 출처로 연결. 폰의 Origin은 백엔드 허용 목록에 없어서 지움
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        configure: (proxy) => proxy.on('proxyReq', (req) => req.removeHeader('origin')),
      },
    },
  },
})
