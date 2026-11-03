import { expect, test, type Locator, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { dataFrom, replyFor } from './fixtures/data'
import { fixtureSetNamed } from './fixtures/index'
import { serveFixtureSet } from './fixtures/router'
import { events } from './manifest/events'
import { home } from './manifest/home'
import { maps } from './manifest/maps'
import { MAP_NAME, mapsDetail } from './manifest/maps-detail'
import { news } from './manifest/news'
import { players } from './manifest/players'
import type { MobileRouteEntry } from './manifest/types'
import { worldRecords } from './manifest/world-records'
import { settleLayout } from './settle'

const API_HOSTS = /https:\/\/(api|gateway)\.utbt\.net\/.*/
const PORTRAIT = { width: 390, height: 844 }
const LANDSCAPE = { width: 844, height: 390 }
const TAB_NAMES = ['Home', 'Maps', 'World Records', 'Events']

interface Point {
    x: number
    y: number
}

interface DragOptions {
    steps?: number
    holdMs?: number
}

async function serveFixtureSets(page: Page, [first, ...others]: MobileRouteEntry[]) {
    await serveFixtureSet(page, first.fixtures)
    const primary = fixtureSetNamed(first.fixtures)!
    const sets = others.map(entry => fixtureSetNamed(entry.fixtures)!)
    await page.route(API_HOSTS, async route => {
        const url = new URL(route.request().url())
        const reply = replyFor(primary, url) ? null : sets.map(set => replyFor(set, url)).find(Boolean)
        if (!reply) return route.fallback()
        await route.fulfill({ status: reply.status ?? 200, json: reply.json }).catch(() => undefined)
    })
}

async function shown(page: Page, entry: MobileRouteEntry) {
    await entry.ready(page, dataFrom(fixtureSetNamed(entry.fixtures)!))
    await settleLayout(page)
}

async function open(page: Page, path: string, entries: MobileRouteEntry[]) {
    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:mapsPageTutorial:v1', JSON.stringify({ seen: true, version: 1 }))
    })
    await serveFixtureSets(page, entries)
    const first = entries.find(entry => entry.path === path) ?? entries[0]
    await reopenOnDroppedModule(page, async () => {
        await page.goto(path)
        await first.ready(page, dataFrom(fixtureSetNamed(first.fixtures)!))
    })
    await settleLayout(page)
}

function tabBar(page: Page): Locator {
    return page.getByRole('navigation', { name: 'Tab bar' })
}

function tab(page: Page, name: string): Locator {
    return tabBar(page).getByRole('link', { name })
}

function drawer(page: Page): Locator {
    return page.getByRole('complementary', { name: 'Primary navigation', includeHidden: true })
}

async function expectHighlighted(page: Page, highlighted: string | null) {
    for (const name of TAB_NAMES) {
        const expectation = expect(tab(page, name), `the ${name} tab`)
        if (name === highlighted) await expectation.toHaveAttribute('aria-current', 'page')
        else await expectation.not.toHaveAttribute('aria-current', 'page')
    }
}

async function drawerLeft(page: Page): Promise<number> {
    return drawer(page).evaluate(element => element.getBoundingClientRect().left)
}

async function expectDrawerOpen(page: Page) {
    await expect(drawer(page)).toBeInViewport({ ratio: 1 })
    await expect.poll(() => drawerLeft(page)).toBe(0)
}

async function expectDrawerClosed(page: Page) {
    await expect.poll(() => drawer(page).evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(0)
    await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toHaveAttribute('aria-expanded', 'false')
}

async function touchDrag(page: Page, from: Point, to: Point, { steps = 10, holdMs = 0 }: DragOptions = {}) {
    if (page.context().browser()?.browserType().name() !== 'chromium') return pointerDrag(page, from, to, { steps, holdMs })
    const session = await page.context().newCDPSession(page)
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] })
    for (let step = 1; step <= steps; step += 1) {
        const x = from.x + ((to.x - from.x) * step) / steps
        const y = from.y + ((to.y - from.y) * step) / steps
        await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] })
    }
    if (holdMs > 0) await page.waitForTimeout(holdMs)
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await session.detach()
}

