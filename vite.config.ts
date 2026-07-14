import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/brasfoot-site/',
  server: {
    open: true,
    port: 3000,
    host: true,
  },
})
