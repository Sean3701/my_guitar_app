import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 部署到子路径（如 GitHub Pages 项目页 /my_guitar_app/）时：
//   VITE_BASE=/my_guitar_app/ npm run build
const base = process.env.VITE_BASE || '/';

export default defineConfig({
  base,
  plugins: [react()],
  server: { port: 5173 },
});
