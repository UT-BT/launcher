import { expect, test, type Locator, type Page } from '@playwright/test'
import { RUN_COMPARE_FIXTURES, runCompareErrors, runCompareFixture } from '../app/utils/fixtures/runCompareFixtures'
import { displayMapName } from '../app/utils/format'
import type { CapDetail, LeaderboardEntry } from '../app/utils/api'
import { replayVideoUrl, serveReplayVideos } from './replayVideos'

const AVATAR = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const BASE = runCompareFixture('capDetailCandidates')
const MAP = BASE.cap.map
const FIERD = 'a1a1a1a1-0000-4000-8000-0000000000a1'
const BUN = 'b2b2b2b2-0000-4000-8000-0000000000b2'
const DECL = 'd4d4d4d4-0000-4000-8000-0000000000d4'
const SHX = 'e5e5e5e5-0000-4000-8000-0000000000e5'
const SHORT = runCompareFixture('short')
const PATRIK = SHORT.runner.cap_id
const ARTUREK = SHORT.reference.cap_id
const BLUE = 'f6f6f6f6-0000-4000-8000-0000000000f6'

function detailFor(id: string, user: string, alias: string, seconds: number, team: number): CapDetail {
    return {
        ...BASE,
        cap: { ...BASE.cap, id, user, alias, cap_time_seconds: seconds, team, active_title: null, disallowed: false },
        checkpoints: BASE.checkpoints.map(checkpoint => ({
            ...checkpoint,
            cumulative: (checkpoint.cumulative * seconds) / BASE.cap.cap_time_seconds,
            segment: (checkpoint.segment * seconds) / BASE.cap.cap_time_seconds,
        })),
        compare_candidates: [],
    }
}

const DETAILS = new Map<string, CapDetail>([
    [FIERD, detailFor(FIERD, '700000000000000001', 'fierd_6', 81.234, 0)],
    [BUN, detailFor(BUN, '700000000000000002', 'Bun`', 79.5, 1)],
    [DECL, detailFor(DECL, '700000000000000004', 'Decl', 13, 0)],
    [SHX, detailFor(SHX, '700000000000000005', 'ShX', 14.25, 0)],
    [PATRIK, detailFor(PATRIK, '700000000000000006', 'PatriK', SHORT.runner.cap_time_ms / 1000, 0)],
    [ARTUREK, detailFor(ARTUREK, '700000000000000007', 'Arturek', SHORT.reference.cap_time_ms / 1000, 0)],
    [BLUE, detailFor(BLUE, '700000000000000008', 'Bluey', 12.9, 1)],
])

const CONFLICT = runCompareErrors().find(entry => entry.body.code === 'no_ghost')!

interface MockOptions {
    gate?: Promise<void>
    videos?: readonly string[]
    missingVideos?: readonly string[]
    comparisons?: Readonly<Record<string, 'short' | 'conflict'>>
    compared?: string[]
    converted?: readonly string[]
}

async function mockApi(page: Page, { gate = Promise.resolve(), videos = [], missingVideos = [], comparisons = {}, compared = [], converted = [] }: MockOptions = {}) {
    await page.addInitScript(() => { localStorage.setItem('utbt:analyticsConsent:v1', 'denied') })
    await serveReplayVideos(page, missingVideos)
    await page.route(/https:\/\/cdn\.discordapp\.com\/.*/, route => route.fulfill({ contentType: 'image/png', body: AVATAR }))
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const url = new URL(route.request().url())
        const path = url.pathname.replace(/\/$/, '')
        if (url.hostname === 'gateway.utbt.net') {
            if (/^\/users\/[^/]+\/avatar$/.test(path)) return route.fulfill({ contentType: 'image/png', body: AVATAR })
            const replay = /^\/replays\/([^/]+)$/.exec(path)
            if (replay && videos.includes(replay[1])) {
                const source = converted.includes(replay[1]) ? 'democonverter' : 'utrecorder'
                return route.fulfill({ json: { source, mp4_url: replayVideoUrl(replay[1]), view_url: null, fps: 60 } })
            }
            return route.fulfill({ json: [] })
        }
        if (path === '/ghosts/compare') {
            const runner = url.searchParams.get('runner') ?? ''
            compared.push(`${runner}:${url.searchParams.get('reference')}`)
            const answer = comparisons[runner]
            if (answer === 'short') return route.fulfill({ json: RUN_COMPARE_FIXTURES.short.body })
            return route.fulfill({ status: CONFLICT.status, json: CONFLICT.body })
        }
        const detail = /^\/caps\/([^/]+)\/detail$/.exec(path)
        if (detail) {
            await gate
            const found = DETAILS.get(detail[1])
            if (!found) return route.fulfill({ status: 404, json: { success: false, error: 'Cap not found' } })
            return route.fulfill({ json: { success: true, data: found } })
        }
        return route.fulfill({ json: { success: true, data: [] } })
    })
}

function lanes(page: Page) {
    return page.getByRole('list', { name: 'Lanes' })
}

function lane(page: Page, alias: string): Locator {
    return lanes(page).getByRole('listitem').filter({ hasText: alias })
}

function tile(page: Page, alias: string): Locator {
    return page.getByRole('region', { name: 'Stage' }).getByRole('group', { name: alias })
}

interface VideoClock {
    time: number
    paused: boolean
}

function clockOf(scope: Locator): Promise<VideoClock> {
    return scope.locator('video').evaluate(video => {
        const { currentTime, paused } = video as HTMLVideoElement
        return { time: currentTime, paused }
    })
}

function clocksOf(page: Page): Promise<VideoClock[]> {
    return page.getByRole('region', { name: 'Stage' }).locator('video').evaluateAll(videos => videos.map(video => {
        const { currentTime, paused } = video as HTMLVideoElement
        return { time: currentTime, paused }
    }))
}

function playButton(page: Page): Locator {
    return page.getByRole('region', { name: 'Playback' }).getByRole('button', { name: 'Play', exact: true })
}

