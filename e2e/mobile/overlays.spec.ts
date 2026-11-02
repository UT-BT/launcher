import { expect, test, type Locator, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { serveFixtureSet } from './fixtures/router'
import { swipeScroll } from './interactions'
import { crawlSurfaces, surfaceShown } from './manifest'
import { home } from './manifest/home'
import { maps } from './manifest/maps'
import { mapsDetail } from './manifest/maps-detail'
import { CONSENT_KEY } from './manifest/overlays'
import { servers } from './manifest/servers'
import { MODAL_ROOT, type MobileRouteEntry } from './manifest/types'
import { installProbe } from './rules/probe'
import { settleLayout } from './settle'

const SIZES = [{ width: 390, height: 844 }, { width: 844, height: 390 }]
const AUTH_KEY = 'utbt:webAuth:v1'
const PROFILE_PATH = /^https:\/\/api\.utbt\.net\/users\/me\/?(\?.*)?$/
const SETTINGS_CHUNK = /\/SettingsModalWeb[.-][^/]*$/
const DISTRIBUTION_CHUNK = /\/CapTimeDistributionModal(\.tsx|-[\w-]+\.js)(\?|$)/

interface RouteSetup {
    consentAsked?: boolean
    profile?: { status: number; json: unknown }
}

async function openRoute(page: Page, entry: MobileRouteEntry, { consentAsked = false, profile }: RouteSetup = {}) {
    const storage: Record<string, string> = { ...(consentAsked ? {} : { [CONSENT_KEY]: 'denied' }), ...entry.storage }
    await page.addInitScript(entries => {
        for (const [key, value] of Object.entries(entries)) localStorage.setItem(key, value)
    }, storage)
    await serveFixtureSet(page, entry.fixtures)
    if (profile) await signIn(page, profile)
    const surface = crawlSurfaces('pr').find(candidate => candidate.id === entry.view)
    if (!surface) throw new Error(`no crawl surface for ${entry.view}`)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(entry.path)
        await surfaceShown(surface)(page)
    })
    await settleLayout(page)
    await installProbe(page)
}

async function signIn(page: Page, profile: { status: number; json: unknown }) {
    await page.addInitScript(key => localStorage.setItem(key, JSON.stringify({
        discordId: '100',
        username: 'tester',
        avatar: '',
        accessToken: 'token',
        refreshToken: 'refresh-token',
        expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    })), AUTH_KEY)
    await page.route(PROFILE_PATH, route => route.fulfill(profile))
}

const SIGNED_IN = { status: 200, json: { success: true, data: { id: '100000000000000001', alias: 'Tester', utbt_role: 0 } } }

async function openUserMenuItem(page: Page, item: string) {
    await page.getByRole('button', { name: 'Open navigation' }).click()
    await page.locator('aside [aria-haspopup="menu"]').click()
    await page.getByRole('menuitem', { name: item }).click()
}

async function tapCentre(page: Page, target: Locator) {
    const box = await target.boundingBox()
    if (!box) throw new Error('the target is not rendered')
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
}

async function closeDrawer(page: Page) {
    const backdrop = page.getByRole('button', { name: 'Close navigation' })
    const box = await backdrop.boundingBox()
    if (!box) throw new Error('the drawer is not open')
    await backdrop.click({ position: { x: box.width - 8, y: box.height / 2 } })
    await expect(backdrop).toHaveCount(0)
    await settleLayout(page)
}

async function scrollPositions(page: Page): Promise<{ main: number; window: number }> {
    return page.evaluate(() => ({ main: document.querySelector('main')?.scrollTop ?? 0, window: window.scrollY }))
}

async function boxProblems(panel: Locator, close?: Locator): Promise<string[]> {
    const closeHandle = close ? await close.elementHandle() : null
    return panel.evaluate((box, control) => {
        const probe = window.__mobileProbe
        const area = probe.visualViewport()
        const problems: string[] = []
        const boxOutside = probe.outside(box, area)
        if (boxOutside) problems.push(`box: ${boxOutside}`)
        const rect = box.getBoundingClientRect()
        const left = Math.max(rect.left, area.left)
        const right = Math.min(rect.right, area.left + area.width)
        const top = Math.max(rect.top, area.top) + 2
        for (const x of [left + 12, (left + right) / 2, right - 12]) {
            const hit = document.elementFromPoint(x, top)
            if (!hit || !box.contains(hit)) problems.push(`the top edge at x ${Math.round(x)} is covered by ${hit ? probe.describe(hit) : 'nothing on screen'}`)
        }
        if (!control) return problems
        const controlOutside = probe.outside(control, area)
        if (controlOutside) problems.push(`close: ${controlOutside}`)
        const target = control.getBoundingClientRect()
        const hit = document.elementFromPoint(target.left + target.width / 2, target.top + target.height / 2)
        if (!hit || !control.contains(hit)) problems.push(`the close control is covered by ${hit ? probe.describe(hit) : 'nothing on screen'}`)
        return problems
    }, closeHandle)
}

