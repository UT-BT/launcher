import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  define: {
    __WEB_TARGET__: 'false',
    __APP_VERSION__: '"0.0.0-test"',
  },
  resolve: {
    alias: {
      '@/app': resolve(__dirname, 'app'),
      '@/lib': resolve(__dirname, 'lib'),
      '@/resources': resolve(__dirname, 'resources'),
    },
  },
  test: {
    include: ['app/**/*.test.{ts,tsx}'],
  },
})