test.describe('the compare runs page', () => {
    test('lists both runs of a shared link and titles the tab after them', async ({ page }) => {
        await mockApi(page)
        await page.goto(`/compare?runs=${FIERD},${BUN}`)

        const rows = lanes(page).getByRole('listitem')
        await expect(rows).toHaveCount(2)
        await expect(rows.nth(0)).toContainText('fierd_6')
        await expect(rows.nth(0)).toContainText('1:21.234')
        await expect(rows.nth(1)).toContainText('Bun`')
        await expect(rows.nth(1)).toContainText('1:19.500')
        await expect(page.getByRole('heading', { name: 'Compare Runs' })).toBeVisible()
        await expect(page).toHaveTitle(`fierd_6 vs Bun\` on ${displayMapName(MAP)} — UTBT.net`)
        await expect(page.getByRole('status')).toHaveCount(0)
        expect(new URL(page.url()).search).toBe(`?runs=${FIERD},${BUN}`)
    })

    test('drops a malformed id and a repeated run with one notice, and normalises the address in place', async ({ page }) => {
        let release = () => {}
        await mockApi(page, { gate: new Promise<void>(resolve => { release = resolve }) })
        await page.goto('/news')
        await page.evaluate(path => { window.location.assign(path) }, `/compare?runs=${FIERD},not-a-cap,${BUN},${FIERD}&t=4.5`)
        await expect(page.getByRole('heading', { name: 'Compare Runs' })).toBeVisible()
        const lengthBefore = await page.evaluate(() => window.history.length)

        release()

        await expect(lanes(page).getByRole('listitem')).toHaveCount(2)
        await expect(page.getByRole('status')).toHaveText('Dropped 1 malformed run id and 1 repeated run.')
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${FIERD},${BUN}`)
        expect(await page.evaluate(() => window.history.length)).toBe(lengthBefore)
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/compare\\?runs=${[FIERD, BUN].sort().join(',')}$`))

        await page.goBack()
        await expect.poll(() => new URL(page.url()).pathname).toBe('/news')
    })

    test('shows the empty state with its notice when no run is valid', async ({ page }) => {
        await mockApi(page)
        await page.goto('/compare?runs=not-a-cap,c3c3c3c3-0000-4000-8000-0000000000c3')

        await expect(page.getByText('No runs to compare')).toBeVisible()
        await expect(page.getByRole('status')).toHaveText('Dropped 1 malformed run id and 1 run that could not be loaded.')
        await expect.poll(() => new URL(page.url()).search).toBe('')
        await expect(page).toHaveTitle('Compare Runs — UTBT.net')
    })
})

