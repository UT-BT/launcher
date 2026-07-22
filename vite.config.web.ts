import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  root: 'app',
  define: {
    __WEB_TARGET__: 'true',
  },
  resolve: {
    alias: {
      '@/app': resolve(__dirname, 'app'),
      '@/lib': resolve(__dirname, 'lib'),
      '@/resources': resolve(__dirname, 'resources'),
    },
  },
  plugins: [tailwindcss(), react()],
  server: {
    port: 5174,
    watch: {
      ignored: ['**/test-results/**', '**/playwright-report/**'],
    },
  },
  build: {
    outDir: resolve(__dirname, 'dist-web'),
    emptyOutDir: true,
    manifest: true,
  },
})
