import { expect, test, type Locator, type Page } from '@playwright/test'
import { runCompareErrors, runCompareFixture } from '../app/utils/fixtures/runCompareFixtures'
import type { CapDetail } from '../app/utils/api'
import { horizontalOverflow } from './layout'
import { MEDIA_HOST, replayVideoUrl, serveReplayVideos } from './replayVideos'

const AVATAR = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const BASE = runCompareFixture('capDetailCandidates')
const CONFLICT = runCompareErrors().find(entry => entry.body.code === 'no_ghost')!
const LONG = 'TheUnbelievablyLongPlayerAliasOfDoom'

interface Racer {
    capId: string
    alias: string
    seconds: number
}

const RACERS: Racer[] = [
    { capId: 'd4d4d4d4-0000-4000-8000-0000000000d4', alias: 'Decl', seconds: 13 },
    { capId: 'e5e5e5e5-0000-4000-8000-0000000000e5', alias: 'ShX', seconds: 14.25 },
    { capId: 'c3c3c3c3-0000-4000-8000-0000000000c3', alias: 'Cubic', seconds: 15.5 },
    ...Array.from({ length: 5 }, (_, i) => ({
        capId: `a${i}a${i}a${i}a${i}-0000-4000-8000-00000000000${i}`,
        alias: `Runner${i}${LONG}`,
        seconds: 16 + i,
    })),
]
const [DECL, SHX, CUBIC] = RACERS

function detailFor({ capId, alias, seconds }: Racer, i: number): CapDetail {
    return {
        ...BASE,
        cap: { ...BASE.cap, id: capId, user: `70000000000000001${i}`, alias, cap_time_seconds: seconds, team: 0, active_title: null, disallowed: false },
        checkpoints: BASE.checkpoints.map(checkpoint => ({
            ...checkpoint,
            cumulative: (checkpoint.cumulative * seconds) / BASE.cap.cap_time_seconds,
            segment: (checkpoint.segment * seconds) / BASE.cap.cap_time_seconds,
        })),
        compare_candidates: [],
    }
}

const DETAILS = new Map(RACERS.map((racer, i) => [racer.capId, detailFor(racer, i)]))

async function mockApi(page: Page) {
    await page.addInitScript(() => { localStorage.setItem('utbt:analyticsConsent:v1', 'denied') })
    await serveReplayVideos(page)
    await page.route(/https:\/\/cdn\.discordapp\.com\/.*/, route => route.fulfill({ contentType: 'image/png', body: AVATAR }))
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        const path = url.pathname.replace(/\/$/, '')
        if (url.hostname === 'gateway.utbt.net') {
            if (/^\/users\/[^/]+\/avatar$/.test(path)) return route.fulfill({ contentType: 'image/png', body: AVATAR })
            const replay = /^\/replays\/([^/]+)$/.exec(path)
            if (replay && DETAILS.has(replay[1])) {
                return route.fulfill({ json: { source: 'utrecorder', mp4_url: replayVideoUrl(replay[1]), view_url: null, fps: 60 } })
            }
            return route.fulfill({ json: [] })
        }
        if (path === '/ghosts/compare') return route.fulfill({ status: CONFLICT.status, json: CONFLICT.body })
        const detail = /^\/caps\/([^/]+)\/detail$/.exec(path)
        if (detail) {
            const found = DETAILS.get(detail[1])
            if (!found) return route.fulfill({ status: 404, json: { success: false, error: 'Cap not found' } })
            return route.fulfill({ json: { success: true, data: found } })
        }
        return route.fulfill({ json: { success: true, data: [] } })
    })
}

function streamedVideos(page: Page): string[] {
    const streamed: string[] = []
    page.on('request', request => {
        if (!request.url().startsWith(MEDIA_HOST)) return
        const name = new URL(request.url()).pathname.slice(1).replace(/\.webm$/, '')
        if (!streamed.includes(name)) streamed.push(name)
    })
    return streamed
}

function compareUrl(racers: readonly Racer[], t?: string): string {
    return `/compare?runs=${racers.map(racer => racer.capId).join(',')}${t ? `&t=${t}` : ''}`
}