async function topBarCoveredBy(overlay: Locator): Promise<string | null> {
    return overlay.evaluate(root => {
        const probe = window.__mobileProbe
        const menu = document.querySelector('button[aria-label="Open navigation"]')
        if (!menu || !probe.rendered(menu)) return 'there is no top bar'
        const rect = menu.getBoundingClientRect()
        const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2)
        return hit && root.contains(hit) ? null : `the hamburger is drawn over the overlay: the point hits ${hit ? probe.describe(hit) : 'nothing on screen'}`
    })
}

async function topBarBottom(page: Page): Promise<number> {
    return page.evaluate(() => {
        let node = document.querySelector('button[aria-label="Open navigation"]')
        while (node && getComputedStyle(node).position !== 'fixed') node = node.parentElement
        return node ? node.getBoundingClientRect().bottom : 0
    })
}

async function expectPageHeldStill(page: Page, before: { main: number; window: number }) {
    const moves = await swipeScroll(page, 2000)
    await settleLayout(page)
    expect(moves.filter(move => move.path === 'main' || move.path === 'window'), 'a swipe over the overlay scrolls neither the shell nor the window').toEqual([])
    expect(await scrollPositions(page)).toEqual(before)
}

async function expectPageFreed(page: Page) {
    const freed = await swipeScroll(page, 300, 'page')
    expect(freed.map(move => move.path), 'the shell scroller takes a swipe again').toEqual(['main'])
}