test.describe('race playback', () => {
    test('two solo runs sit side by side on a wide screen and advance together after Play', async ({ page, isMobile }) => {
        test.skip(isMobile, 'phone and tablet layouts are their own')
        await page.setViewportSize({ width: 1920, height: 1080 })
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)

        const [decl, shx] = [tile(page, 'Decl'), tile(page, 'ShX')]
        await expect(decl.locator('video')).toHaveCount(1)
        await expect(shx.locator('video')).toHaveCount(1)
        const [left, right] = [await decl.boundingBox(), await shx.boundingBox()]
        expect(right!.x).toBeGreaterThanOrEqual(left!.x + left!.width)
        expect(right!.y).toBeCloseTo(left!.y, 0)
        expect(right!.width).toBeCloseTo(left!.width, 0)

        await playButton(page).click()

        await expect.poll(async () => Math.min(...(await clocksOf(page)).map(clock => clock.time)), { timeout: 15_000 }).toBeGreaterThan(1)
        const clocks = await clocksOf(page)
        expect(clocks.map(clock => clock.paused)).toEqual([false, false])
        expect(Math.abs(clocks[0].time - clocks[1].time)).toBeLessThan(0.1)
    })

    test('a link with a start time opens paused there on every video', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}&t=12.500`)

        await expect.poll(async () => (await clocksOf(page)).map(clock => clock.time)).toEqual([12.5, 12.5])
        expect((await clocksOf(page)).map(clock => clock.paused)).toEqual([true, true])
        await expect(playButton(page)).toBeVisible()
        await expect(page.getByRole('slider', { name: 'Timeline' })).toHaveAttribute('aria-valuetext', '0:12.500')
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX}`)
    })

    test('a video that fails to load drops its run to a data-only lane and the other still plays', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX], missingVideos: [DECL] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)

        await expect(lanes(page).getByRole('listitem').filter({ hasText: 'Decl' })).toContainText('Video unavailable')
        await expect(tile(page, 'Decl')).toHaveCount(0)

        await playButton(page).click()

        await expect.poll(async () => (await clockOf(tile(page, 'ShX'))).time, { timeout: 15_000 }).toBeGreaterThan(0.5)
        expect((await clockOf(tile(page, 'ShX'))).paused).toBe(false)
    })

    test('a run past its cap freezes on its cap frame with its result while the other plays on', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}&t=12.500`)
        const [decl, shx] = [tile(page, 'Decl'), tile(page, 'ShX')]
        await expect.poll(async () => (await clocksOf(page)).map(clock => clock.time)).toEqual([12.5, 12.5])
        await expect(decl.getByText(/^CAP /)).toHaveCount(0)

        await playButton(page).click()

        await expect(decl.getByText('CAP 0:13.000 · ±0.000 · 1st')).toBeVisible({ timeout: 15_000 })
        const frozen = await clockOf(decl)
        expect(frozen.paused).toBe(true)
        expect(frozen.time).toBeCloseTo(13, 2)
        await expect.poll(async () => (await clockOf(shx)).time).toBeGreaterThan(13.2)

        await expect(shx.getByText('CAP 0:14.250 · +1.250 · 2nd')).toBeVisible({ timeout: 15_000 })
        expect((await clockOf(shx)).time).toBeCloseTo(14.25, 2)
        await expect(playButton(page)).toBeVisible()
    })
})

test.describe('delta lanes and data rungs', () => {
    test('an aligned pair shows two lanes, the Replay badge and the reference sector ticks', async ({ page }) => {
        const compared: string[] = []
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' }, compared })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)

        await expect(lanes(page).getByRole('listitem')).toHaveCount(2)
        await expect(lane(page, 'PatriK')).toContainText('Replay')
        await expect(tile(page, 'PatriK')).toContainText('Replay')
        await expect(lane(page, 'Arturek')).toContainText('REF')
        await expect(lane(page, 'PatriK').locator('.run-compare-lane-plot path').first()).toBeAttached()
        await expect(page.getByRole('list', { name: 'Sectors' }).getByRole('listitem')).toHaveCount(10)
        expect(compared).toEqual([`${PATRIK}:${ARTUREK}`])
    })

    test('a comparison the server refuses falls back to the zone delta', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'conflict' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)

        await expect(lane(page, 'PatriK')).toContainText('Zones')
        await expect(lane(page, 'PatriK')).not.toContainText('Replay')
        await expect(tile(page, 'PatriK')).toContainText('Zones')
        await expect(lane(page, 'PatriK').locator('.run-compare-lane-plot path').first()).toBeAttached()
    })

    test('a run set on the other side compares on time only and says which side it was set on', async ({ page }) => {
        const compared: string[] = []
        await mockApi(page, { videos: [ARTUREK, BLUE], compared })
        await page.goto(`/compare?runs=${ARTUREK},${BLUE}`)

        await expect(lane(page, 'Bluey')).toContainText('Time only')
        await expect(lane(page, 'Bluey')).toContainText('Set on Blue')
        await expect(tile(page, 'Bluey')).toContainText('Set on Blue')
        await expect(lane(page, 'Bluey').locator('.run-compare-lane-plot path')).toHaveCount(0)
        await expect(lane(page, 'Bluey').locator('.run-compare-lane-cap')).toBeVisible()
        expect(compared).toEqual([])
    })

    test('a click on a lane seeks every video to that time', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)

        const plot = lane(page, 'Decl').locator('.run-compare-lane-plot')
        const box = (await plot.boundingBox())!
        await plot.click({ position: { x: box.width / 2, y: box.height / 2 } })

        await expect.poll(async () => (await clocksOf(page)).map(clock => Math.round(clock.time * 10) / 10)).toEqual([7.1, 7.1])
        expect((await clocksOf(page)).map(clock => clock.paused)).toEqual([true, true])
        await expect(page.getByRole('slider', { name: 'Timeline' })).toHaveAttribute('aria-valuetext', /^0:07\.1/)
    })

    test('on touch a vertical swipe across a lane leaves the playhead and a tap seeks', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'touch gestures run on the phone project')
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)

        const timeline = page.getByRole('slider', { name: 'Timeline' })
        const plot = lane(page, 'Decl').locator('.run-compare-lane-plot')
        await plot.scrollIntoViewIfNeeded()
        const from = (await plot.boundingBox())!
        const x = from.x + from.width / 4
        const y = from.y + from.height / 2
        const start = Date.now() / 1000
        const cdp = await page.context().newCDPSession(page)
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }], timestamp: start })
        for (let step = 1; step <= 10; step += 1) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - step * 12 }], timestamp: start + step * 0.016 })
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: start + 0.2 })
        await cdp.detach()
        await expect(timeline).toHaveAttribute('aria-valuetext', '0:00.000')

        const to = (await plot.boundingBox())!
        await page.touchscreen.tap(to.x + to.width / 2, to.y + to.height / 2)
        await expect.poll(async () => (await clocksOf(page)).map(clock => Math.round(clock.time * 10) / 10)).toEqual([7.1, 7.1])
        await expect(timeline).toHaveAttribute('aria-valuetext', /^0:07\.1/)
    })
})

function drawer(page: Page): Locator {
    return page.getByRole('region', { name: 'Runs' })
}

function rosterRow(page: Page, alias: string): Locator {
    return drawer(page).getByRole('list', { name: 'Roster' }).getByRole('listitem').filter({ hasText: alias })
}

function runsButton(page: Page): Locator {
    return page.getByRole('region', { name: 'Playback' }).getByRole('button', { name: 'Runs', exact: true })
}

function historyLength(page: Page): Promise<number> {
    return page.evaluate(() => window.history.length)
}

async function stageBox(page: Page) {
    return page.getByRole('region', { name: 'Stage' }).boundingBox()
}

test.describe('the runs drawer', () => {
    test('opens over the stage without resizing it, and removing a run replaces the address in place', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX, PATRIK] })
        await page.goto(`/compare?runs=${DECL},${SHX},${PATRIK}`)
        await expect(tile(page, 'PatriK').locator('video')).toHaveCount(1)
        await expect(drawer(page)).toHaveCount(0)
        const closed = await stageBox(page)

        await runsButton(page).click()

        await expect(drawer(page)).toBeVisible()
        await expect(runsButton(page)).toHaveAttribute('aria-expanded', 'true')
        expect(await stageBox(page)).toEqual(closed)
        const lengthBefore = await historyLength(page)

        await rosterRow(page, 'PatriK').getByRole('button', { name: 'Remove' }).click()

        await expect(tile(page, 'PatriK')).toHaveCount(0)
        await expect(lane(page, 'PatriK')).toHaveCount(0)
        await expect(lanes(page).getByRole('listitem')).toHaveCount(2)
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX}`)
        expect(await historyLength(page)).toBe(lengthBefore)
        await expect(drawer(page)).toBeVisible()
        await expect(drawer(page).getByRole('list', { name: 'Roster' }).getByRole('listitem')).toHaveCount(2)
    })

    test('pinning a reference measures the other runs against it', async ({ page }) => {
        const compared: string[] = []
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' }, compared })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)
        await expect(lane(page, 'PatriK')).toContainText('Replay')
        await expect(lane(page, 'Arturek')).toContainText('REF')

        await runsButton(page).click()
        await rosterRow(page, 'PatriK').getByRole('button', { name: 'Pin' }).click()

        await expect(lane(page, 'PatriK')).toContainText('REF')
        await expect(lane(page, 'Arturek')).not.toContainText('REF')
        await expect(lane(page, 'Arturek')).toContainText('Zones')
        await expect(rosterRow(page, 'PatriK').getByRole('button', { name: 'Pin' })).toHaveAttribute('aria-pressed', 'true')
        await expect(drawer(page).getByRole('listitem').first()).toContainText('PatriK')
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${PATRIK},${ARTUREK}&ref=${PATRIK}`)
        expect(compared).toEqual([`${PATRIK}:${ARTUREK}`, `${ARTUREK}:${PATRIK}`])
    })

    test('turning a video off keeps its lane and drops its tile', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect(tile(page, 'ShX').locator('video')).toHaveCount(1)
        await runsButton(page).click()

        await rosterRow(page, 'ShX').getByRole('button', { name: 'Video' }).click()

        await expect(tile(page, 'ShX')).toHaveCount(0)
        await expect(lane(page, 'ShX')).toBeVisible()
        await expect(rosterRow(page, 'ShX').getByRole('button', { name: 'Video' })).toHaveAttribute('aria-pressed', 'false')
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX}&data=${SHX}`)
    })

    test('a video not from UTRecorder is flagged and its offset is nudged from the row menu', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX], converted: [SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect(tile(page, 'ShX').locator('video')).toHaveCount(1)
        await runsButton(page).click()
        await expect(rosterRow(page, 'ShX')).toContainText('Not frame-synced')
        await expect(rosterRow(page, 'Decl')).not.toContainText('Not frame-synced')
        await expect(rosterRow(page, 'Decl').getByRole('button', { name: /^Offset/ })).toHaveCount(0)
        const lengthBefore = await historyLength(page)

        await rosterRow(page, 'ShX').getByRole('button', { name: 'Offset 0 ms' }).click()
        await page.getByRole('menuitem', { name: '+1 frame' }).click()
        await page.getByRole('menuitem', { name: '+100 ms' }).click()

        await expect(page.getByRole('menu').getByText('Offset +117 ms')).toBeVisible()
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX}&off=${SHX}:117`)
        expect(await historyLength(page)).toBe(lengthBefore)

        await page.keyboard.press('Escape')
        await expect(page.getByRole('menu')).toHaveCount(0)
        await expect(drawer(page)).toBeVisible()
        await expect(rosterRow(page, 'ShX').getByRole('button', { name: 'Offset +117 ms' })).toBeVisible()
        await expect(tile(page, 'ShX')).not.toContainText('Offset')
    })

    test('a link with one run opens with the drawer open', async ({ page }) => {
        await mockApi(page, { videos: [DECL] })
        await page.goto(`/compare?runs=${DECL}`)

        await expect(drawer(page)).toBeVisible()
        await expect(rosterRow(page, 'Decl')).toContainText('REF')
        await expect(rosterRow(page, 'Decl').getByRole('button', { name: 'Remove' })).toBeDisabled()
    })

    test('Back closes the open drawer and keeps the page and its edits; the next Back leaves the page', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX, PATRIK] })
        await page.goto('/news')
        await page.evaluate(path => { window.location.assign(path) }, `/compare?runs=${DECL},${SHX},${PATRIK}`)
        await expect(lanes(page).getByRole('listitem')).toHaveCount(3)
        await runsButton(page).click()
        await rosterRow(page, 'PatriK').getByRole('button', { name: 'Remove' }).click()
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX}`)

        await page.goBack()

        await expect(drawer(page)).toHaveCount(0)
        await expect(page.getByRole('heading', { name: 'Compare Runs' })).toBeVisible()
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX}`)
        await expect(lanes(page).getByRole('listitem')).toHaveCount(2)

        await page.goBack()
        await expect.poll(() => new URL(page.url()).pathname).toBe('/news')
    })

    test('Escape closes the drawer and its own close button does too', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect(lanes(page).getByRole('listitem')).toHaveCount(2)
        const lengthBefore = await historyLength(page)

        await runsButton(page).click()
        await expect(drawer(page)).toBeVisible()
        await expect.poll(() => historyLength(page)).toBe(lengthBefore + 1)
        await page.keyboard.press('Escape')
        await expect(drawer(page)).toHaveCount(0)

        await runsButton(page).click()
        await drawer(page).getByRole('button', { name: 'Close Runs' }).click()
        await expect(drawer(page)).toHaveCount(0)
        await expect(runsButton(page)).toHaveAttribute('aria-expanded', 'false')
    })
})

function transport(page: Page): Locator {
    return page.getByRole('region', { name: 'Playback' })
}

function syncToggle(page: Page): Locator {
    return transport(page).getByRole('button', { name: 'Sync by position' })
}

async function rounded(page: Page): Promise<number[]> {
    return (await clocksOf(page)).map(clock => Math.round(clock.time * 1000) / 1000)
}

test.describe('sector cue and sync by position', () => {
    test('clicking sector 4\'s tick puts each video at its own entry into it, and a lane click clears the cue', async ({ page, isMobile }) => {
        test.skip(isMobile, 'on touch the ticks are marks and the Cue menu cues')
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)
        await expect(lane(page, 'PatriK')).toContainText('Replay')
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)

        await page.getByRole('list', { name: 'Sectors' }).getByRole('button', { name: 'Cue S4' }).click()

        await expect.poll(() => rounded(page)).toEqual([3.74, 3.549])
        expect((await clocksOf(page)).map(clock => clock.paused)).toEqual([true, true])
        await expect(transport(page).getByRole('slider', { name: 'Timeline' })).toHaveAttribute('aria-valuetext', '0:03.549')
        await expect(transport(page).getByRole('combobox', { name: 'Cue' })).toHaveValue('S4')

        const plot = lane(page, 'Arturek').locator('.run-compare-lane-plot')
        const box = (await plot.boundingBox())!
        await plot.click({ position: { x: box.width / 2, y: box.height / 2 } })

        await expect.poll(async () => {
            const [patrik, arturek] = await rounded(page)
            return Math.abs(patrik - arturek)
        }).toBeLessThan(0.002)
        await expect(transport(page).getByRole('combobox', { name: 'Cue' })).toHaveValue('')
    })

    test('the Cue menu and the next and previous cue buttons cue every run', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)
        await expect(lane(page, 'PatriK')).toContainText('Replay')
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)

        await transport(page).getByRole('combobox', { name: 'Cue' }).selectOption('S4')
        await expect.poll(() => rounded(page)).toEqual([3.74, 3.549])

        await transport(page).getByRole('button', { name: 'Next cue' }).click()
        await expect.poll(() => rounded(page)).toEqual([4.955, 4.732])
        await expect(transport(page).getByRole('combobox', { name: 'Cue' })).toHaveValue('S5')

        await transport(page).getByRole('button', { name: 'Previous cue' }).click()
        await transport(page).getByRole('button', { name: 'Previous cue' }).click()
        await expect.poll(() => rounded(page)).toEqual([2.644, 2.366])
    })

    test('pinning another reference clears the cue', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)
        await expect(lane(page, 'PatriK')).toContainText('Replay')
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)
        await transport(page).getByRole('combobox', { name: 'Cue' }).selectOption('S4')
        await expect.poll(() => rounded(page)).toEqual([3.74, 3.549])

        await runsButton(page).click()
        await rosterRow(page, 'PatriK').getByRole('button', { name: 'Pin' }).click()

        await expect(lane(page, 'PatriK')).toContainText('REF')
        await expect(transport(page).getByRole('combobox', { name: 'Cue' })).toHaveValue('')
        await expect.poll(() => rounded(page)).toEqual([3.549, 3.549])
    })

    test('the toggle writes sync=position in place and marks a run that stays on the race clock', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK, DECL], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK},${DECL}`)
        await expect(lane(page, 'PatriK')).toContainText('Replay')
        await expect(lane(page, 'Decl')).toContainText('Zones')
        await expect(page.getByText('Race clock')).toHaveCount(0)
        await expect(syncToggle(page)).toHaveAttribute('aria-pressed', 'false')
        const lengthBefore = await historyLength(page)

        await syncToggle(page).click()

        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${PATRIK},${ARTUREK},${DECL}&sync=position`)
        expect(await historyLength(page)).toBe(lengthBefore)
        await expect(syncToggle(page)).toHaveAttribute('aria-pressed', 'true')
        await expect(lane(page, 'Decl')).toContainText('Race clock')
        await expect(tile(page, 'Decl')).toContainText('Race clock')
        await expect(lane(page, 'PatriK')).not.toContainText('Race clock')
        await expect(lane(page, 'Arturek')).not.toContainText('Race clock')

        await syncToggle(page).click()

        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${PATRIK},${ARTUREK},${DECL}`)
        await expect(page.getByText('Race clock')).toHaveCount(0)
        expect(await historyLength(page)).toBe(lengthBefore)
    })

    test('a link with sync=position holds each aligned run at the reference\'s position', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK, DECL], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK},${DECL}&sync=position&t=6.000`)
        await expect(lane(page, 'PatriK')).toContainText('Replay')

        await expect.poll(() => rounded(page)).toEqual([6.038, 6, 6])
        expect((await clocksOf(page)).map(clock => clock.paused)).toEqual([true, true, true])

        await syncToggle(page).click()

        await expect.poll(() => rounded(page)).toEqual([6, 6, 6])
    })
})

const EXTRA = ['c7c7c7c7-0000-4000-8000-0000000000c7', 'c8c8c8c8-0000-4000-8000-0000000000c8', 'c9c9c9c9-0000-4000-8000-0000000000c9', 'cacacaca-0000-4000-8000-0000000000ca']
const EXTRA_DETAILS = new Map(EXTRA.map((id, i) => [id, detailFor(id, `70000000000000002${i}`, `Extra ${i + 1}`, 20 + i, 0)]))
const DISALLOWED = 'cbcbcbcb-0000-4000-8000-0000000000cb'

function leaderboardEntry({ cap }: CapDetail): LeaderboardEntry {
    return {
        map: cap.map,
        user: String(cap.user),
        cap_time_seconds: cap.cap_time_seconds,
        added: cap.added ?? '',
        alias: cap.alias ?? '',
        cap_type: cap.cap_type,
        verified: true,
        id: cap.id,
        team: cap.team,
        active_title: null,
        has_ghost: cap.has_ghost,
        zone_checkpoints: cap.zone_checkpoints ?? null,
        disallowed: false,
    }
}

async function mockLeaderboard(page: Page, capIds: readonly string[], { held = new Map<string, Promise<void>>() } = {}) {
    const details = new Map([...DETAILS, ...EXTRA_DETAILS])
    const entries = [
        ...capIds.map(capId => leaderboardEntry(details.get(capId)!)),
        { ...leaderboardEntry(detailFor(DISALLOWED, '700000000000000030', 'Banned', 11, 0)), disallowed: true },
    ]
    await page.route(/https:\/\/api\.utbt\.net\/caps\/leaderboard\/map\/.*/, route => route.fulfill({ json: { success: true, data: entries } }))
    await page.route(/https:\/\/api\.utbt\.net\/caps\/[^/]+\/detail$/, async route => {
        const capId = /\/caps\/([^/]+)\/detail$/.exec(new URL(route.request().url()).pathname)![1]
        await held.get(capId)
        const extra = EXTRA_DETAILS.get(capId)
        if (extra) return route.fulfill({ json: { success: true, data: extra } })
        return route.fallback()
    })
}

function leaderboard(page: Page): Locator {
    return drawer(page).getByRole('list', { name: 'Leaderboard' })
}

function leaderboardRow(page: Page, alias: string): Locator {
    return leaderboard(page).getByRole('listitem').filter({ hasText: alias })
}

function quickAdd(page: Page, label: string): Locator {
    return drawer(page).getByRole('group', { name: 'Quick Add' }).getByRole('button', { name: label, exact: true })
}

test.describe('adding runs from the leaderboard', () => {
    test('a chip adds a tile and a lane behind the open drawer and replaces the address, keeping the stage while the run loads', async ({ page }) => {
        let release = () => {}
        const shxLoaded = new Promise<void>(resolve => { release = resolve })
        await mockApi(page, { videos: [DECL, SHX, BLUE] })
        await mockLeaderboard(page, [BLUE, DECL, SHX, FIERD, BUN], { held: new Map([[SHX, shxLoaded]]) })
        await page.goto(`/compare?runs=${DECL}`)
        await expect(drawer(page)).toBeVisible()
        await expect(leaderboard(page).getByRole('listitem').first()).toContainText('Decl')
        await expect(leaderboardRow(page, 'Decl')).toContainText('REF')
        await expect(leaderboardRow(page, 'Decl')).toContainText('In comparison')
        await expect(leaderboard(page)).not.toContainText('Banned')
        await expect(quickAdd(page, 'WR')).toBeEnabled()
        await expect(quickAdd(page, 'Top 3')).toBeEnabled()
        await expect(quickAdd(page, 'Your PB')).toHaveCount(0)
        const lengthBefore = await historyLength(page)

        await quickAdd(page, 'Next slower').click()

        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX}`)
        await expect(tile(page, 'Decl').locator('video')).toHaveCount(1)
        await expect(drawer(page)).toBeVisible()
        await expect(leaderboardRow(page, 'ShX')).toContainText('In comparison')
        release()
        await expect(tile(page, 'ShX').locator('video')).toHaveCount(1)
        await expect(lane(page, 'ShX')).toBeVisible()
        await expect(rosterRow(page, 'ShX')).toBeVisible()
        await expect(drawer(page)).toBeVisible()
        await expect(quickAdd(page, 'Next slower')).toBeDisabled()
        expect(await historyLength(page)).toBe(lengthBefore)
    })

    test('a search result adds its run with its badges, and removing it from the list drops it', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX, BLUE] })
        await mockLeaderboard(page, [BLUE, DECL, SHX, FIERD, BUN])
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect(lanes(page).getByRole('listitem')).toHaveCount(2)
        await runsButton(page).click()

        const lengthBefore = await historyLength(page)
        await drawer(page).getByRole('searchbox', { name: 'Search Players' }).fill('blue')
        await expect(leaderboard(page).getByRole('listitem')).toHaveCount(1)
        await expect(leaderboardRow(page, 'Bluey')).toContainText('Video')
        await expect(leaderboardRow(page, 'Bluey')).toContainText('Replay')
        await expect(leaderboardRow(page, 'Bluey')).toContainText('Set on Blue')
        await leaderboardRow(page, 'Bluey').getByRole('button', { name: 'Add' }).click()

        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX},${BLUE}`)
        await expect(tile(page, 'Bluey').locator('video')).toHaveCount(1)
        await expect(lane(page, 'Bluey')).toBeVisible()
        await expect(drawer(page)).toBeVisible()
        expect(await historyLength(page)).toBe(lengthBefore)

        await drawer(page).getByRole('searchbox', { name: 'Search Players' }).fill('')
        await leaderboardRow(page, 'ShX').getByRole('button', { name: 'Remove' }).click()

        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${BLUE}`)
        await expect(tile(page, 'ShX')).toHaveCount(0)
        await expect(lane(page, 'ShX')).toHaveCount(0)
        await expect(leaderboardRow(page, 'ShX')).not.toContainText('In comparison')
        await expect(drawer(page)).toBeVisible()
    })

    test('an eleventh run is blocked with the explanation', async ({ page }) => {
        const ten = [DECL, SHX, BLUE, FIERD, BUN, PATRIK, ARTUREK, ...EXTRA.slice(0, 3)]
        await mockApi(page)
        await mockLeaderboard(page, [...ten, EXTRA[3]])
        await page.goto(`/compare?runs=${ten.join(',')}`)
        await expect(lanes(page).getByRole('listitem')).toHaveCount(10)
        await runsButton(page).click()

        await leaderboardRow(page, 'Extra 4').getByRole('button', { name: 'Add' }).click()

        await expect(drawer(page).getByText('A comparison holds at most 10 runs. Remove one before adding another.')).toBeVisible()
        await expect(lanes(page).getByRole('listitem')).toHaveCount(10)
        expect(new URL(page.url()).search).toBe(`?runs=${ten.join(',')}`)
    })
})