function stage(page: Page): Locator {
    return page.getByRole('region', { name: 'Stage' })
}

function tiles(page: Page): Locator {
    return stage(page).getByRole('group')
}

function tile(page: Page, alias: string): Locator {
    return stage(page).getByRole('group', { name: alias })
}

function switcher(page: Page): Locator {
    return page.getByRole('group', { name: 'Point of View' })
}

function transport(page: Page): Locator {
    return page.getByRole('region', { name: 'Playback' })
}

function timeline(page: Page): Locator {
    return page.getByRole('slider', { name: 'Timeline' })
}

interface VideoClock {
    time: number
    paused: boolean
    src: string
}

function clockOf(scope: Locator): Promise<VideoClock> {
    return scope.locator('video').evaluate(video => {
        const { currentTime, paused, currentSrc } = video as HTMLVideoElement
        return { time: currentTime, paused, src: currentSrc }
    })
}

function streaming(page: Page): Promise<boolean[]> {
    return stage(page).locator('video').evaluateAll(videos => videos.map(video => {
        const media = video as HTMLVideoElement
        return media.hasAttribute('src') || media.readyState > HTMLMediaElement.HAVE_NOTHING || media.networkState === HTMLMediaElement.NETWORK_LOADING
    }))
}

function masterTime(page: Page): Promise<number> {
    return timeline(page).evaluate(input => Number((input as HTMLInputElement).value))
}

async function swipe(page: Page, target: Locator, dx: number, dy: number) {
    const box = (await target.boundingBox())!
    const x = box.x + box.width / 2
    const y = box.y + box.height / 2
    const start = Date.now() / 1000
    const cdp = await page.context().newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }], timestamp: start })
    for (let step = 1; step <= 10; step += 1) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + (dx * step) / 10, y: y + (dy * step) / 10 }], timestamp: start + step * 0.016 })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: start + 0.2 })
    await cdp.detach()
}

