import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 3D 바이닐(src/vinyl/webgl.ts)은 동적 import로 별도 청크가 된다.
// 개발 중 /api 요청은 npm run dev:api 로 띄운 서버(8787)로 넘긴다.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { proxy: { '/api': 'http://localhost:8787' } },
});
