import { expect, test, type Locator, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { mockApi, preseedCollapsedRail, sidebarRail, sidebarToggle } from './sidebarRail'

function joinTile(page: Page): Locator {
    return sidebarRail(page).getByRole('link', { name: /^Join\b/ })
}

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

test.beforeEach(async ({ page, isMobile }) => {
    test.skip(isMobile, 'the rail only exists at desktop widths')
    await mockApi(page)
})

test('the collapsed Join tile is a square captioned link to Servers', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await openCollapsed(page)
    const tile = joinTile(page)

    await expect(tile).toBeVisible()
    await expect(tile).toHaveAccessibleName(/^Join\b.*Join Server/)
    await expect(tile.getByText('Join', { exact: true })).toBeVisible()
    await expect(tile).toHaveAttribute('href', '/servers')

    const bounds = await box(tile)
    expect(bounds.height).toBeGreaterThanOrEqual(44)
    expect(Math.abs(bounds.width - bounds.height)).toBeLessThanOrEqual(1)

    await tile.click()
    await expect(page).toHaveURL(/\/servers$/)
})

test('the web build shows no Play tile in the collapsed rail', async ({ page }) => {
    await openCollapsed(page)
    await expect(joinTile(page)).toBeVisible()
    await expect(sidebarRail(page).getByRole('button', { name: /Play|Launch Game/ })).toHaveCount(0)
    await expect(sidebarRail(page).getByText('Play', { exact: true })).toHaveCount(0)
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
    test(`the collapsed logo and Join tile fit the rail at 1024x${height}`, async ({ page }) => {
        await page.setViewportSize({ width: 1024, height })
        await openCollapsed(page)
        const rail = await box(sidebarRail(page))

        for (const locator of [sidebarLogo(page), joinTile(page)]) {
            const bounds = await box(locator)
            expect(bounds.x).toBeGreaterThanOrEqual(rail.x)
            expect(bounds.x + bounds.width).toBeLessThanOrEqual(rail.x + rail.width)
        }
        expect((await box(joinTile(page))).height).toBeGreaterThanOrEqual(44)

        const caption = joinTile(page).getByText('Join', { exact: true })
        expect(await caption.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0)
        expect(await sidebarRail(page).evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(0)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    })
}

test('the expanded sidebar keeps the full-width Join Server button and logo', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/')
    await expect(sidebarToggle(page)).toHaveAccessibleName('Collapse sidebar')

    const button = sidebarRail(page).getByRole('link', { name: 'Join Server', exact: true })
    await expect(button.getByText('Join Server', { exact: true })).toBeVisible()
    await expect(button).toHaveAttribute('href', '/servers')
    expect((await box(button)).width).toBeGreaterThan(200)
    expect((await box(sidebarLogo(page))).width).toBeGreaterThan(80)
})