test.describe('the compare page on a phone', () => {
    test.beforeEach(({ isMobile }) => {
        test.skip(!isMobile, 'the phone layout follows the touch screen of the phone project')
    })

    test('at 390 px one tile streams with the POV switcher and the other runs as delta chips, without overflow', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        const streamed = streamedVideos(page)
        await mockApi(page)
        await page.goto(compareUrl([DECL, SHX, CUBIC], '14.500'))

        await expect(tiles(page)).toHaveCount(1)
        await expect(tile(page, 'Decl')).toBeVisible()
        await expect.poll(async () => (await clockOf(tile(page, 'Decl'))).time).toBe(13)
        const chips = switcher(page).getByRole('button')
        await expect(chips).toHaveCount(3)
        await expect(switcher(page).getByRole('button', { name: 'Decl' })).toHaveAttribute('aria-pressed', 'true')
        await expect(switcher(page).getByRole('button', { name: 'ShX' })).toHaveAttribute('aria-pressed', 'false')
        for (const chip of await chips.all()) {
            const box = (await chip.boundingBox())!
            expect(box.height).toBeGreaterThanOrEqual(44)
        }

        const others = tile(page, 'Decl').getByRole('list', { name: 'Other Runs' }).getByRole('listitem')
        await expect(others).toHaveCount(2)
        await expect(others.filter({ hasText: 'ShX' })).toContainText('+1.250')
        await expect(others.filter({ hasText: 'Cubic' })).toBeVisible()

        expect(streamed).toEqual([DECL.capId])
        expect(await streaming(page)).toEqual([true, false, false])
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
        await expect(page.getByRole('list', { name: 'Lanes' }).getByRole('listitem')).toHaveCount(3)
    })

    test('switching POV keeps the master time and lands the new video on its target', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        const streamed = streamedVideos(page)
        await mockApi(page)
        await page.goto(compareUrl([DECL, SHX, CUBIC], '12.500'))
        await expect.poll(async () => (await clockOf(tile(page, 'Decl'))).time).toBe(12.5)

        await switcher(page).getByRole('button', { name: 'ShX' }).click()

        await expect(tiles(page)).toHaveCount(1)
        await expect(tile(page, 'ShX')).toBeVisible()
        await expect(timeline(page)).toHaveAttribute('aria-valuetext', '0:12.500')
        await expect.poll(async () => (await clockOf(tile(page, 'ShX'))).time).toBe(12.5)
        expect((await clockOf(tile(page, 'ShX'))).paused).toBe(true)
        await expect(switcher(page).getByRole('button', { name: 'ShX' })).toHaveAttribute('aria-pressed', 'true')
        await expect.poll(() => streaming(page)).toEqual([false, true, false])

        await swipe(page, tile(page, 'ShX'), 0, -120)
        await expect(tile(page, 'ShX')).toBeVisible()

        await swipe(page, tile(page, 'ShX'), -160, 10)
        await expect(tile(page, 'Cubic')).toBeVisible()
        await expect(timeline(page)).toHaveAttribute('aria-valuetext', '0:12.500')
        await expect.poll(async () => (await clockOf(tile(page, 'Cubic'))).time).toBe(12.5)

        await swipe(page, tile(page, 'Cubic'), 160, 0)
        await expect(tile(page, 'ShX')).toBeVisible()
        expect(streamed).toEqual([DECL.capId, SHX.capId, CUBIC.capId])
    })

    test('a switch during playback lands the new video in sync with the master clock', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        await mockApi(page)
        await page.goto(compareUrl([DECL, SHX, CUBIC]))
        await expect(tile(page, 'Decl').locator('video')).toHaveCount(1)

        await transport(page).getByRole('button', { name: 'Play', exact: true }).click()
        await expect.poll(async () => (await clockOf(tile(page, 'Decl'))).time, { timeout: 15_000 }).toBeGreaterThan(1)
        await switcher(page).getByRole('button', { name: 'Cubic' }).click()

        await expect.poll(async () => (await clockOf(tile(page, 'Cubic'))).paused, { timeout: 15_000 }).toBe(false)
        await expect.poll(async () => (await clockOf(tile(page, 'Cubic'))).time, { timeout: 15_000 }).toBeGreaterThan(2)
        const [video, master] = [(await clockOf(tile(page, 'Cubic'))).time, await masterTime(page)]
        expect(Math.abs(video - master)).toBeLessThan(0.2)
    })

    test('the transport is compact with the rate behind a menu, and the lanes stay', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        await mockApi(page)
        await page.goto(compareUrl([DECL, SHX, CUBIC]))
        await expect(tiles(page)).toHaveCount(1)

        await expect(transport(page).getByRole('combobox', { name: 'Playback rate' })).toHaveCount(0)
        const rate = transport(page).getByRole('button', { name: 'Playback rate' })
        await expect(rate).toHaveText('1×')
        await rate.click()
        await page.getByRole('menuitemradio', { name: '0.5×' }).click()
        await expect(rate).toHaveText('0.5×')
        await expect(page.getByRole('list', { name: 'Lanes' }).getByRole('listitem')).toHaveCount(3)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    })

    test('the Runs drawer is a bottom sheet over the page, and a swipe down on its header closes it', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        await mockApi(page)
        await page.goto(compareUrl([DECL, SHX, CUBIC]))
        await expect(tiles(page)).toHaveCount(1)

        await transport(page).getByRole('button', { name: 'Runs', exact: true }).click()
        const sheet = page.locator('.run-compare-drawer-layer')
        await expect(page.getByRole('region', { name: 'Runs' })).toBeVisible()
        const box = (await sheet.boundingBox())!
        expect(box.x).toBe(0)
        expect(box.width).toBe(390)
        expect(box.y).toBeGreaterThan(844 / 3)
        expect(box.y + box.height).toBeLessThanOrEqual(844)
        const tileBox = (await tile(page, 'Decl').boundingBox())!
        expect(tileBox.y).toBeLessThan(box.y)

        await swipe(page, page.locator('.run-compare-drawer-header'), 0, 120)
        await expect(page.getByRole('region', { name: 'Runs' })).toHaveCount(0)
    })

    test('choosing audio for a run outside the view brings it into view, so the page never goes silent', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        await mockApi(page)
        await page.goto(compareUrl([DECL, SHX, CUBIC]))
        await expect(tile(page, 'Decl')).toBeVisible()

        await transport(page).getByRole('button', { name: 'Runs', exact: true }).click()
        const cubic = page.getByRole('region', { name: 'Runs' }).getByRole('listitem').filter({ hasText: 'Cubic' })
        await cubic.getByRole('button', { name: 'Audio' }).click()

        await expect(cubic.getByRole('button', { name: 'Audio' })).toHaveAttribute('aria-pressed', 'true')
        await expect(tile(page, 'Cubic')).toBeVisible()
        await expect(tiles(page)).toHaveCount(1)
        await expect(switcher(page).getByRole('button', { name: 'Cubic' })).toHaveAttribute('aria-pressed', 'true')
        await expect.poll(() => streaming(page)).toEqual([false, false, true])
    })

    test('eight runs with long names fit 360 px without overflow', async ({ page }) => {
        await page.setViewportSize({ width: 360, height: 780 })
        await mockApi(page)
        await page.goto(compareUrl(RACERS))

        await expect(tiles(page)).toHaveCount(1)
        await expect(switcher(page).getByRole('button')).toHaveCount(8)
        await expect(tile(page, 'Decl').getByRole('list', { name: 'Other Runs' }).getByRole('listitem')).toHaveCount(7)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
        const stageBox = (await stage(page).boundingBox())!
        expect(stageBox.x + stageBox.width).toBeLessThanOrEqual(360)
    })

    test('a phone in landscape puts two runs side by side', async ({ page }) => {
        await page.setViewportSize({ width: 844, height: 390 })
        await mockApi(page)
        await page.goto(compareUrl([DECL, SHX]))

        await expect(tiles(page)).toHaveCount(2)
        const [left, right] = [(await tile(page, 'Decl').boundingBox())!, (await tile(page, 'ShX').boundingBox())!]
        expect(right.x).toBeGreaterThanOrEqual(left.x + left.width)
        expect(right.y).toBeCloseTo(left.y, 0)
        await expect(switcher(page)).toHaveCount(0)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    })
})

