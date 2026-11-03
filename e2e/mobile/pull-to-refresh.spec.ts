import { expect, test, type Locator, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { dataFrom } from './fixtures/data'
import { fixtureSetNamed } from './fixtures/index'
import { serveFixtureSet } from './fixtures/router'
import { scrollToTop, scrollerTop, swipeOneViewport } from './interactions'
import { EVENT_TEAM_ID, eventTeam } from './manifest/event-team'
import { maps } from './manifest/maps'
import type { MobileRouteEntry } from './manifest/types'
import { installProbe } from './rules/probe'
import { settleLayout } from './settle'

const API_HOSTS = /https:\/\/(api|gateway)\.utbt\.net\/.*/
const PULL_PX = 160
const SHORT_PULL_PX = 40
const MOVE_STEPS = 12
const HELD_FRAMES = 10

interface Point {
    x: number
    y: number
}

interface HeldPull {
    release(): Promise<void>
}

async function open(page: Page, entry: MobileRouteEntry): Promise<URL[]> {
    const requests: URL[] = []
    page.on('request', request => {
        if (API_HOSTS.test(request.url())) requests.push(new URL(request.url()))
    })
    await page.addInitScript(storage => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        for (const [key, value] of Object.entries(storage)) localStorage.setItem(key, value)
    }, entry.storage ?? {})
    await serveFixtureSet(page, entry.fixtures)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(entry.path)
        await entry.ready(page, dataFrom(fixtureSetNamed(entry.fixtures)!))
    })
    await settleLayout(page)
    await installProbe(page)
    return requests
}

async function centreOf(target: Locator): Promise<Point> {
    const box = await target.boundingBox()
    if (!box) throw new Error('the target is not rendered')
    return { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2) }
}

async function holdPull(page: Page, browserName: string, from: Point, distance: number): Promise<HeldPull> {
    const path = Array.from({ length: MOVE_STEPS }, (_, step) => ({ x: from.x, y: Math.round(from.y + distance * (step + 1) / MOVE_STEPS) }))
    if (browserName === 'chromium') {
        const cdp = await page.context().newCDPSession(page)
        const start = Date.now() / 1000
        const frame = (index: number) => start + index * 0.016
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from], timestamp: frame(0) })
        const held = [...path, ...Array.from({ length: HELD_FRAMES }, () => path.at(-1)!)]
        for (const [index, point] of held.entries()) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point], timestamp: frame(index + 1) })
        }
        await settleLayout(page)
        return {
            release: async () => {
                await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: frame(held.length + 1) })
                await cdp.detach()
                await settleLayout(page)
            },
        }
    }
    await page.evaluate(({ from, path }) => {
        const target = document.elementFromPoint(from.x, from.y)!
        const fire = (type: string, point: { x: number; y: number }) => target.dispatchEvent(new PointerEvent(type, {
            pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: point.x, clientY: point.y, bubbles: true, cancelable: true,
        }))
        fire('pointerdown', from)
        for (const point of path) fire('pointermove', point)
        ;(window as unknown as { __pullEnd: () => void }).__pullEnd = () => fire('pointerup', path.at(-1)!)
    }, { from, path })
    await settleLayout(page)
    return {
        release: async () => {
            await page.evaluate(() => (window as unknown as { __pullEnd: () => void }).__pullEnd())
            await settleLayout(page)
        },
    }
}

async function pull(page: Page, browserName: string, from: Point, distance = PULL_PX) {
    await (await holdPull(page, browserName, from, distance)).release()
}

function pullIndicator(page: Page): Locator {
    return page.getByRole('progressbar', { name: 'Pull to refresh' })
}

function refreshSpinner(page: Page): Locator {
    return page.getByRole('status', { name: 'Refreshing' })
}

const MAPS_DATA = /^\/(maps|map_reviews)(\/|$)/

function apiPath(url: URL): string {
    return url.pathname.replace(/\/$/, '') || '/'
}

function mapsRefetches(requests: URL[], since: number): URL[] {
    return requests.slice(since).filter(url => url.hostname.startsWith('api.') && MAPS_DATA.test(apiPath(url)))
}

function browsePages(requests: URL[], since: number): URL[] {
    return mapsRefetches(requests, since).filter(url => apiPath(url) === '/maps' && url.searchParams.has('offset'))
}

