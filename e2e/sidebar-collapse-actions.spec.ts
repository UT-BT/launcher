import { expect, test, type Locator, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { mockApi, preseedCollapsedRail, sidebarRail, sidebarToggle } from './sidebarRail'

function sidebarLogo(page: Page): Locator {
    return sidebarRail(page).getByAltText('UTBT Logo')
}

async function box(locator: Locator) {
    const bounds = await locator.boundingBox()
    if (!bounds) throw new Error('element has no bounding box')
    return bounds
}

async function openCollapsed(page: Page, path = '/') {
    await preseedCollapsedRail(page)
    await page.goto(path)
    await expect(sidebarToggle(page)).toHaveAccessibleName('Expand sidebar')
}

async function expectNoGameActions(page: Page) {
    const rail = sidebarRail(page)
    await expect(sidebarLogo(page)).toBeVisible()
    await expect(rail.getByRole('link', { name: /Join Server/ })).toHaveCount(0)
    await expect(rail.getByRole('button', { name: /Play|Launch Game/ })).toHaveCount(0)
    for (const text of ['Join', 'Join Server', 'Play', 'Launch Game']) {
        await expect(rail.getByText(text, { exact: true })).toHaveCount(0)
    }
}

test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, 'the rail only exists at desktop widths')
    await mockApi(page)
})

test('the web build shows no Join or Play tile in the collapsed rail', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await openCollapsed(page)
    await expectNoGameActions(page)
})

test('the web build shows no Join Server or Launch Game button in the expanded sidebar', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    await expect(sidebarToggle(page)).toHaveAccessibleName('Collapse sidebar')
    await expectNoGameActions(page)
})

test('the collapsed rail shows the logo at about 40px', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await openCollapsed(page)
    const logo = sidebarLogo(page)

    await expect(logo).toBeVisible()
    const bounds = await box(logo)
    expect(bounds.width).toBeGreaterThanOrEqual(36)
    expect(bounds.width).toBeLessThanOrEqual(44)
})

test('clicking the small logo during a season fires the burst', async ({ page }) => {
    await openCollapsed(page, '/?season=halloween')
    const logo = sidebarLogo(page)

    await expect(logo).toHaveAttribute('src', /logo-halloween/)
    expect((await box(logo)).width).toBeLessThanOrEqual(44)
    await logo.click()
    await expect(page.locator('.seasonal-burst')).toHaveCount(1)
})

for (const height of [900, 720]) {
    test(`the collapsed logo fits the rail at 1024x${height}`, async ({ page }) => {
        await page.setViewportSize({ width: 1024, height })
        await openCollapsed(page)
        const rail = await box(sidebarRail(page))

        const bounds = await box(sidebarLogo(page))
        expect(bounds.x).toBeGreaterThanOrEqual(rail.x)
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(rail.x + rail.width)

        expect(await sidebarRail(page).evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    })
}

test('the expanded sidebar keeps the full-size logo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    await expect(sidebarToggle(page)).toHaveAccessibleName('Collapse sidebar')

    expect((await box(sidebarLogo(page))).width).toBeGreaterThan(80)
})