test.describe('the compare page on a tablet', () => {
    test('in portrait two runs stack', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'the tablet layout follows the touch screen of the phone project')
        await page.setViewportSize({ width: 820, height: 1180 })
        await mockApi(page)
        await page.goto(compareUrl([DECL, SHX]))

        await expect(tiles(page)).toHaveCount(2)
        const [top, bottom] = [(await tile(page, 'Decl').boundingBox())!, (await tile(page, 'ShX').boundingBox())!]
        expect(bottom.x).toBeCloseTo(top.x, 0)
        expect(bottom.y).toBeGreaterThanOrEqual(top.y + top.height)
        await expect(switcher(page)).toHaveCount(0)
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    })
})

test.describe('the compare page on a wide screen', () => {
    test('at 1920 px every run has a tile in the packed grid', async ({ page }) => {
        await page.setViewportSize({ width: 1920, height: 1080 })
        await mockApi(page)
        await page.goto(compareUrl([DECL, SHX, CUBIC]))

        await expect(tiles(page)).toHaveCount(3)
        const boxes = await Promise.all([DECL, SHX, CUBIC].map(async racer => (await tile(page, racer.alias).boundingBox())!))
        for (const box of boxes) {
            expect(box.width).toBeCloseTo(boxes[0].width, 0)
            expect(box.width / box.height).toBeCloseTo(16 / 9, 1)
        }
        for (let i = 1; i < boxes.length; i += 1) {
            const [a, b] = [boxes[i - 1], boxes[i]]
            expect(b.x >= a.x + a.width - 1 || b.y >= a.y + a.height - 1).toBe(true)
        }
        await expect(switcher(page)).toHaveCount(0)
        await expect(transport(page).getByRole('combobox', { name: 'Playback rate' })).toBeVisible()
        expect(await horizontalOverflow(page)).toBeLessThanOrEqual(0)
    })
})
