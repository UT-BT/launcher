import { expect, test, type BrowserContext, type Page } from '@playwright/test'
import type { Celebration } from '../app/utils/api'

const SHOTS_DIR = process.env.CELEBRATION_SHOTS_DIR
const SETTLE_MS = 3000

const GOLD = { name: '2026 2v2 World Champion', rarity: 5, color_r: 255, color_g: 215, color_b: 0 }

const CELEBRATION: Celebration = {
    slug: '2v2-cup-2026',
    name: 'UTBT 2v2 World Cup 2026',
    ends_at: '2026-11-15T22:59:00+00:00',
    final_score: { winner: 4, loser: 2 },
    message: 'A huge thanks to all the players for making our first team cup a huge success.',
    podium: [
        {
            place: 1,
            team: {
                id: 'f71e4c4d-99d1-47b1-9bce-4e3c100390fa',
                name: 'BAD BOYS',
                members: [
                    { user: '1254416467160596565', alias: 'Bakica', title: GOLD },
                    { user: '290449564887023617', alias: 'Dylanbroo', title: GOLD },
                ],
            },
        },
        {
            place: 2,
            team: {
                id: 'a7df888c-529e-434c-b6f3-3807cb1d4ca5',
                name: '2 guys 1 cap',
                members: [
                    { user: '290062867452133377', alias: 'soupy', title: null },
                    { user: '424992398657978370', alias: 'kleps', title: null },
                ],
            },
        },
        {
            place: 3,
            team: {
                id: '37be3dfc-e7e8-4703-9a24-5ca4a92fca2b',
                name: 'Puzzle Masters',
                members: [
                    { user: '260007417478250497', alias: 'Xclusive', title: null },
                    { user: '265561225428074496', alias: 'Arturek ;)', title: null },
                ],
            },
        },
    ],
}

async function serveApi(context: BrowserContext, celebration: Celebration | null) {
    await context.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        const path = decodeURIComponent(url.pathname).replace(/\/$/, '')
        if (path.endsWith('/avatar')) {
            if (SHOTS_DIR) await route.continue()
            else await route.fulfill({ status: 404, body: '' })
            return
        }
        if (url.hostname === 'gateway.utbt.net') {
            await route.fulfill({ json: [] })
            return
        }
        const data = path === '/tournaments/celebration'
            ? { celebration }
            : path.endsWith('/count') ? { count: 0 } : []
        await route.fulfill({ json: { success: true, data } })
    })
}

async function asAPerson(context: BrowserContext) {
    await context.addInitScript(() => {
        Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
    })
}

function dialog(page: Page) {
    return page.getByRole('dialog', { name: 'Congratulations to the champions' })
}

test.beforeEach(async ({ page }) => {
    page.on('pageerror', error => console.error('BROWSER PAGE ERROR:', error.message))
})

test('preview frames for review', async ({ page, context }, testInfo) => {
    test.skip(!SHOTS_DIR, 'set CELEBRATION_SHOTS_DIR to capture preview frames')
    test.setTimeout(120_000)
    await asAPerson(context)
    await serveApi(context, CELEBRATION)

    await page.goto('/')
    await expect(dialog(page)).toBeVisible({ timeout: 60_000 })
    await page.waitForTimeout(650)
    await page.screenshot({ path: `${SHOTS_DIR}/celebration-burst-${testInfo.project.name}.png`, timeout: 60_000 })
    await page.waitForTimeout(3000)
    await page.screenshot({ path: `${SHOTS_DIR}/celebration-${testInfo.project.name}.png`, timeout: 60_000 })
})

test('a visitor sees the champions once, and never again', async ({ page, context }) => {
    await asAPerson(context)
    await serveApi(context, CELEBRATION)

    await page.goto('/')
    const popup = dialog(page)
    await expect(popup).toBeVisible()
    await expect(popup.locator('[data-champion-name]')).toHaveText('BAD BOYS')
    await expect(popup.getByText('Bakica')).toBeVisible()
    await expect(popup.getByText('Dylanbroo')).toBeVisible()
    await expect(popup.getByText('Grand Final')).toBeVisible()
    await expect(popup.locator('[data-final-score]')).toHaveText('4–2')
    await expect(popup.getByText('Runner-up')).toBeVisible()
    await expect(popup.getByText('2 guys 1 cap', { exact: true }).last()).toBeVisible()
    await expect(popup.getByText('Third place')).toBeVisible()
    await expect(popup.getByText('Puzzle Masters')).toBeVisible()
    await expect(popup.getByText('Arturek ;)')).toBeVisible()
    await expect(popup.locator('[data-celebration-note]')).toHaveText(CELEBRATION.message!)

    await popup.getByRole('button', { name: 'Close' }).first().click()
    await expect(popup).toBeHidden()

    await page.reload()
    await page.waitForTimeout(SETTLE_MS)
    await expect(dialog(page)).toBeHidden()
})

test('Escape dismisses the celebration', async ({ page, context }) => {
    await asAPerson(context)
    await serveApi(context, CELEBRATION)

    await page.goto('/')
    await expect(dialog(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toBeHidden()
})

test('the stats button opens the cup on its stats tab', async ({ page, context }) => {
    await asAPerson(context)
    await serveApi(context, CELEBRATION)

    await page.goto('/')
    await dialog(page).getByRole('link', { name: 'See the cup stats' }).click()
    await expect(dialog(page)).toBeHidden()
    await expect(page).toHaveURL(/\/events\/2v2-cup-2026/)
})

test('a champion opens their profile and the celebration steps aside', async ({ page, context }) => {
    await asAPerson(context)
    await serveApi(context, CELEBRATION)

    await page.goto('/')
    await dialog(page).getByRole('link', { name: 'Bakica' }).first().click()
    await expect(page).toHaveURL(/\/players\/1254416467160596565/)
    await expect(dialog(page)).toBeHidden()
})

test('nothing shows when there is nothing to celebrate', async ({ page, context }) => {
    await asAPerson(context)
    await serveApi(context, null)

    await page.goto('/')
    await page.waitForTimeout(SETTLE_MS)
    await expect(dialog(page)).toBeHidden()
})

test('an automated browser is never shown the celebration', async ({ page, context }) => {
    await serveApi(context, CELEBRATION)

    await page.goto('/')
    await page.waitForTimeout(SETTLE_MS)
    await expect(dialog(page)).toBeHidden()
})