async function pointerDrag(page: Page, from: Point, to: Point, { steps = 10, holdMs = 0, clickAtEnd = false }: DragOptions & { clickAtEnd?: boolean }) {
    await page.evaluate(async ({ from, to, steps, holdMs, clickAtEnd }) => {
        const target = document.elementFromPoint(from.x, from.y) ?? document.body
        const fire = (type: string, x: number, y: number) => target.dispatchEvent(new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId: 1,
            pointerType: 'touch',
            isPrimary: true,
            button: type === 'pointermove' ? -1 : 0,
            buttons: type === 'pointerup' ? 0 : 1,
            clientX: x,
            clientY: y,
        }))
        fire('pointerdown', from.x, from.y)
        for (let step = 1; step <= steps; step += 1) {
            fire('pointermove', from.x + ((to.x - from.x) * step) / steps, from.y + ((to.y - from.y) * step) / steps)
        }
        if (holdMs > 0) await new Promise(resolve => setTimeout(resolve, holdMs))
        fire('pointerup', to.x, to.y)
        if (clickAtEnd) target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true, clientX: to.x, clientY: to.y }))
    }, { from, to, steps, holdMs, clickAtEnd })
}

async function centreOf(locator: Locator): Promise<Point> {
    const box = await locator.boundingBox()
    if (!box) throw new Error('element has no bounding box')
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

test.describe('bottom tab bar in portrait', () => {
    test.use({ viewport: PORTRAIT })

    test('each tab navigates to its page and highlights itself', async ({ page }) => {
        test.slow()
        await open(page, '/news', [news, home, maps, worldRecords, events])
        await expect(tabBar(page)).toBeInViewport({ ratio: 1 })
        await expectHighlighted(page, null)

        const visits: [string, string | RegExp][] = [
            ['Maps', '**/maps'],
            ['World Records', '**/world-records'],
            ['Events', '**/events'],
            ['Home', /:\d+\/$/],
        ]
        for (const [name, url] of visits) {
            await tab(page, name).tap()
            await page.waitForURL(url)
            await expectHighlighted(page, name)
        }
    })

    test("a map's page highlights the Maps tab", async ({ page }) => {
        await open(page, `/maps/${MAP_NAME}`, [mapsDetail])
        await expectHighlighted(page, 'Maps')
    })

    test('Menu opens the drawer, and a drawer link closes it', async ({ page }) => {
        await open(page, '/maps', [maps, news])
        const menu = tabBar(page).getByRole('button', { name: 'Menu', exact: true })
        await expect(menu).toHaveAttribute('aria-expanded', 'false')
        await menu.tap()
        await expectDrawerOpen(page)
        await expect(menu).toHaveAttribute('aria-expanded', 'true')

        await drawer(page).getByRole('link', { name: 'News', exact: true }).tap()
        await page.waitForURL('**/news')
        await expectDrawerClosed(page)
        await shown(page, news)
        await expectHighlighted(page, null)
    })

    test('never covers the last row of content', async ({ page }) => {
        await open(page, '/maps', [maps])
        await page.getByRole('main').evaluate(main => main.scrollTo({ top: main.scrollHeight, behavior: 'instant' }))
        await settleLayout(page)
        const barTop = await tabBar(page).evaluate(bar => bar.getBoundingClientRect().top)
        const lastBottom = await page.getByRole('main').evaluate(main => Math.max(...[...main.querySelectorAll('*')]
            .filter(element => element.checkVisibility() && element.getClientRects().length > 0)
            .map(element => element.getBoundingClientRect().bottom)))
        expect(barTop, 'the tab bar sits at the bottom of the screen').toBeGreaterThan(PORTRAIT.height / 2)
        expect(lastBottom, 'the last row ends above the tab bar').toBeLessThanOrEqual(barTop + 0.5)
    })

    test('the first-visit tutorial card and consent banner sit above it', async ({ page }) => {
        await serveFixtureSets(page, [maps])
        const card = page.getByRole('dialog', { name: 'Maps page tutorial' })
        const banner = page.locator('body > div').filter({ hasText: 'Help improve UTBT' })
        await reopenOnDroppedModule(page, async () => {
            await page.goto('/maps')
            await page.getByRole('button', { name: 'Start tutorial' }).waitFor()
        })
        await page.getByRole('button', { name: 'Start tutorial' }).tap()
        await card.waitFor()
        await banner.waitFor()
        await settleLayout(page)
        const barTop = await tabBar(page).evaluate(bar => bar.getBoundingClientRect().top)
        for (const [name, overlay] of [['tutorial card', card], ['consent banner', banner]] as const) {
            const bottom = await overlay.evaluate(element => element.getBoundingClientRect().bottom)
            expect(bottom, `the ${name} ends above the tab bar`).toBeLessThanOrEqual(barTop)
        }
    })

    test('hides once the phone turns to landscape', async ({ page }) => {
        await open(page, '/maps', [maps])
        await expect(tabBar(page)).toBeVisible()
        await page.setViewportSize(LANDSCAPE)
        await settleLayout(page)
        await expect(tabBar(page)).toHaveCount(0)
    })
})

test.describe('bottom tab bar in landscape', () => {
    test.use({ viewport: LANDSCAPE })

    test('is not shown, and the content runs to the bottom of the screen', async ({ page }) => {
        await open(page, '/maps', [maps])
        await expect(tabBar(page)).toHaveCount(0)
        expect(await page.getByRole('main').evaluate(main => getComputedStyle(main).paddingBottom)).toBe('0px')
    })
})

test.describe('drawer gestures', () => {
    test.use({ viewport: PORTRAIT })

    test('a swipe to the left on the open drawer closes it, and pinch-zoom stays allowed on the drawer', async ({ page }) => {
        await open(page, '/maps', [maps])
        await page.getByRole('button', { name: 'Open navigation', exact: true }).tap()
        await expectDrawerOpen(page)
        expect(await drawer(page).evaluate(aside => [aside, aside.querySelector('nav')!].map(node => getComputedStyle(node).touchAction)))
            .toEqual(['pan-y pinch-zoom', 'pan-y pinch-zoom'])

        const start = await centreOf(drawer(page).getByRole('link', { name: 'Players', exact: true }))
        await touchDrag(page, start, { x: 10, y: start.y })
        await expectDrawerClosed(page)
    })

    test('the click a swipe ends on does not follow the link the swipe started on', async ({ page }) => {
        await open(page, '/maps', [maps, players])
        await page.getByRole('button', { name: 'Open navigation', exact: true }).tap()
        await expectDrawerOpen(page)

        const start = await centreOf(drawer(page).getByRole('link', { name: 'Players', exact: true }))
        await pointerDrag(page, start, { x: 10, y: start.y }, { clickAtEnd: true })
        await expectDrawerClosed(page)
        await settleLayout(page)
        expect(new URL(page.url()).pathname).toBe('/maps')
    })

    test('a short swipe held still before release springs back, and the links still work afterwards', async ({ page }) => {
        await open(page, '/maps', [maps, players])
        await page.getByRole('button', { name: 'Open navigation', exact: true }).tap()
        await expectDrawerOpen(page)

        const link = drawer(page).getByRole('link', { name: 'Players', exact: true })
        const start = await centreOf(link)
        await touchDrag(page, start, { x: start.x - 40, y: start.y }, { holdMs: 300 })
        await settleLayout(page)
        await expectDrawerOpen(page)

        await link.focus()
        await page.keyboard.press('Enter')
        await page.waitForURL('**/players')
        await expectDrawerClosed(page)
    })

    test('a vertical drag on the open drawer leaves it open', async ({ page }) => {
        await open(page, '/maps', [maps])
        await page.getByRole('button', { name: 'Open navigation', exact: true }).tap()
        await expectDrawerOpen(page)

        await touchDrag(page, { x: 150, y: 600 }, { x: 140, y: 300 })
        await settleLayout(page)
        await expectDrawerOpen(page)
    })

    test('a drag from the left screen edge does not open the drawer', async ({ page }) => {
        await open(page, '/maps', [maps])
        await touchDrag(page, { x: 2, y: PORTRAIT.height / 2 }, { x: 260, y: PORTRAIT.height / 2 })
        await settleLayout(page)
        await expectDrawerClosed(page)
    })
})
