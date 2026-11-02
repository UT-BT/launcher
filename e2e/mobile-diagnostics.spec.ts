import { expect, test, type Locator, type Page } from '@playwright/test'
import { LONG_PRESS_MS } from '../app/device/diagnostics/diagnosticTrigger'
import { mockApi } from './sidebarRail'

const FIELDS = [
    'Viewport scale',
    'Viewport offset',
    'Viewport size',
    'Viewport page offset',
    'innerHeight',
    'innerWidth',
    'Window scroll',
    'Shell scroll',
    'Orientation',
    'Standalone',
    'Touch',
    'Below lg',
    'Safe area',
    'Open modals',
    'Scroll locks',
    'Active view',
    'Path',
]

async function openApp(page: Page, path = '/') {
    await mockApi(page)
    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await page.goto(path)
    await expect(page.getByAltText('UTBT Logo').filter({ visible: true })).toBeVisible()
}

function overlay(page: Page): Locator {
    return page.getByRole('region', { name: 'Mobile diagnostics' })
}

function field(page: Page, label: string): Locator {
    return overlay(page).locator('div').filter({ has: page.getByRole('term').getByText(label, { exact: true }) }).getByRole('definition')
}

function topBarLogo(page: Page): Locator {
    return page.getByAltText('UTBT Logo').first()
}

function railLogo(page: Page): Locator {
    return page.getByRole('complementary').getByAltText('UTBT Logo')
}

async function centreOf(locator: Locator): Promise<{ x: number; y: number }> {
    const box = await locator.boundingBox()
    if (!box) throw new Error('element has no bounding box')
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function touchLongPress(page: Page, target: Locator, untilShown: boolean) {
    const point = await centreOf(target)
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] })
    await expect(overlay(page)).toBeVisible({ visible: untilShown })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
}

async function mouseLongPress(page: Page, target: Locator, untilShown: boolean) {
    const point = await centreOf(target)
    await page.mouse.move(point.x, point.y)
    await page.mouse.down()
    await expect(overlay(page)).toBeVisible({ visible: untilShown })
    await page.mouse.up()
}

test.describe('on a phone', () => {
    test.beforeEach(({ isMobile }) => {
        test.skip(!isMobile, 'phone behaviour')
    })

    test('?debug=mobile shows every field, and the values follow the viewport', async ({ page }) => {
        await openApp(page, '/?debug=mobile')

        await expect(overlay(page)).toBeVisible()
        for (const label of FIELDS) {
            await expect(field(page, label), label).toHaveText(/\S/)
        }
        await expect(field(page, 'Viewport scale')).toHaveText('1')
        await expect(field(page, 'Touch')).toHaveText('yes')
        await expect(field(page, 'Below lg')).toHaveText('yes')
        await expect(field(page, 'Scroll locks')).toHaveText('0')
        await expect(field(page, 'Open modals')).toHaveText('0')
        await expect(field(page, 'Active view')).toHaveText('home')
        await expect(field(page, 'Orientation')).toHaveText('portrait')

        await page.setViewportSize({ width: 360, height: 740 })
        await expect(field(page, 'Viewport size')).toHaveText('360 × 740')
        await expect(field(page, 'innerHeight')).toHaveText('740')
        await expect(field(page, 'Orientation')).toHaveText('portrait')

        await page.setViewportSize({ width: 740, height: 360 })
        await expect(field(page, 'Viewport size')).toHaveText('740 × 360')
        await expect(field(page, 'innerHeight')).toHaveText('360')
        await expect(field(page, 'Orientation')).toHaveText('landscape')
    })

    test('the shell scroller position follows the page', async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 400 })
        await openApp(page, '/?debug=mobile')
        await expect(field(page, 'Shell scroll')).toHaveText(/^0 of [1-9]/)

        await page.getByRole('main').evaluate(main => main.scrollTo({ top: 100 }))
        await expect(field(page, 'Shell scroll')).toHaveText(/^100 of /)
    })

    test('Copy report puts the whole report on the clipboard', async ({ page, context }) => {
        await context.grantPermissions(['clipboard-read', 'clipboard-write'])
        await openApp(page, '/?debug=mobile')

        await overlay(page).getByRole('button', { name: 'Copy report' }).click()
        await expect(overlay(page).getByRole('status')).toHaveText('Report copied to the clipboard.')

        const report = await page.evaluate(() => navigator.clipboard.readText())
        const lines = report.split(/\r?\n/)
        expect(lines[0]).toBe('UTBT mobile diagnostics')
        expect(lines).toContainEqual(expect.stringMatching(/^Captured: \d{4}-\d{2}-\d{2}T/))
        for (const label of FIELDS) {
            expect(lines.some(line => line.startsWith(`${label}: `)), label).toBe(true)
        }
        expect(lines).toContain('Scroll locks: 0')
    })

    test('long-pressing the logo toggles the overlay; a tap does not', async ({ page }) => {
        await page.clock.install()
        await openApp(page)

        await touchLongPress(page, topBarLogo(page), true)
        await expect(field(page, 'Touch')).toHaveText('yes')

        await topBarLogo(page).tap()
        await page.clock.runFor(LONG_PRESS_MS * 2)
        await expect(overlay(page)).toBeVisible()
        await expect(page).toHaveURL(/\/$/)

        await touchLongPress(page, topBarLogo(page), false)
    })

    test('Close hides the overlay', async ({ page }) => {
        await openApp(page, '/?debug=mobile')
        await overlay(page).getByRole('button', { name: 'Close' }).click()
        await expect(overlay(page)).toBeHidden()
    })
})

test.describe('on desktop', () => {
    test.beforeEach(({ isMobile }) => {
        test.skip(isMobile, 'desktop behaviour')
    })

    for (const width of [1280, 1920]) {
        test(`no overlay without the trigger at ${width}`, async ({ page }) => {
            await page.setViewportSize({ width, height: 900 })
            await openApp(page)
            await expect(railLogo(page)).toBeVisible()
            await expect(overlay(page)).toHaveCount(0)
        })
    }

    test('long-pressing the rail logo toggles the overlay; a click does not', async ({ page }) => {
        await page.clock.install()
        await openApp(page)

        await mouseLongPress(page, railLogo(page), true)
        await expect(field(page, 'Touch')).toHaveText('no')
        await expect(field(page, 'Below lg')).toHaveText('no')

        await railLogo(page).click()
        await page.clock.runFor(LONG_PRESS_MS * 2)
        await expect(overlay(page)).toBeVisible()

        await mouseLongPress(page, railLogo(page), false)
    })
})
