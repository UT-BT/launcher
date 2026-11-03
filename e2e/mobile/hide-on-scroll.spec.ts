import { expect, test, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { dataFrom, replyFor } from './fixtures/data'
import { fixtureSetNamed } from './fixtures/index'
import { serveFixtureSet } from './fixtures/router'
import { closeModal } from './interactions'
import { maps } from './manifest/maps'
import { MAP_NAME, mapsDetail } from './manifest/maps-detail'
import { MODAL_ROOT, type MobileRouteEntry } from './manifest/types'
import { installProbe } from './rules/probe'
import { settleLayout } from './settle'

const API_HOSTS = /https:\/\/(api|gateway)\.utbt\.net\/.*/
const PORTRAIT = { width: 390, height: 844 }
const LANDSCAPE = { width: 844, height: 390 }
const FINGER_STEPS = 12
const HELD_FRAMES = 6
const FRAME_S = 0.016

type Bars = 'shown' | 'hidden' | 'moving'

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

async function open(page: Page, entries: MobileRouteEntry[]) {
    const [first] = entries
    await page.addInitScript(() => {
        localStorage.setItem('utbt:analyticsConsent:v1', 'denied')
        localStorage.setItem('utbt:mapsPageTutorial:v1', JSON.stringify({ seen: true, version: 1 }))
    })
    await serveFixtureSets(page, entries)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(first.path)
        await first.ready(page, dataFrom(fixtureSetNamed(first.fixtures)!))
    })
    await settleLayout(page)
    await installProbe(page)
}

async function shown(page: Page, entry: MobileRouteEntry) {
    await entry.ready(page, dataFrom(fixtureSetNamed(entry.fixtures)!))
    await settleLayout(page)
}

function bars(page: Page): Promise<Bars> {
    return page.evaluate(() => {
        const area = window.__mobileProbe.visualViewport()
        const menu = document.querySelector('button[aria-label="Open navigation"]')
        const tabBar = document.querySelector('nav[aria-label="Tab bar"]')
        if (!menu) return 'moving'
        const menuRect = menu.getBoundingClientRect()
        const tabRect = tabBar?.getBoundingClientRect()
        const top = area.top
        const bottom = area.top + area.height
        const shownTop = menuRect.top >= top - 0.5
        const hiddenTop = menuRect.bottom <= top + 0.5
        const shownTabs = !tabRect || tabRect.bottom <= bottom + 0.5
        const hiddenTabs = !tabRect || tabRect.top >= bottom - 0.5
        if (shownTop && shownTabs) return 'shown'
        if (hiddenTop && hiddenTabs) return 'hidden'
        return 'moving'
    })
}

async function expectBars(page: Page, state: Exclude<Bars, 'moving'>, message: string) {
    await expect.poll(() => bars(page), { message }).toBe(state)
}

function mainTop(page: Page): Promise<number> {
    return page.getByRole('main').evaluate(main => main.scrollTop)
}

async function fingerScroll(page: Page, deltaY: number) {
    const size = page.viewportSize()!
    const from = { x: Math.round(size.width / 2), y: Math.round(size.height / 2) }
    if (page.context().browser()?.browserType().name() === 'chromium') {
        const session = await page.context().newCDPSession(page)
        const start = Date.now() / 1000
        const frame = (index: number) => start + index * FRAME_S
        const path = Array.from({ length: FINGER_STEPS }, (_, step) => ({ x: from.x, y: from.y - (deltaY * (step + 1)) / FINGER_STEPS, id: 1 }))
        const held = [...path, ...Array.from({ length: HELD_FRAMES }, () => path.at(-1)!)]
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }], timestamp: frame(0) })
        for (const [index, point] of held.entries()) {
            await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point], timestamp: frame(index + 1) })
        }
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: frame(held.length + 1) })
        await session.detach()
    } else {
        await page.evaluate(async ({ deltaY, steps }) => {
            const main = document.querySelector('main')!
            const target = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2) ?? main
            const frame = () => new Promise(resolve => requestAnimationFrame(resolve))
            const fire = (type: string) => target.dispatchEvent(new Event(type, { bubbles: true }))
            fire('touchstart')
            for (let step = 1; step <= steps; step += 1) {
                fire('touchmove')
                main.scrollBy({ top: deltaY / steps, behavior: 'instant' })
                main.dispatchEvent(new Event('scroll'))
                await frame()
            }
            fire('touchend')
        }, { deltaY, steps: FINGER_STEPS })
    }
    await settleLayout(page)
    await scrollSettled(page)
}

async function scrollSettled(page: Page) {
    await page.waitForFunction(() => {
        const main = document.querySelector('main')!
        const state = window as unknown as { __barsScroll?: { top: number; frames: number } }
        if (state.__barsScroll?.top === main.scrollTop) state.__barsScroll.frames += 1
        else state.__barsScroll = { top: main.scrollTop, frames: 0 }
        return state.__barsScroll.frames >= 5
    }, undefined, { polling: 'raf' })
}