function overlayOf(scope: Locator): Locator {
    return scope.locator('.run-compare-overlay')
}

function mutedOf(page: Page): Promise<{ muted: boolean; volume: number }[]> {
    return page.getByRole('region', { name: 'Stage' }).locator('video').evaluateAll(videos => videos.map(video => {
        const { muted, volume } = video as HTMLVideoElement
        return { muted, volume }
    }))
}

test.describe('tile overlays and audio', () => {
    test('each tile shows its player, final time, live delta and the reference pin', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}&t=14.250`)
        const [decl, shx] = [tile(page, 'Decl'), tile(page, 'ShX')]
        await expect.poll(async () => (await clocksOf(page)).map(clock => clock.time)).toEqual([13, 14.25])

        await expect(overlayOf(decl)).toContainText('0:13.000')
        await expect(overlayOf(decl).getByText('REF', { exact: true })).toBeVisible()
        await expect(overlayOf(decl).locator('.run-compare-tile-delta')).toHaveCount(0)
        await expect(overlayOf(shx)).toContainText('0:14.250')
        await expect(overlayOf(shx).getByText('REF', { exact: true })).toHaveCount(0)
        await expect(overlayOf(shx).locator('.run-compare-tile-delta')).toHaveText('+1.250')
        await expect(overlayOf(shx).locator('.run-compare-tile-delta')).toHaveClass(/text-red-300/)
        await expect(overlayOf(shx)).toContainText('Zones')
    })

    test('while playing the overlays hide after 2 s idle and return on a pointer move; paused they stay', async ({ page, isMobile }) => {
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        const shx = tile(page, 'ShX')
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)
        await expect(overlayOf(shx)).toBeVisible()

        await playButton(page).click()

        await expect(overlayOf(shx)).toBeVisible()
        await expect(overlayOf(shx)).toBeHidden({ timeout: 6_000 })
        const box = (await shx.boundingBox())!
        if (isMobile) await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2)
        else await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
        await expect(overlayOf(shx)).toBeVisible()
        await expect(overlayOf(shx)).toBeHidden({ timeout: 6_000 })

        await page.getByRole('region', { name: 'Playback' }).getByRole('button', { name: 'Pause', exact: true }).click()

        await expect(overlayOf(shx)).toBeVisible()
        await page.waitForTimeout(2_500)
        await expect(overlayOf(shx)).toBeVisible()
    })

    test('every video starts muted and choosing audio on one tile unmutes it and mutes the other', async ({ page }) => {
        await page.addInitScript(() => { localStorage.setItem('utbt:replayVideoVolume:v1', '0.4') })
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        const [decl, shx] = [tile(page, 'Decl'), tile(page, 'ShX')]
        await expect.poll(async () => (await mutedOf(page)).map(video => video.muted)).toEqual([true, true])

        await shx.getByRole('button', { name: 'Audio' }).click()

        await expect.poll(() => mutedOf(page)).toEqual([{ muted: true, volume: 0.4 }, { muted: false, volume: 0.4 }])
        await expect(shx.getByRole('button', { name: 'Audio' })).toHaveAttribute('aria-pressed', 'true')
        await expect(decl.getByRole('slider', { name: 'Volume' })).toHaveCount(0)

        await decl.getByRole('button', { name: 'Audio' }).click()

        await expect.poll(async () => (await mutedOf(page)).map(video => video.muted)).toEqual([false, true])
        await expect(shx.getByRole('button', { name: 'Audio' })).toHaveAttribute('aria-pressed', 'false')
        await decl.getByRole('slider', { name: 'Volume' }).fill('0.7')
        await expect.poll(async () => (await mutedOf(page))[0].volume).toBeCloseTo(0.7)
        expect(await page.evaluate(() => localStorage.getItem('utbt:replayVideoVolume:v1'))).toBe('0.7')

        await runsButton(page).click()
        await expect(rosterRow(page, 'Decl').getByRole('button', { name: 'Audio' })).toHaveAttribute('aria-pressed', 'true')
        await rosterRow(page, 'ShX').getByRole('button', { name: 'Audio' }).click()
        await expect.poll(async () => (await mutedOf(page)).map(video => video.muted)).toEqual([true, false])

        await rosterRow(page, 'ShX').getByRole('button', { name: 'Video' }).click()
        await expect(tile(page, 'ShX')).toHaveCount(0)
        await expect(rosterRow(page, 'ShX').getByRole('button', { name: 'Audio' })).toBeDisabled()
        await expect.poll(async () => (await mutedOf(page)).map(video => video.muted)).toEqual([true])
    })

    test('removing and pinning from a tile change the set and replace the address in place', async ({ page, isMobile }) => {
        await mockApi(page, { videos: [DECL, SHX, PATRIK] })
        await page.goto(`/compare?runs=${DECL},${SHX},${PATRIK}`)
        await expect(tile(page, 'PatriK').locator('video')).toHaveCount(1)
        if (isMobile) {
            for (const name of ['Audio', 'Pin', 'Remove']) {
                const target = (await tile(page, 'ShX').getByRole('button', { name }).boundingBox())!
                expect(Math.min(target.width, target.height)).toBeGreaterThanOrEqual(44)
            }
        }
        const lengthBefore = await historyLength(page)

        await tile(page, 'ShX').getByRole('button', { name: 'Pin' }).click()

        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX},${PATRIK}&ref=${SHX}`)
        await expect(overlayOf(tile(page, 'ShX')).getByText('REF', { exact: true })).toBeVisible()
        await expect(overlayOf(tile(page, 'Decl')).getByText('REF', { exact: true })).toHaveCount(0)
        await expect(tile(page, 'ShX').getByRole('button', { name: 'Pin' })).toHaveAttribute('aria-pressed', 'true')

        await tile(page, 'PatriK').getByRole('button', { name: 'Remove' }).click()

        await expect(tile(page, 'PatriK')).toHaveCount(0)
        await expect(lane(page, 'PatriK')).toHaveCount(0)
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX}&ref=${SHX}`)
        expect(await historyLength(page)).toBe(lengthBefore)
    })
})

function focusButton(page: Page, alias: string): Locator {
    return tile(page, alias).getByRole('button', { name: 'Focus' })
}

async function clickTile(page: Page, alias: string) {
    const button = focusButton(page, alias)
    const box = (await button.boundingBox())!
    await button.click({ position: { x: 12, y: box.height - 12 } })
}

async function tileWidths(page: Page, aliases: readonly string[]): Promise<number[]> {
    return Promise.all(aliases.map(async alias => Math.round((await tile(page, alias).boundingBox())!.width)))
}

async function spyOnFullscreen(page: Page) {
    await page.addInitScript(() => {
        const request = Element.prototype.requestFullscreen
        Element.prototype.requestFullscreen = function (this: Element, options?: FullscreenOptions) {
            document.documentElement.dataset.fullscreenRequested = this.className
            return request.call(this, options)
        }
    })
}

function shortcutSheet(page: Page): Locator {
    return page.locator('[data-modal-backdrop]').filter({ has: page.getByRole('heading', { name: 'Keyboard Shortcuts' }) })
}

function fullscreenRequested(page: Page): Promise<string | null> {
    return page.evaluate(() => document.documentElement.dataset.fullscreenRequested ?? null)
}

test.describe('focus, fullscreen and keyboard', () => {
    test('clicking a tile focuses it and moves the audio, 0 returns to the grid and a second click does too', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX, PATRIK] })
        await page.goto(`/compare?runs=${DECL},${SHX},${PATRIK}`)
        await expect.poll(async () => (await mutedOf(page)).map(video => video.muted)).toEqual([true, true, true])

        await clickTile(page, 'ShX')

        await expect(focusButton(page, 'ShX')).toHaveAttribute('aria-pressed', 'true')
        await expect.poll(async () => (await mutedOf(page)).map(video => video.muted)).toEqual([true, false, true])
        await expect.poll(async () => {
            const [decl, shx, patrik] = await tileWidths(page, ['Decl', 'ShX', 'PatriK'])
            return shx > 2 * decl && decl === patrik
        }).toBe(true)

        await page.keyboard.press('0')

        await expect(focusButton(page, 'ShX')).toHaveAttribute('aria-pressed', 'false')
        await expect.poll(async () => new Set(await tileWidths(page, ['Decl', 'ShX', 'PatriK'])).size).toBe(1)
        await expect.poll(async () => (await mutedOf(page)).map(video => video.muted)).toEqual([true, false, true])

        await page.keyboard.press('3')
        await expect(focusButton(page, 'PatriK')).toHaveAttribute('aria-pressed', 'true')
        await expect.poll(async () => (await mutedOf(page)).map(video => video.muted)).toEqual([true, true, false])

        await clickTile(page, 'PatriK')
        await expect(focusButton(page, 'PatriK')).toHaveAttribute('aria-pressed', 'false')
        await expect.poll(async () => new Set(await tileWidths(page, ['Decl', 'ShX', 'PatriK'])).size).toBe(1)
    })

    test('Space plays and pauses, and F requests fullscreen on the stage with the transport bar inside', async ({ page }) => {
        await spyOnFullscreen(page)
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)
        await expect(transport(page).getByRole('button', { name: 'Fullscreen' })).toBeVisible()

        await page.keyboard.press(' ')
        await expect(transport(page).getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
        await expect.poll(async () => (await clocksOf(page)).every(clock => !clock.paused)).toBe(true)

        await page.keyboard.press(' ')
        await expect(playButton(page)).toBeVisible()
        await expect.poll(async () => (await clocksOf(page)).every(clock => clock.paused)).toBe(true)

        await transport(page).getByRole('slider', { name: 'Timeline' }).focus()
        await page.keyboard.press(' ')
        await expect(transport(page).getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
        await page.keyboard.press(' ')
        await expect(playButton(page)).toBeVisible()

        await page.keyboard.press('f')
        await expect.poll(() => fullscreenRequested(page)).toBe('run-compare-theater')
        await expect(page.locator('.run-compare-theater').getByRole('region', { name: 'Playback' })).toHaveCount(1)
    })

    test('without a video tile there is no stage to take fullscreen', async ({ page }) => {
        await spyOnFullscreen(page)
        await mockApi(page)
        await page.goto(`/compare?runs=${FIERD},${BUN}`)
        await expect(lanes(page).getByRole('listitem')).toHaveCount(2)

        await expect(transport(page).getByRole('button', { name: 'Fullscreen' })).toHaveCount(0)
        await page.keyboard.press('f')
        expect(await fullscreenRequested(page)).toBeNull()
    })

    test('[ and ] step through the cues of every run', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)
        await expect(lane(page, 'PatriK')).toContainText('Replay')
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)
        const cue = transport(page).getByRole('combobox', { name: 'Cue' })

        await page.keyboard.press(']')
        await expect(cue).not.toHaveValue('')
        const first = await cue.inputValue()
        await page.keyboard.press(']')
        await expect(cue).not.toHaveValue(first)
        await page.keyboard.press('[')
        await expect(cue).toHaveValue(first)
    })

    test('? opens the shortcut sheet, which lists every shortcut with its control', async ({ page, isMobile }) => {
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect(tile(page, 'ShX').locator('video')).toHaveCount(1)

        await page.keyboard.press('Shift+?')

        const sheet = shortcutSheet(page)
        await expect(sheet).toBeVisible()
        await expect(sheet).toContainText('Play or pause')
        await expect(sheet).toContainText('Or: Back 5 seconds, Forward 5 seconds')
        await page.keyboard.press('Escape')
        await expect(sheet).toHaveCount(0)

        if (isMobile) {
            await expect(transport(page).getByRole('button', { name: 'Shortcuts' })).toHaveCount(0)
            return
        }
        await transport(page).getByRole('button', { name: 'Shortcuts' }).click()
        await expect(sheet).toBeVisible()
    })

    test('typing in the drawer search triggers no shortcut', async ({ page }) => {
        await spyOnFullscreen(page)
        await mockApi(page, { videos: [DECL, SHX] })
        await mockLeaderboard(page, [DECL, SHX, BLUE])
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect.poll(async () => (await mutedOf(page)).map(video => video.muted)).toEqual([true, true])
        await runsButton(page).click()
        const search = drawer(page).getByRole('searchbox', { name: 'Search Players' })
        await search.click()

        await page.keyboard.type('f m1 ?')

        await expect(search).toHaveValue('f m1 ?')
        await expect(shortcutSheet(page)).toHaveCount(0)
        await expect(playButton(page)).toBeVisible()
        await expect(focusButton(page, 'Decl')).toHaveAttribute('aria-pressed', 'false')
        expect((await mutedOf(page)).map(video => video.muted)).toEqual([true, true])
        expect(await fullscreenRequested(page)).toBeNull()
    })
})

function analysis(page: Page): Locator {
    return page.getByRole('region', { name: 'Analysis' })
}

test.describe('solo analysis', () => {
    test('the analysis loads after the page has painted', async ({ page }) => {
        let release = () => {}
        const held = new Promise<void>(resolve => { release = resolve })
        let requested = false
        await page.route(/\/analysis\/RunAnalysis\.tsx/, async route => {
            requested = true
            await held
            await route.continue()
        })
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)

        await expect(transport(page)).toBeVisible()
        await expect.poll(() => requested).toBe(true)
        await expect(analysis(page)).toHaveCount(0)

        release()

        await expect(analysis(page)).toBeVisible()
        await expect(analysis(page).getByRole('heading', { name: 'Sector Matrix' })).toBeVisible()
    })

    test('clicking a sector row cues every video', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)
        await expect(lane(page, 'PatriK')).toContainText('Replay')
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)

        await analysis(page).getByRole('button', { name: 'Cue S4' }).click()

        await expect.poll(() => rounded(page)).toEqual([3.74, 3.549])
        await expect(transport(page).getByRole('combobox', { name: 'Cue' })).toHaveValue('S4')
    })

    test('clicking the cumulative chart seeks every video', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)
        await expect(lane(page, 'PatriK')).toContainText('Replay')
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)

        const chart = analysis(page).locator('.run-compare-cumulative')
        await chart.scrollIntoViewIfNeeded()
        const box = (await chart.boundingBox())!
        await chart.click({ position: { x: box.width / 2, y: box.height / 2 } })

        await expect.poll(async () => Math.min(...(await clocksOf(page)).map(clock => clock.time))).toBeGreaterThan(1)
        await expect(transport(page).getByRole('slider', { name: 'Timeline' })).not.toHaveAttribute('aria-valuetext', /^0:00\.000/)
    })

    test('choosing a run for speed highlights its tile', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK, DECL], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${ARTUREK},${PATRIK},${DECL}`)
        await expect(lane(page, 'PatriK')).toContainText('Replay')
        await expect(tile(page, 'PatriK')).not.toHaveClass(/is-highlighted/)

        await analysis(page).getByRole('button', { name: 'Speed for PatriK' }).click()

        await expect(analysis(page).getByRole('button', { name: 'Speed for PatriK' })).toHaveAttribute('aria-pressed', 'true')
        await expect(tile(page, 'PatriK')).toHaveClass(/is-highlighted/)
        await expect(tile(page, 'Arturek')).not.toHaveClass(/is-highlighted/)
    })

    test('the analysis has no horizontal overflow at 390 px with many runs', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 })
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${ARTUREK},${PATRIK},${DECL},${SHX},${FIERD},${BUN},${BLUE}`)
        await expect(analysis(page).getByRole('heading', { name: 'Sector Matrix' })).toBeVisible()

        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
        for (const panel of await analysis(page).locator('.run-compare-panel').all()) {
            expect(await panel.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
        }
        for (const table of await analysis(page).locator('table').all()) {
            expect(await table.evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(390)
        }
    })
})