async function holdResponses(page: Page, match: (url: URL) => boolean): Promise<() => void> {
    let release = () => {}
    const released = new Promise<void>(resolve => { release = resolve })
    await page.route(API_HOSTS, async route => {
        if (!match(new URL(route.request().url()))) return route.fallback()
        await released
        await route.fallback()
    })
    return release
}

async function expectNoRefresh(page: Page, browserName: string, from: Point, requests: URL[], what: string) {
    const before = requests.length
    const held = await holdPull(page, browserName, from, PULL_PX)
    await expect(pullIndicator(page), `${what}: no pull indicator follows the finger`).toHaveCount(0)
    await held.release()
    await expect(refreshSpinner(page), `${what}: no refresh spinner`).toHaveCount(0)
    expect(requests.slice(before).map(url => url.pathname), `${what}: nothing is refetched`).toEqual([])
}

async function expectRefresh(page: Page, browserName: string, from: Point, requests: URL[], what: string) {
    const before = requests.length
    await pull(page, browserName, from)
    await expect.poll(() => mapsRefetches(requests, before).length, { message: `${what}: the maps are refetched` }).toBeGreaterThan(0)
    await expect(refreshSpinner(page)).toHaveCount(0)
}

async function mapsHeading(page: Page): Promise<Point> {
    return centreOf(page.getByRole('heading', { name: 'Maps', exact: true }).first())
}

async function pageHeadingUnderOverlay(page: Page): Promise<Point> {
    await page.getByRole('main').evaluate(main => main.scrollTo({ top: 0, behavior: 'instant' }))
    await settleLayout(page)
    const heading = await mapsHeading(page)
    const reachable = await page.evaluate(({ x, y }) => document.querySelector('main')!.contains(document.elementFromPoint(x, y)), heading)
    expect(reachable, 'the page heading is at the top of the page and takes the touch').toBe(true)
    return heading
}

async function insertAtTop(page: Page, kind: 'scrubber' | 'sideways') {
    await page.evaluate(kind => {
        const content = document.querySelector('main')!.firstElementChild!
        const box = document.createElement('div')
        box.setAttribute('aria-label', kind)
        box.style.height = '64px'
        if (kind === 'scrubber') {
            box.style.touchAction = 'none'
        } else {
            box.style.overflowX = 'auto'
            const strip = document.createElement('div')
            strip.style.width = '2000px'
            strip.style.height = '64px'
            box.append(strip)
        }
        content.prepend(box)
    }, kind)
    await settleLayout(page)
    return centreOf(page.getByLabel(kind, { exact: true }))
}

test('pulling down at the top of Maps shows a spinner, refetches the maps and keeps the filter that was set', async ({ page, browserName }) => {
    const requests = await open(page, maps)
    await page.getByRole('button', { name: 'Filters', exact: true }).tap()
    const newMaps = page.getByRole('checkbox', { name: /^New maps/ })
    await newMaps.tap()
    const chip = page.getByRole('button', { name: 'Remove New maps filter On', exact: true })
    await expect(newMaps).toBeChecked()
    await expect(chip).toBeVisible()
    await expect.poll(() => browsePages(requests, 0).some(url => url.searchParams.has('added_since'))).toBe(true)
    await scrollToTop(page)
    expect(await scrollerTop(page, 'main')).toBe(0)

    const shortPull = await holdPull(page, browserName, await mapsHeading(page), SHORT_PULL_PX)
    await expect(pullIndicator(page), 'a short pull shows the indicator').toBeVisible()
    await shortPull.release()
    await expect(pullIndicator(page)).toHaveCount(0)
    await expect(refreshSpinner(page), 'a pull short of the threshold refreshes nothing').toHaveCount(0)

    const before = requests.length
    const release = await holdResponses(page, url => MAPS_DATA.test(apiPath(url)))
    const held = await holdPull(page, browserName, await mapsHeading(page), PULL_PX)
    await expect(pullIndicator(page)).toHaveAttribute('aria-valuenow', '100')
    await held.release()

    const spinner = refreshSpinner(page)
    await expect(spinner).toBeVisible()
    const spinnerBox = (await spinner.boundingBox())!
    const menuBox = (await page.getByRole('button', { name: 'Open navigation', exact: true }).boundingBox())!
    expect(spinnerBox.y, 'the spinner shows below the top bar').toBeGreaterThanOrEqual(menuBox.y + menuBox.height)
    expect(spinnerBox.y + spinnerBox.height).toBeLessThanOrEqual(page.viewportSize()!.height)
    await expect.poll(() => mapsRefetches(requests, before).length, { message: 'the maps are refetched' }).toBeGreaterThan(0)
    release()

    await expect(spinner).toHaveCount(0)
    const unfiltered = browsePages(requests, before).filter(url => !url.searchParams.has('added_since'))
    expect(unfiltered.map(String), 'no page of maps is fetched without the New maps filter').toEqual([])
    await expect(newMaps).toBeChecked()
    await expect(chip).toBeVisible()
    expect(await scrollerTop(page, 'main')).toBe(0)
})

