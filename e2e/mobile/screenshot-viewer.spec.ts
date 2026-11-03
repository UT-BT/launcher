import { expect, test, type Locator, type Page } from '@playwright/test'
import { reopenOnDroppedModule } from './dev-server'
import { serveFixtureSet } from './fixtures/router'
import { checkModal, swipeScroll } from './interactions'
import { crawlSurfaces, surfaceShown } from './manifest'
import { mapsDetail } from './manifest/maps-detail'
import { CONSENT_KEY } from './manifest/overlays'
import { MODAL_ROOT } from './manifest/types'
import { installProbe } from './rules/probe'
import { settleLayout } from './settle'

const SIZES = [{ width: 390, height: 844 }, { width: 844, height: 390 }]
const VIEWER_CHUNK = /\/MapScreenshotViewer(\.tsx|-[\w-]+\.js)(\?|$)/

interface Point {
    x: number
    y: number
}

async function openMap(page: Page): Promise<string[]> {
    const fetched: string[] = []
    page.on('request', request => {
        if (VIEWER_CHUNK.test(request.url())) fetched.push(request.url())
    })
    await page.addInitScript(key => localStorage.setItem(key, 'denied'), CONSENT_KEY)
    await serveFixtureSet(page, mapsDetail.fixtures)
    const surface = crawlSurfaces('pr').find(candidate => candidate.id === mapsDetail.view)
    if (!surface) throw new Error(`no crawl surface for ${mapsDetail.view}`)
    await reopenOnDroppedModule(page, async () => {
        await page.goto(mapsDetail.path)
        await surfaceShown(surface)(page)
    })
    await settleLayout(page)
    await installProbe(page)
    return fetched
}

async function scrollPositions(page: Page): Promise<{ main: number; window: number }> {
    return page.evaluate(() => ({ main: document.querySelector('main')?.scrollTop ?? 0, window: window.scrollY }))
}

async function pageScale(page: Page): Promise<number> {
    return page.evaluate(() => window.visualViewport?.scale ?? 1)
}

async function centreOf(target: Locator): Promise<Point> {
    const box = await target.boundingBox()
    if (!box) throw new Error('the target is not rendered')
    return { x: box.x + box.width / 2, y: box.y + box.height / 2 }
}

async function imageWidth(frame: Locator): Promise<number> {
    return frame.locator('img').evaluate(image => image.getBoundingClientRect().width)
}

async function pinchOpen(page: Page, frame: Locator, browser: string) {
    const centre = await centreOf(frame)
    const steps = Array.from({ length: 11 }, (_, step) => 20 + step * 8)
    if (browser === 'chromium') {
        const session = await page.context().newCDPSession(page)
        const touches = (spread: number) => [
            { x: centre.x - spread, y: centre.y, id: 1 },
            { x: centre.x + spread, y: centre.y, id: 2 },
        ]
        await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: touches(steps[0]) })
        for (const spread of steps.slice(1)) {
            await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: touches(spread) })
        }
        await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
        await session.detach()
        return
    }
    await frame.evaluate((target, { centre, steps }) => {
        const fire = (type: string, pointerId: number, x: number) => target.dispatchEvent(new PointerEvent(type, {
            pointerId, pointerType: 'touch', isPrimary: pointerId === 1, clientX: x, clientY: centre.y, bubbles: true, cancelable: true,
        }))
        fire('pointerdown', 1, centre.x - steps[0])
        fire('pointerdown', 2, centre.x + steps[0])
        for (const spread of steps.slice(1)) {
            fire('pointermove', 1, centre.x - spread)
            fire('pointermove', 2, centre.x + spread)
        }
        fire('pointerup', 1, centre.x - steps.at(-1)!)
        fire('pointerup', 2, centre.x + steps.at(-1)!)
    }, { centre, steps })
}

for (const size of SIZES) {
    test.describe(`${size.width}x${size.height}`, () => {
        test.use({ viewport: size, contextOptions: { screen: size } })

        test('tapping the map hero opens the screenshot viewer above the page with its close in view', async ({ page }) => {
            const fetched = await openMap(page)
            const trigger = page.getByRole('button', { name: 'View screenshot' })
            await trigger.scrollIntoViewIfNeeded()
            await settleLayout(page)
            expect(fetched, 'the viewer code loads on the first tap, not with the page').toEqual([])
            const before = await scrollPositions(page)

            await page.touchscreen.tap(...Object.values(await centreOf(trigger)) as [number, number])
            const frame = page.getByRole('img', { name: /Pinch or double-tap to zoom/ })
            await frame.waitFor()
            await settleLayout(page)
            expect(fetched.length, 'the viewer is its own chunk').toBeGreaterThan(0)

            const check = await checkModal(page, MODAL_ROOT)
            expect(check.problems).toEqual([])
            expect(check.close?.reachable, 'the close is in view and takes a tap').toBe(true)

            const moves = await swipeScroll(page, 2000)
            expect(moves.filter(move => move.path === 'main' || move.path === 'window'), 'a swipe over the viewer scrolls neither the shell nor the window').toEqual([])
            expect(await scrollPositions(page)).toEqual(before)
            expect(await pageScale(page)).toBe(1)

            await page.touchscreen.tap(check.close!.x, check.close!.y)
            await expect(frame).toHaveCount(0)
            expect(await scrollPositions(page)).toEqual(before)
        })

        test('pinching and double-tapping zoom the screenshot while the page stays at scale 1', async ({ page, browserName }) => {
            await openMap(page)
            const trigger = page.getByRole('button', { name: 'View screenshot' })
            await trigger.scrollIntoViewIfNeeded()
            await page.touchscreen.tap(...Object.values(await centreOf(trigger)) as [number, number])
            const frame = page.getByRole('img', { name: /Pinch or double-tap to zoom/ })
            await frame.waitFor()
            await settleLayout(page)
            const unzoomed = await imageWidth(frame)

            await pinchOpen(page, frame, browserName)
            await expect.poll(() => imageWidth(frame), { message: 'a pinch zooms the screenshot' }).toBeGreaterThan(unzoomed * 1.5)
            expect(await pageScale(page), 'the pinch does not zoom the page').toBe(1)

            const centre = await centreOf(frame)
            await page.touchscreen.tap(centre.x, centre.y)
            await page.touchscreen.tap(centre.x, centre.y)
            await expect.poll(() => imageWidth(frame), { message: 'a double tap zooms back out' }).toBeCloseTo(unzoomed, 0)

            await page.touchscreen.tap(centre.x, centre.y)
            await page.touchscreen.tap(centre.x, centre.y)
            await expect.poll(() => imageWidth(frame), { message: 'a double tap zooms in' }).toBeGreaterThan(unzoomed * 2)
            expect(await pageScale(page), 'a double tap does not zoom the page').toBe(1)
        })
    })
}
