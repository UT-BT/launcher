import { resolve } from 'node:path'
import { defineConfig, type PlaywrightTestConfig } from '@playwright/test'
import base from '../../playwright.config'

const root = resolve(__dirname, '../..')
const webServer = base.webServer as NonNullable<PlaywrightTestConfig['webServer']> & { command: string; url: string }

export default defineConfig({
  testDir: '.',
  testMatch: /refresh-fixtures\.ts$/,
  outputDir: resolve(root, 'test-results/refresh-fixtures'),
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 600_000,
  reporter: 'list',
  use: { baseURL: webServer.url, trace: 'off', actionTimeout: 30_000, navigationTimeout: 30_000 },
  webServer: { ...webServer, cwd: root },
})
