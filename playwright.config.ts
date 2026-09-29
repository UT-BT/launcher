import { defineConfig, devices } from '@playwright/test'

const port = process.env.E2E_PORT ?? '5175'
const origin = `http://127.0.0.1:${port}`
const BROADCAST_SPECS = /\.broadcast\.spec\.ts$/

export default defineConfig({
  testDir: './e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{-projectName}{-platform}{ext}',
  fullyParallel: false,
  workers: 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  expect: {
    toHaveScreenshot: {
      threshold: 0.2,
      maxDiffPixelRatio: 0.001,
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
    },
  },
  use: {
    baseURL: origin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: `cross-env VITE_API_BASE_URL=https://api.utbt.net npm run dev:web -- --host 127.0.0.1 --port ${port}`,
    url: origin,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop-chromium', testIgnore: BROADCAST_SPECS, use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', testIgnore: BROADCAST_SPECS, use: { ...devices['Pixel 7'] } },
    {
      name: 'broadcast',
      testMatch: BROADCAST_SPECS,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
    },
  ],
})
