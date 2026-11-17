import { expect, test, type Page } from '@playwright/test'
import { horizontalOverflow } from './layout'
import { mockApi } from './sidebarRail'
import { SEASONAL_NOTICE_STORAGE_KEY } from '../app/components/pages/home/seasonalNoticeStorage'

async function clearNoticePresetOnce(page: Page, themeId = 'classic') {
    await page.addInitScript(({ key, id }) => {
        if (sessionStorage.getItem('e2e:seasonalNoticeCleared')) return
        sessionStorage.setItem('e2e:seasonalNoticeCleared', '1')
        localStorage.removeItem(key)
        localStorage.setItem('utbt:theme:v1', JSON.stringify({ id }))
    }, { key: SEASONAL_NOTICE_STORAGE_KEY, id: themeId })
}

function notice(page: Page) {
    return page.locator('[data-seasonal-notice]')
}

async function homeLoaded(page: Page) {
    await expect(page.getByText('Make UTBT yours')).toBeVisible()
    await page.waitForLoadState('networkidle')
}

async function storedDismissal(page: Page): Promise<unknown> {
    return page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? 'null'), SEASONAL_NOTICE_STORAGE_KEY)
}

function themeCard(page: Page, label: string) {
    return page.getByRole('button', { name: new RegExp(`^${label}`) })
}

test.beforeEach(async ({ page }) => {
    await mockApi(page)
})

test('the notice shows on Classic, and Try it opens Appearance and retires it', async ({ page }) => {
    await clearNoticePresetOnce(page)
    await page.goto('/')
    await expect(notice(page)).toContainText('New: Seasonal theme')
    await expect(notice(page)).toContainText('Follows the seasons and holidays where you are.')

    await notice(page).getByRole('button', { name: 'Try it' }).click()
    await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible()
    await expect(themeCard(page, 'Seasonal')).toBeVisible()
    await expect(notice(page)).toHaveCount(0)
    await expect.poll(() => storedDismissal(page)).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    await page.reload()
    await homeLoaded(page)
    await expect(notice(page)).toHaveCount(0)
})

test('the close button hides the notice for good', async ({ page }) => {
    await clearNoticePresetOnce(page)
    await page.goto('/')
    await notice(page).getByRole('button', { name: 'Dismiss the Seasonal theme notice' }).click()
    await expect(notice(page)).toHaveCount(0)
    await expect.poll(() => storedDismissal(page)).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    await page.reload()
    await homeLoaded(page)
    await expect(notice(page)).toHaveCount(0)
})

test('picking Seasonal retires the notice, even after switching back', async ({ page }) => {
    await clearNoticePresetOnce(page)
    await page.goto('/')
    await expect(notice(page)).toBeVisible()
    await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-settings')))
    await page.getByRole('button', { name: 'Appearance', exact: true }).click()
    await themeCard(page, 'Seasonal').click()
    await expect.poll(() => storedDismissal(page)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    await themeCard(page, 'UTBT Blue').click()

    await page.reload()
    await homeLoaded(page)
    await expect(notice(page)).toHaveCount(0)
})

test('the notice never shows while Seasonal is saved', async ({ page }) => {
    await clearNoticePresetOnce(page, 'seasonal')
    await page.goto('/')
    await homeLoaded(page)
    await expect(notice(page)).toHaveCount(0)
    await expect.poll(() => storedDismissal(page)).toMatch(/^\d{4}-\d{2}-\d{2}T/)
})

test.describe('at 360 px', () => {
    test.use({ viewport: { width: 360, height: 780 } })

    test('the notice fits with 44 px targets', async ({ page }) => {
        await clearNoticePresetOnce(page)
        await page.goto('/')
        await expect(notice(page)).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(1)
        for (const button of await notice(page).getByRole('button').all()) {
            const box = (await button.boundingBox())!
            expect(box.height).toBeGreaterThanOrEqual(44)
            expect(box.width).toBeGreaterThanOrEqual(44)
        }
        const box = (await notice(page).boundingBox())!
        expect(box.x + box.width).toBeLessThanOrEqual(360)
    })
})
