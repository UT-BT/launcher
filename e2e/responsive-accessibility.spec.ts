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
  await navigation.getByRole('link', { name: 'Maps' }).click()
  await expect(navigation).toHaveAttribute('inert', '')

  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(navigation).not.toHaveAttribute('inert', '')
  await navigation.getByRole('link', { name: 'Players' }).click()
  await expect(page).toHaveURL(/\/players$/)
})

test('closed navigation becomes inert when resizing from desktop to mobile', async ({ page, isMobile }) => {
  test.skip(isMobile)
  const navigation = page.locator('aside#app-navigation')
  await expect(navigation).not.toHaveAttribute('inert', '')

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(navigation).toHaveAttribute('inert', '')

  const menu = page.getByRole('button', { name: 'Open navigation' })
  await menu.click()
  await expect(navigation).not.toHaveAttribute('inert', '')
  await navigation.getByRole('link', { name: 'Maps' }).click()
  await expect(page).toHaveURL(/\/maps$/)
  await expect(navigation).toHaveAttribute('inert', '')
})

test('navigation targets are real links that support new-tab clicks', async ({ page, isMobile }) => {
  test.skip(isMobile)
  const navigation = page.locator('aside#app-navigation')
  await expect(navigation.getByRole('link', { name: 'Maps' })).toHaveAttribute('href', '/maps')
  await expect(navigation.getByRole('link', { name: 'World Records' })).toHaveAttribute('href', '/world-records')

  await navigation.getByRole('link', { name: 'Maps' }).click({ modifiers: ['ControlOrMeta'] })
  await expect(page).toHaveURL(/\/$/)

  await navigation.getByRole('link', { name: 'Maps' }).click()
  await expect(page).toHaveURL(/\/maps$/)
})

test('settings drills down to a full-width panel on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('aside#app-navigation')).toBeAttached()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-settings')))

  const appearance = page.getByRole('button', { name: 'Appearance', exact: true })
  await expect(appearance).toBeVisible()
  await appearance.click()

  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible()
  const panelWidth = await page.locator('[data-modal-backdrop] main').evaluate(el => el.getBoundingClientRect().width)
  expect(panelWidth).toBeGreaterThan(250)
  await expect(page.locator('[data-modal-backdrop] aside')).toBeHidden()

  await page.getByRole('button', { name: 'Back to settings sections' }).click()
  await expect(appearance).toBeVisible()
})

test('settings keeps both panes at desktop width', async ({ page, isMobile }) => {
  test.skip(isMobile)
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(page.locator('aside#app-navigation')).toBeAttached()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-settings')))

  await expect(page.locator('[data-modal-backdrop] aside')).toBeVisible()
  await expect(page.locator('[data-modal-backdrop] main')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Back to settings sections' })).toBeHidden()
})

test('widening the viewport never shrinks the settings modal', async ({ page, isMobile }) => {
  test.skip(isMobile)
  await expect(page.locator('aside#app-navigation')).toBeAttached()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-settings')))
  await expect(page.locator('[data-modal-backdrop] main')).toBeAttached()

  const body = page.locator('[data-modal-backdrop] main').locator('xpath=..')
  const settledWidth = () => body.evaluate(el => new Promise<number>(resolve => {
    let last = -1
    const tick = () => {
      const width = el.getBoundingClientRect().width
      if (Math.abs(width - last) < 0.5) return resolve(width)
      last = width
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }))

  let previous = 0
  for (const width of [360, 640, 768, 900, 1023, 1024, 1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 800 })
    const measured = await settledWidth()
    expect(measured, `modal body shrank at ${width}px`).toBeGreaterThanOrEqual(previous - 1)
    previous = measured
  }
})

test('settings panels are sized by their container, not the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await expect(page.locator('aside#app-navigation')).toBeAttached()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-settings')))

  const panel = page.locator('[data-modal-backdrop] main')
  await expect(panel).toBeVisible()
  const containers = await panel.evaluate(el => {
    const parent = el.closest('[class*="@container/settings"]') as HTMLElement
    const read = (node: HTMLElement) => {
      const style = getComputedStyle(node)
      return { type: style.containerType, name: style.containerName }
    }
    return { panel: read(el), body: read(parent) }
  })
  expect(containers.panel.type).toBe('inline-size')
  expect(containers.panel.name).toContain('panel')
  expect(containers.body.type).toBe('inline-size')
  expect(containers.body.name).toContain('settings')
})

test('compact settings rail rows are tappable surfaces, not bare text', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('aside#app-navigation')).toBeAttached()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-settings')))

  const tile = page.getByRole('button', { name: 'Privacy', exact: true })
  await expect(tile).toBeVisible()
  const surface = await tile.evaluate(el => {
    const style = getComputedStyle(el)
    return {
      background: style.backgroundColor,
      borderWidth: parseFloat(style.borderTopWidth),
      height: el.getBoundingClientRect().height,
    }
  })
  expect(surface.background).not.toBe('rgba(0, 0, 0, 0)')
  expect(surface.borderWidth).toBeGreaterThan(0)
  expect(surface.height).toBeGreaterThanOrEqual(44)
})

test('drilling in and back keeps focus inside the settings modal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('aside#app-navigation')).toBeAttached()
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-settings')))

  const appearance = page.getByRole('button', { name: 'Appearance', exact: true })
  await expect(appearance).toBeVisible()
  await appearance.click()

  const back = page.getByRole('button', { name: 'Back to settings sections' })
  await expect(back).toBeFocused()

  await back.click()
  await expect(appearance).toBeFocused()
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
