import { expect, test, type Page } from '@playwright/test'
import { serveFixtureSet } from './mobile/fixtures/router'
import { MAPS_LIST } from './mobile/fixtures/maps'
import { CAP_ID } from './mobile/fixtures/cap-detail'

const DESKTOP_WIDTHS = [1280, 1920]

async function openPage(page: Page, fixtures: string, path: string) {
    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:mapsPageTutorial:v1', JSON.stringify({ seen: true, version: 1 }))
    })
    await serveFixtureSet(page, fixtures)
    await page.goto(path)
}

async function controlFontSizes(page: Page): Promise<string[]> {
    return page.evaluate(() => Array.from(document.querySelectorAll<HTMLElement>('input, select, textarea'))
        .filter(control => control.getClientRects().length > 0)
        .map(control => {
            const name = control.getAttribute('aria-label') ?? control.getAttribute('placeholder') ?? control.getAttribute('type') ?? control.tagName.toLowerCase()
            return `${control.tagName.toLowerCase()} ${name}: ${getComputedStyle(control).fontSize}`
        }))
}

for (const width of DESKTOP_WIDTHS) {
    test.describe(`desktop shell at ${width}px`, () => {
        test.use({ viewport: { width, height: 1080 } })

        test.beforeEach(({ isMobile }) => {
            test.skip(isMobile, 'desktop layout only')
        })

        test('shows the blurred sidebar and no top bar or status strip', async ({ page }) => {
            await openPage(page, 'maps', '/maps')
            await page.getByText(MAPS_LIST[0].name.replace(/^CTF-BT-/, ''), { exact: true }).first().waitFor()
            await expect(page.getByRole('button', { name: 'Open navigation' })).toBeHidden()
            await expect(page.getByRole('button', { name: 'Reload app' })).toHaveCount(0)
            const sidebar = page.locator('aside#app-navigation')
            const box = await sidebar.boundingBox()
            expect(box).toMatchObject({ x: 0, y: 0, width: 256, height: 1080 })
            expect(await sidebar.evaluate(node => getComputedStyle(node).backdropFilter)).toContain('blur(24px)')
            const main = page.getByRole('main')
            expect(await main.evaluate(node => getComputedStyle(node).padding)).toBe('0px 4px 0px 0px')
        })

        test('keeps the Maps control font sizes', async ({ page }) => {
            await openPage(page, 'maps', '/maps')
            await page.getByText(MAPS_LIST[0].name.replace(/^CTF-BT-/, ''), { exact: true }).first().waitFor()
            expect(await controlFontSizes(page)).toEqual([
                'input Search for a map name or tag...: 14px',
                'select Rows per page: 12px',
            ])
        })

        test('keeps the cap page control font sizes', async ({ page }) => {
            await openPage(page, 'cap-detail', `/caps/${CAP_ID}`)
            await page.getByText('Checkpoint Deltas', { exact: true }).waitFor()
            expect(await controlFontSizes(page)).toEqual(['select select: 12px'])
        })
    })
}