for (const size of SIZES) {
    test.describe(`${size.width}x${size.height}`, () => {
        test.use({ viewport: size, contextOptions: { screen: size } })

        test('the sign-out confirm draws above the top bar with Cancel in view, and holds the page still', async ({ page }) => {
            await openRoute(page, home, { profile: SIGNED_IN })
            const before = await scrollPositions(page)
            await openUserMenuItem(page, 'Sign out')
            const confirm = page.locator(MODAL_ROOT).filter({ has: page.getByRole('heading', { name: 'Sign Out' }) })
            const panel = confirm.getByRole('alertdialog')
            const cancel = panel.getByRole('button', { name: 'Cancel' })
            await cancel.waitFor()
            await settleLayout(page)

            expect(await topBarCoveredBy(confirm)).toBeNull()
            expect(await boxProblems(panel, cancel)).toEqual([])
            await expectPageHeldStill(page, before)

            await page.keyboard.press('Escape')
            await expect(confirm).toHaveCount(0)
            await closeDrawer(page)
            await expectPageFreed(page)
        })

        test('the settings placeholder is a sheet above the top bar with its close in view, and holds the page still', async ({ page }) => {
            await page.route(SETTINGS_CHUNK, () => undefined)
            await openRoute(page, home, { profile: SIGNED_IN })
            const before = await scrollPositions(page)
            await openUserMenuItem(page, 'Settings')
            const placeholder = page.locator(MODAL_ROOT).filter({ has: page.getByRole('status', { name: 'Loading settings' }) })
            const panel = placeholder.locator('> div')
            const close = panel.getByRole('button', { name: 'Close modal' })
            await close.waitFor()
            await settleLayout(page)

            expect(await topBarCoveredBy(placeholder)).toBeNull()
            expect(await boxProblems(panel, close)).toEqual([])
            await expectPageHeldStill(page, before)

            await tapCentre(page, close)
            await expect(placeholder).toHaveCount(0)
            await closeDrawer(page)
            await expectPageFreed(page)
        })

        test('the connection error covers the visible area with Retry in view, and the window stays still', async ({ page }) => {
            await page.addInitScript(key => localStorage.setItem(key, 'denied'), CONSENT_KEY)
            await serveFixtureSet(page, home.fixtures)
            await signIn(page, { status: 500, json: { success: false } })
            await page.goto('/')
            const error = page.locator(MODAL_ROOT).filter({ has: page.getByRole('heading', { name: 'Connection Error' }) })
            const panel = error.locator('> div')
            const retry = panel.getByRole('button', { name: 'Retry' })
            await retry.waitFor()
            await settleLayout(page)
            await installProbe(page)

            expect(await boxProblems(panel, retry)).toEqual([])
            const corners = await error.evaluate(root => {
                const area = window.__mobileProbe.visualViewport()
                return [[area.left + 1, area.top + 1], [area.left + area.width - 1, area.top + area.height - 1]]
                    .map(([x, y]) => document.elementFromPoint(x, y))
                    .every(hit => !!hit && root.contains(hit))
            })
            expect(corners, 'the error backdrop covers the whole visible area').toBe(true)
            const moves = await swipeScroll(page, 2000)
            expect(moves.filter(move => move.path === 'window')).toEqual([])
            expect(await page.evaluate(() => window.scrollY)).toBe(0)
        })

        test('the loading spinner of a lazy modal draws above the top bar and holds the page still', async ({ page }) => {
            await page.route(DISTRIBUTION_CHUNK, () => undefined)
            await openRoute(page, mapsDetail)
            const opener = page.getByRole('button', { name: /Median (Certified|Team) Time/ }).first()
            await opener.scrollIntoViewIfNeeded()
            await settleLayout(page)
            const before = await scrollPositions(page)
            await opener.click()
            const spinner = page.getByRole('status', { name: 'Loading', exact: true })
            await spinner.waitFor()
            await settleLayout(page)

            expect(await topBarCoveredBy(spinner)).toBeNull()
            expect(await boxProblems(spinner)).toEqual([])
            await expectPageHeldStill(page, before)
        })

        test('the tutorial card stays clear of the top bar with its close in view, and holds the page still', async ({ page }) => {
            await openRoute(page, servers)
            const before = await scrollPositions(page)
            const opener = page.getByRole('button', { name: 'Restart Servers tutorial' })
            await opener.click()
            const tutorial = page.getByRole('dialog', { name: 'Servers page tutorial' })
            const panel = tutorial.locator('> div')
            const close = panel.getByRole('button', { name: 'Close tutorial' })
            await close.waitFor()
            await settleLayout(page)

            expect(await boxProblems(panel, close)).toEqual([])
            const cardTop = await panel.evaluate(card => card.getBoundingClientRect().top)
            expect(cardTop, 'the card starts below the top bar').toBeGreaterThanOrEqual(await topBarBottom(page) - 0.5)
            await expectPageHeldStill(page, before)

            await tapCentre(page, close)
            await expect(tutorial).toHaveCount(0)
            await expectPageFreed(page)
        })

        test('the consent banner policy draws above the top bar with its close in view, and holds the page still', async ({ page }) => {
            await openRoute(page, home, { consentAsked: true })
            const before = await scrollPositions(page)
            await page.getByRole('button', { name: 'Read the privacy policy' }).click()
            const policy = page.locator(MODAL_ROOT).filter({ has: page.getByRole('heading', { name: 'Privacy Policy' }) })
            const panel = policy.locator('> div')
            const close = panel.getByRole('button', { name: 'Close modal' })
            await close.waitFor()
            await settleLayout(page)

            expect(await topBarCoveredBy(policy)).toBeNull()
            expect(await boxProblems(panel, close)).toEqual([])
            await expectPageHeldStill(page, before)

            await tapCentre(page, close)
            await expect(policy).toHaveCount(0)
            await expect(page.getByRole('button', { name: 'Read the privacy policy' })).toBeVisible()
            await expectPageFreed(page)
        })

        test('a multi-filter dropdown fits the visible area above the page, holds the page still and closes on Escape', async ({ page }) => {
            await openRoute(page, maps)
            await page.getByRole('button', { name: 'Filters', exact: true }).click()
            const trigger = page.getByRole('button', { name: /^Any/ }).first()
            await trigger.scrollIntoViewIfNeeded()
            await settleLayout(page)
            const before = await scrollPositions(page)
            await trigger.click()
            const menu = page.getByRole('menu')
            await menu.waitFor()
            await settleLayout(page)

            expect(await boxProblems(menu)).toEqual([])
            await expectPageHeldStill(page, before)

            await page.keyboard.press('Escape')
            await expect(menu).toHaveCount(0)
            await expectPageFreed(page)
        })

        test('a non-modal dropdown menu holds the page still on touch until it closes', async ({ page }) => {
            await openRoute(page, maps)
            await page.getByRole('button', { name: 'Filters', exact: true }).click()
            const trigger = page.getByRole('button', { name: /^Saved Filters/ })
            await trigger.scrollIntoViewIfNeeded()
            await settleLayout(page)
            const before = await scrollPositions(page)
            await trigger.click()
            const menu = page.getByRole('menu')
            await menu.waitFor()
            await settleLayout(page)

            expect(await boxProblems(menu)).toEqual([])
            await expectPageHeldStill(page, before)

            await page.keyboard.press('Escape')
            await expect(menu).toHaveCount(0)
            await expectPageFreed(page)
        })
    })
}
