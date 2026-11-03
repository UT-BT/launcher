import { resolve } from 'path'
import { defineConfig, devices } from '@playwright/test'

const port = process.env.E2E_PORT ?? '5175'
const origin = `http://127.0.0.1:${port}`
const SERVE_BUILD = process.env.E2E_SERVER === 'build'
const BUILD_DIR = resolve('dist-e2e')
const API_ENV = 'cross-env VITE_API_BASE_URL=https://api.utbt.net'
const DEV_SERVER = `${API_ENV} npm run dev:web -- --host 127.0.0.1 --port ${port}`
const BUILD_SERVER = `${API_ENV} vite build --config vite.config.web.ts --outDir "${BUILD_DIR}" --emptyOutDir --logLevel warn && vite preview --config vite.config.web.ts --outDir "${BUILD_DIR}" --host 127.0.0.1 --port ${port} --strictPort`
const BROADCAST_SPECS = /\.broadcast\.spec\.ts$/
const MOBILE_FOLDER = /[\\/]e2e[\\/]mobile[\\/]/
const MOBILE_SUITE = /[\\/]e2e[\\/]mobile[\\/].*\.spec\.ts$/
const SEASONAL_THEMES_OFF = {
  cookies: [],
  origins: [{ origin, localStorage: [{ name: 'utbt:seasonalThemes:v1', value: '"off"' }] }],
}

export default defineConfig({
  testDir: './e2e',
  snapshotPathTemplate: '{testDir}/__screenshots__/{testFilePath}/{arg}{-projectName}{-platform}{ext}',
  fullyParallel: false,
  workers: SERVE_BUILD ? 6 : 2,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [[process.env.CI ? 'github' : 'list'], ['./e2e/mobile/gallery-reporter.ts']],
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
    command: SERVE_BUILD ? BUILD_SERVER : DEV_SERVER,
    url: origin,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: 'desktop-chromium', testIgnore: [BROADCAST_SPECS, MOBILE_FOLDER], use: { ...devices['Desktop Chrome'], storageState: SEASONAL_THEMES_OFF } },
    { name: 'mobile-chromium', testIgnore: [BROADCAST_SPECS, MOBILE_FOLDER], use: { ...devices['Pixel 7'], storageState: SEASONAL_THEMES_OFF } },
    {
      name: 'mobile-suite-webkit',
      testMatch: MOBILE_SUITE,
      grepInvert: /@chromium-only/,
      fullyParallel: true,
      use: { ...devices['iPhone 14'], viewport: { width: 390, height: 844 }, contextOptions: { screen: { width: 390, height: 844 } }, storageState: SEASONAL_THEMES_OFF },
    },
    {
      name: 'mobile-suite-chromium',
      testMatch: MOBILE_SUITE,
      grepInvert: /@webkit-only/,
      fullyParallel: true,
      use: { ...devices['Pixel 7'], viewport: { width: 360, height: 780 }, contextOptions: { screen: { width: 360, height: 780 } }, storageState: SEASONAL_THEMES_OFF },
    },
    {
      name: 'broadcast',
      testMatch: BROADCAST_SPECS,
      use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
    },
  ],
})