test('pulling down on a page that registers no refresh re-mounts it in place', async ({ page, browserName }) => {
    const requests = await open(page, eventTeam)
    const heading = page.getByRole('heading', { name: 'Matches', exact: true }).first()
    await heading.evaluate(element => element.setAttribute('data-before-pull', ''))
    const teamFetches = () => requests.filter(url => url.pathname.includes(EVENT_TEAM_ID)).length
    const before = teamFetches()
    expect(before).toBeGreaterThan(0)

    await pull(page, browserName, await centreOf(heading))
    await expect.poll(teamFetches, { message: 'the re-mounted page fetches its team again' }).toBeGreaterThan(before)
    await expect(heading).toBeVisible()
    await expect(page.locator('[data-before-pull]'), 'the page was mounted afresh').toHaveCount(0)
    await expect(refreshSpinner(page)).toHaveCount(0)
    expect(new URL(page.url()).pathname).toBe(eventTeam.path)
})

test('no refresh while the page is scrolled down; back at the top the same pull refreshes', async ({ page, browserName }) => {
    const requests = await open(page, maps)
    const [moved] = await swipeOneViewport(page)
    expect(moved?.path, 'the page scrolled').toBe('main')
    const centre = { x: Math.round(page.viewportSize()!.width / 2), y: Math.round(page.viewportSize()!.height / 3) }

    await expectNoRefresh(page, browserName, centre, requests, 'scrolled down')

    await scrollToTop(page)
    await expectRefresh(page, browserName, await mapsHeading(page), requests, 'at the top')
})

test('no refresh while an overlay holds the page: the Maps tutorial, or a dropdown menu', async ({ page, browserName }) => {
    const requests = await open(page, maps)
    await page.getByRole('button', { name: 'Restart Maps tutorial' }).tap()
    const tutorial = page.locator('[role="dialog"][aria-label="Maps page tutorial"]')
    await tutorial.getByRole('button', { name: 'Close tutorial' }).waitFor()

    await expectNoRefresh(page, browserName, await pageHeadingUnderOverlay(page), requests, 'with the tutorial open')

    await tutorial.getByRole('button', { name: 'Close tutorial' }).tap()
    await expect(tutorial).toHaveCount(0)
    await page.getByRole('button', { name: 'Filters', exact: true }).tap()
    await page.getByRole('button', { name: /^Saved Filters/ }).tap()
    const menu = page.getByRole('menu')
    await menu.waitFor()

    await expectNoRefresh(page, browserName, await pageHeadingUnderOverlay(page), requests, 'with a dropdown menu open')

    await page.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await scrollToTop(page)
    await expectRefresh(page, browserName, await mapsHeading(page), requests, 'with every overlay closed')
})

test('no refresh when the drag starts on a scrubber or inside a box that scrolls sideways', async ({ page, browserName }) => {
    const requests = await open(page, maps)
    await insertAtTop(page, 'sideways')
    const scrubber = await insertAtTop(page, 'scrubber')
    const sideways = await centreOf(page.getByLabel('sideways', { exact: true }))
    expect(await scrollerTop(page, 'main')).toBe(0)

    await expectNoRefresh(page, browserName, scrubber, requests, 'on a scrubber')
    await expectNoRefresh(page, browserName, sideways, requests, 'inside a sideways scroller')

    await expectRefresh(page, browserName, await mapsHeading(page), requests, 'on the page')
})