test.describe('hide-on-scroll bars in portrait', () => {
    test.use({ viewport: PORTRAIT })

    test('scrolling down hides both bars, and scrolling up brings them back', async ({ page }) => {
        await open(page, [maps])
        await expectBars(page, 'shown', 'the bars show when the page opens')

        await fingerScroll(page, 300)
        expect(await mainTop(page), 'the finger scrolled the page').toBeGreaterThan(200)
        await expectBars(page, 'hidden', 'scrolling down hides the top bar and the tab bar')

        await fingerScroll(page, 200)
        await expectBars(page, 'hidden', 'scrolling further down keeps them hidden')

        await fingerScroll(page, -100)
        expect(await mainTop(page), 'the page is still well below its top').toBeGreaterThan(200)
        await expectBars(page, 'shown', 'scrolling up brings both bars back')
    })

    test('a small scroll leaves the bars in place', async ({ page }) => {
        await open(page, [maps])
        await fingerScroll(page, 300)
        await fingerScroll(page, -100)
        await expectBars(page, 'shown', 'scrolling up brings both bars back')

        await fingerScroll(page, 8)
        await expectBars(page, 'shown', 'a jitter down keeps them shown')
    })

    test('a tap followed by a scroll the page makes itself leaves the bars in place', async ({ page }) => {
        await open(page, [maps])
        await page.getByRole('heading', { name: 'Maps', exact: true }).tap()
        await page.getByRole('main').evaluate(main => main.scrollTo({ top: 400, behavior: 'instant' }))
        await scrollSettled(page)
        expect(await mainTop(page), 'the page scrolled').toBeGreaterThan(200)
        await expectBars(page, 'shown', 'a tap is not a scroll gesture, so the bars stay')
    })

    test('reaching the top of the page brings the bars back', async ({ page }) => {
        await open(page, [maps])
        await fingerScroll(page, 400)
        await expectBars(page, 'hidden', 'scrolling down hides the bars')

        await page.getByRole('main').evaluate(main => main.scrollTo({ top: 0, behavior: 'instant' }))
        await settleLayout(page)
        await expectBars(page, 'shown', 'at the top of the page the bars show')
        await expect(page.getByRole('button', { name: 'Open navigation', exact: true })).toBeInViewport({ ratio: 1 })
    })

    test('navigating brings the bars back, and Back restores the page with them shown', async ({ page }) => {
        await open(page, [maps, mapsDetail])
        await fingerScroll(page, 400)
        await expectBars(page, 'hidden', 'scrolling down hides the bars')
        const left = await mainTop(page)

        await page.getByRole('main').getByRole('link', { name: MAP_NAME.replace(/^CTF-BT-/, '') }).first().tap()
        await page.waitForURL(`**/maps/${MAP_NAME}`)
        await shown(page, mapsDetail)
        await expectBars(page, 'shown', 'the new page opens with both bars shown')

        await fingerScroll(page, 200)
        await expectBars(page, 'hidden', 'scrolling down the new page hides the bars')

        await page.goBack()
        await page.waitForURL('**/maps')
        await shown(page, maps)
        await expect.poll(() => mainTop(page), { message: 'Back restores the scroll position' }).toBeGreaterThan(left - 5)
        await expectBars(page, 'shown', 'the restored page keeps both bars shown')
    })

    test('closing a modal brings the bars back', async ({ page }) => {
        await open(page, [mapsDetail])
        await fingerScroll(page, 200)
        await expectBars(page, 'hidden', 'scrolling down hides the bars')

        const trigger = page.getByRole('button', { name: /Total Playtime/ })
        await trigger.scrollIntoViewIfNeeded()
        expect(await mainTop(page), 'the page is below its top').toBeGreaterThan(40)
        await expectBars(page, 'hidden', 'bringing the trigger into view keeps the bars hidden')
        await trigger.tap()
        await page.locator(MODAL_ROOT).waitFor()

        const { closed, notes } = await closeModal(page, MODAL_ROOT)
        expect(notes).toEqual([])
        expect(closed).toBe(true)
        await expectBars(page, 'shown', 'closing the modal brings both bars back')
    })
})

test.describe('hide-on-scroll bars in landscape', () => {
    test.use({ viewport: LANDSCAPE })

    test('the top bar hides on scroll down and comes back on scroll up', async ({ page }) => {
        await open(page, [maps])
        await fingerScroll(page, 200)
        await expectBars(page, 'hidden', 'scrolling down hides the top bar')
        await fingerScroll(page, -60)
        await expectBars(page, 'shown', 'scrolling up brings it back')
    })
})
