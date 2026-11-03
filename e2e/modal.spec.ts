import { expect, test, type Locator, type Page } from '@playwright/test'
import { serveFixtureSet } from './mobile/fixtures/router'
import { capDetail } from './mobile/manifest/cap-detail'
import { centreX, contentAreaCentreX, mockApi, sidebarRail } from './sidebarRail'

const TABLET = { width: 820, height: 1180 }

async function signIn(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('utbt:webAuth:v1', JSON.stringify({
            discordId: '100',
            username: 'tester',
            avatar: '',
            accessToken: 'token',
            refreshToken: 'refresh-token',
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }))
    })
}

async function serveTeamlessViewer(page: Page) {
    await mockApi(page)
    await page.route(/https:\/\/api\.utbt\.net\/.*/, async route => {
        const path = new URL(route.request().url()).pathname.replace(/\/$/, '')
        const ok = (data: unknown) => route.fulfill({ json: { success: true, data } })
        if (path === '/users/me') return ok({ id: '100', alias: 'Tester', utbt_role: 0 })
        if (path === '/me/team') return ok({ team: null })
        if (path === '/teams') return ok({ total: 0, ranked_teams: 0, teams: [] })
        return route.fallback()
    })
}

function dialog(page: Page, title: string | RegExp): Locator {
    return page.locator('[data-modal-backdrop] > div').filter({ has: page.getByRole('heading', { name: title, exact: true }) })
}

async function tapBackdrop(page: Page, isMobile: boolean) {
    const size = page.viewportSize()!
    const point = { x: size.width - 8, y: size.height - 8 }
    if (isMobile) await page.touchscreen.tap(point.x, point.y)
    else await page.mouse.click(point.x, point.y)
}

async function openTeams(page: Page, isMobile: boolean) {
    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    if (isMobile) await page.setViewportSize(TABLET)
    await page.goto('/teams')
}

test.describe('backdrop', () => {
    test('a backdrop tap closes a plain modal', async ({ page, isMobile }) => {
        await mockApi(page)
        await openTeams(page, isMobile)
        await page.getByRole('button', { name: 'Create Team' }).click()
        const prompt = dialog(page, 'Sign in to create a team')
        await expect(prompt).toBeVisible()
        await expect(prompt.locator('xpath=..')).toHaveCSS('backdrop-filter', isMobile ? 'none' : 'blur(8px)')

        await tapBackdrop(page, isMobile)

        await expect(prompt).toHaveCount(0)
    })

    test('a backdrop tap leaves a modal with unsaved input open, and its header close still closes it', async ({ page, isMobile }) => {
        await signIn(page)
        await serveTeamlessViewer(page)
        await openTeams(page, isMobile)
        await page.getByRole('button', { name: 'Create Team' }).click()
        const form = dialog(page, 'Create a Team')
        await expect(form).toBeVisible()

        await tapBackdrop(page, isMobile)

        await expect(form).toBeVisible()
        await form.getByRole('button', { name: 'Close modal' }).click()
        await expect(form).toHaveCount(0)
    })
})

test.describe('desktop card', () => {
    test.beforeEach(({ isMobile }) => {
        test.skip(isMobile, 'the centred card with the sidebar offset is the desktop layout')
    })

    for (const size of [{ width: 1280, height: 800 }, { width: 1920, height: 1080 }]) {
        test.describe(`${size.width}x${size.height}`, () => {
            test.use({ viewport: size })

            async function expectCentredCard(page: Page, panel: Locator, width: number) {
                const box = (await panel.boundingBox())!
                expect(box.width).toBe(width)
                expect(Math.abs(await centreX(panel) - await contentAreaCentreX(page))).toBeLessThanOrEqual(1)
                expect(Math.abs(box.y + box.height / 2 - size.height / 2)).toBeLessThanOrEqual(1)
                await expect(panel).toHaveCSS('max-height', `${size.height * 0.9}px`)
                await expect(panel).toHaveCSS('border-radius', '12px')
                const backdrop = panel.locator('xpath=..')
                await expect(backdrop).toHaveCSS('backdrop-filter', 'blur(8px)')
                await expect(backdrop).toHaveCSS('background-color', 'oklab(0 0 0 / 0.8)')
                const railRight = await sidebarRail(page).evaluate(rail => rail.getBoundingClientRect().right)
                await expect(backdrop).toHaveCSS('padding-left', `${railRight + 16}px`)
            }

            test('a page modal keeps its size, position, blur and sidebar offset', async ({ page }) => {
                await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
                await serveFixtureSet(page, capDetail.fixtures)
                await page.goto(capDetail.path)
                await capDetail.ready(page)
                await capDetail.modals![0].open(page)

                await expectCentredCard(page, dialog(page, /^Compare run/), 640)
            })

            test('an app modal keeps its size, position, blur and sidebar offset', async ({ page }) => {
                await mockApi(page)
                await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
                await page.goto('/')
                await expect(sidebarRail(page)).toBeAttached()
                await page.evaluate(() => window.dispatchEvent(new CustomEvent('open-patreon')))

                await expectCentredCard(page, dialog(page, 'Support UTBT'), 640)
            })
        })
    }
})
