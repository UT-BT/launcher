import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const mockApi = process.env.UTBT_LIVE_API !== '1'

test.beforeEach(async ({ page }) => {
  page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message))
  page.on('console', message => { if (message.type() === 'error') console.error('BROWSER CONSOLE:', message.text()) })
  if (mockApi) {
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
      const url = route.request().url()
      if (new URL(url).hostname === 'gateway.utbt.net') {
        await route.fulfill({ json: [] })
        return
      }
      const path = new URL(url).pathname.replace(/\/$/, '')
      const data = path === '/v2/summary' ? {
        global: { newMaps: 0, newRecords: 0 },
        achievements: [],
        recentWorldRecords: [],
        newMaps: [],
        latestPatch: null,
      } : path.endsWith('/count') ? { count: 0 } : []
      await route.fulfill({ json: { success: true, data } })
    })
  }
  await page.goto('/')
})

test('layout never overflows the viewport', async ({ page, isMobile }) => {
  const logos = page.getByAltText('UTBT Logo')
  await expect(isMobile ? logos.first() : logos.last()).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(1)
})

test('mobile drawer is keyboard accessible', async ({ page, isMobile }) => {
  test.skip(!isMobile)
  const menu = page.getByRole('button', { name: 'Open navigation' })
  await expect(menu).toBeVisible()
  await page.evaluate(() => {
    document.querySelector<HTMLButtonElement>('button[aria-label="Open navigation"]')?.click()
  })
  await expect(menu).toHaveAttribute('aria-expanded', 'true')
  await expect(page.getByRole('complementary', { name: 'Primary navigation' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(menu).toHaveAttribute('aria-expanded', 'false')
  await expect(menu).toBeFocused()
})

test('navigation remains interactive after closing the mobile drawer and resizing to desktop', async ({ page, isMobile }) => {
  test.skip(isMobile)
  await page.setViewportSize({ width: 390, height: 844 })

  await page.getByRole('button', { name: 'Open navigation' }).click()
  const navigation = page.locator('aside#app-navigation')
  await navigation.getByRole('button', { name: 'Maps' }).click()
  await expect(navigation).toHaveAttribute('inert', '')

  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(navigation).not.toHaveAttribute('inert', '')
  await navigation.getByRole('button', { name: 'Players' }).click()
  await expect(page).toHaveURL(/\/players$/)
})

test('primary pages have no serious accessibility violations', async ({ page }) => {
  const results = await new AxeBuilder({ page })
    .disableRules(['color-contrast'])
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
  expect(results.violations.filter(v => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual([])
})

test('@live public homepage smoke test', async ({ page }) => {
  test.skip(mockApi, 'Opt in with npm run test:e2e:live')
  await expect(page.getByText('UTBT.net', { exact: true }).first()).toBeVisible()
})

const publicRoutes = [
  '/', '/servers', '/maps', '/maps/CTF-BT-Test', '/players', '/players/1',
  '/teams', '/teams/test-team', '/world-records', '/cap-it-all', '/caps/test-cap',
  '/team-caps/test-team-cap', '/achievements', '/news', '/news/1',
]

test('every public route renders without the application error boundary', async ({ page }) => {
  for (const path of publicRoutes) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: 'Something went wrong' })).toHaveCount(0)
  }
})
