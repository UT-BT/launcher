import { expect, test, type Locator, type Page } from '@playwright/test'
import { RUN_COMPARE_FIXTURES, runCompareErrors, runCompareFixture } from '../app/utils/fixtures/runCompareFixtures'
import { displayMapName } from '../app/utils/format'
import type { CapDetail, LeaderboardEntry } from '../app/utils/api'
import { replayVideoUrl, serveReplayVideos } from './replayVideos'
import { ALPHA, BRAVO, mockTeamComparisons, mockTeamRuns, teamFixtureOf, TEAM_POVS } from './teamRuns'

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

const TOUCH_GRID = { width: 1280, height: 800 }

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
    return page.getByRole('list', { name: 'Gap to the baseline' })
}

function lane(page: Page, alias: string): Locator {
    return lanes(page).getByRole('listitem').filter({ hasText: alias })
}

function capIdOf(alias: string): string {
    return [...DETAILS].find(([, detail]) => detail.cap.alias === alias)![0]
}

function gapPlot(page: Page): Locator {
    return page.locator('.run-compare-gap-plot')
}

function gapLine(page: Page, alias: string): Locator {
    return gapPlot(page).locator(`g[data-run="${capIdOf(alias)}"] path`)
}

function tile(page: Page, alias: string): Locator {
    return page.getByRole('region', { name: 'Stage' }).getByRole('group', { name: alias })
}

function moreButton(scope: Locator, name: string): Locator {
    return scope.getByRole('button', { name: `More for ${name}` })
}

async function openMenu(scope: Locator, name: string): Promise<Locator> {
    await moreButton(scope, name).click()
    const menu = scope.page().getByRole('menu')
    await expect(menu).toBeVisible()
    return menu
}

async function chooseFromMenu(scope: Locator, name: string, item: string) {
    const menu = await openMenu(scope, name)
    await menu.getByRole('menuitem', { name: item, exact: true }).click()
}

async function expectAligned(page: Page, alias: string) {
    await expect(gapLine(page, alias).first()).toBeAttached()
    await expect(tile(page, alias)).not.toContainText('Checkpoints only')
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

test.beforeEach(async ({ page, isMobile }) => {
    if (isMobile) await page.setViewportSize(TOUCH_GRID)
})

function playButton(page: Page): Locator {
    return page.getByRole('region', { name: 'Playback' }).getByRole('button', { name: 'Play', exact: true })
}

test.describe('the compare runs page', () => {
    test('lists both runs of a shared link and titles the tab after them', async ({ page }) => {
        await mockApi(page)
        await page.goto(`/compare?runs=${FIERD},${BUN}`)

        await expect(page.getByRole('heading', { name: `Compare Runs: ${displayMapName(MAP)}` })).toBeVisible()
        await expect(page.getByText('Solo · 2 runs')).toBeVisible()
        await expect(page).toHaveTitle(`fierd_6 vs Bun\` on ${displayMapName(MAP)} — UTBT.net`)
        await expect(page.getByRole('status')).toHaveCount(0)
        expect(new URL(page.url()).search).toBe(`?runs=${FIERD},${BUN}`)

        await runsButton(page).click()
        await expect(drawer(page).getByRole('list', { name: 'Roster' }).getByRole('listitem')).toHaveCount(2)
        await expect(rosterRow(page, 'fierd_6')).toContainText('01:21.234')
        await expect(rosterRow(page, 'Bun`')).toContainText('01:19.500')
    })

    test('drops a malformed id and a repeated run with one notice, and normalises the address in place', async ({ page }) => {
        let release = () => {}
        await mockApi(page, { gate: new Promise<void>(resolve => { release = resolve }) })
        await page.goto('/news')
        await page.evaluate(path => { window.location.assign(path) }, `/compare?runs=${FIERD},not-a-cap,${BUN},${FIERD}&t=4.5`)
        await expect(page.getByRole('heading', { name: 'Compare Runs' })).toBeVisible()
        const lengthBefore = await page.evaluate(() => window.history.length)

        release()

        await expect(page.getByText('Solo · 2 runs')).toBeVisible()
        await expect(page.getByRole('status')).toHaveText('Dropped 1 malformed run id and 1 repeated run.')
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${FIERD},${BUN}`)
        expect(await page.evaluate(() => window.history.length)).toBe(lengthBefore)
        await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', new RegExp(`/compare\\?runs=${[FIERD, BUN].sort().join(',')}$`))

        await page.goBack()
        await expect.poll(() => new URL(page.url()).pathname).toBe('/news')
    })

    test('shows the start view with its notice when no run is valid', async ({ page }) => {
        await mockApi(page)
        await page.goto('/compare?runs=not-a-cap,c3c3c3c3-0000-4000-8000-0000000000c3')

        await expect(page.getByRole('heading', { name: 'Pick a Map' })).toBeVisible()
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
        await expect(page.getByRole('slider', { name: 'Timeline' })).toHaveAttribute('aria-valuetext', '00:12.500')
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX}`)
    })

    test('a video that fails to load drops its run to a graph-only lane and the other still plays', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX], missingVideos: [DECL] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)

        await expect(tile(page, 'Decl')).toHaveCount(0)
        await expect(lane(page, 'Decl')).toBeVisible()
        await runsButton(page).click()
        await expect(rosterRow(page, 'Decl')).toContainText('Video didn’t load')
        await drawer(page).getByRole('button', { name: 'Close Runs' }).click()

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

        await expect(decl.getByText('CAP 00:13.000 · ±0.000 · 1st')).toBeVisible({ timeout: 15_000 })
        const frozen = await clockOf(decl)
        expect(frozen.paused).toBe(true)
        expect(frozen.time).toBeCloseTo(13, 2)
        await expect.poll(async () => (await clockOf(shx)).time).toBeGreaterThan(13.2)

        await expect(shx.getByText('CAP 00:14.250 · +1.250 · 2nd')).toBeVisible({ timeout: 15_000 })
        expect((await clockOf(shx)).time).toBeCloseTo(14.25, 2)
        await expect(playButton(page)).toBeVisible()
    })
})

test.describe('delta lanes and data rungs', () => {
    test('an aligned pair shows two lanes with no note, the baseline and the reference sector ticks', async ({ page }) => {
        const compared: string[] = []
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' }, compared })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)

        await expect(lanes(page).getByRole('listitem')).toHaveCount(2)
        await expectAligned(page, 'PatriK')
        await expect(tile(page, 'PatriK')).not.toContainText('Final time only')
        await expect(lane(page, 'Arturek')).toContainText('Baseline')
        await expect(tile(page, 'Arturek')).toContainText('Baseline')
        await expect(tile(page, 'PatriK')).toContainText('vs Arturek')
        await expect(page.getByRole('list', { name: 'Sectors' }).getByRole('listitem')).toHaveCount(10)
        expect(compared).toEqual([`${PATRIK}:${ARTUREK}`])
    })

    test('a comparison the server refuses falls back to checkpoint gaps', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'conflict' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)

        await expect(tile(page, 'PatriK')).toContainText('Checkpoints only')
        await expect(gapLine(page, 'PatriK').first()).toBeAttached()
    })

    test('one run on each side carries its side tag and compares by final time only, with no baseline, graph or analysis', async ({ page }) => {
        const compared: string[] = []
        await mockApi(page, { videos: [ARTUREK, BLUE], compared })
        await page.goto(`/compare?runs=${ARTUREK},${BLUE}`)

        await expect(tile(page, 'Bluey')).toContainText('Blue')
        await expect(tile(page, 'Arturek')).toContainText('Red')
        await expect(tile(page, 'Bluey')).not.toContainText('Baseline')
        await expect(tile(page, 'Arturek')).not.toContainText('Baseline')
        await expect(tile(page, 'Bluey')).not.toContainText('Final time only')
        await expect(lanes(page)).toHaveCount(0)
        await expect(gapPlot(page)).toHaveCount(0)
        await expect(transport(page)).toContainText('Red and blue take different routes')
        await expect(page.getByRole('region', { name: 'Analysis' })).toHaveCount(0)
        await expect(transport(page).getByRole('group', { name: 'Analyse Side' })).toHaveCount(0)
        expect(compared).toEqual([])
    })

    test('a click on the gap graph seeks every video to that time', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)

        const plot = gapPlot(page)
        const box = (await plot.boundingBox())!
        await plot.click({ position: { x: box.width / 2, y: box.height / 2 } })

        await expect.poll(async () => (await clocksOf(page)).map(clock => Math.round(clock.time * 10) / 10)).toEqual([7.1, 7.1])
        expect((await clocksOf(page)).map(clock => clock.paused)).toEqual([true, true])
        await expect(page.getByRole('slider', { name: 'Timeline' })).toHaveAttribute('aria-valuetext', /^00:07.1/)
    })

    test('dragging across the gap graph scrubs every video along with the pointer', async ({ page, isMobile }) => {
        test.skip(isMobile, 'touch scrubbing has its own test')
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)
        await expect(gapLine(page, 'ShX').first()).toBeAttached()

        const box = (await gapPlot(page).boundingBox())!
        const y = box.y + box.height / 2
        await page.mouse.move(box.x + box.width * 0.2, y)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width * 0.5, y, { steps: 6 })
        await expect(page.getByRole('slider', { name: 'Timeline' })).toHaveAttribute('aria-valuetext', /^00:07.1/)
        await page.mouse.move(box.x + box.width * 0.8, y, { steps: 6 })
        await page.mouse.up()

        await expect.poll(async () => (await clocksOf(page)).map(clock => Math.round(clock.time))).toEqual([11, 11])
        expect((await clocksOf(page)).map(clock => clock.paused)).toEqual([true, true])
    })

    test('on touch a vertical swipe across the gap graph leaves the playhead and a tap seeks', async ({ page, isMobile }) => {
        test.skip(!isMobile, 'touch gestures run on the phone project')
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)

        const timeline = page.getByRole('slider', { name: 'Timeline' })
        const plot = gapPlot(page)
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
        await expect(timeline).toHaveAttribute('aria-valuetext', '00:00.000')

        const to = (await plot.boundingBox())!
        await page.touchscreen.tap(to.x + to.width / 2, to.y + to.height / 2)
        await expect.poll(async () => (await clocksOf(page)).map(clock => Math.round(clock.time * 10) / 10)).toEqual([7.1, 7.1])
        await expect(timeline).toHaveAttribute('aria-valuetext', /^00:07.1/)
    })
})

function drawer(page: Page): Locator {
    return page.getByRole('region', { name: 'Runs' })
}

function rosterRow(page: Page, alias: string): Locator {
    return drawer(page).getByRole('list', { name: 'Roster' }).getByRole('listitem').filter({ hasText: alias })
}

function runsButton(page: Page): Locator {
    return page.getByRole('button', { name: /^Runs · \d+$/ })
}

function historyLength(page: Page): Promise<number> {
    return page.evaluate(() => window.history.length)
}

async function stageBox(page: Page) {
    return page.getByRole('region', { name: 'Stage' }).boundingBox()
}

async function settledStageBox(page: Page) {
    let last = await stageBox(page)
    await expect.poll(async () => {
        const now = await stageBox(page)
        const same = JSON.stringify(now) === JSON.stringify(last)
        last = now
        return same
    }, { intervals: [400] }).toBe(true)
    return last
}

test.describe('the runs drawer', () => {
    test('opens over the stage without resizing it, and removing a run replaces the address in place', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX, PATRIK] })
        await page.goto(`/compare?runs=${DECL},${SHX},${PATRIK}`)
        await expect(tile(page, 'PatriK').locator('video')).toHaveCount(1)
        await expect(drawer(page)).toHaveCount(0)
        await expect(gapLine(page, 'ShX').first()).toBeAttached()
        const closed = await settledStageBox(page)

        await runsButton(page).click()

        await expect(drawer(page)).toBeVisible()
        await expect(runsButton(page)).toHaveAttribute('aria-expanded', 'true')
        expect(await stageBox(page)).toEqual(closed)
        const lengthBefore = await historyLength(page)

        await chooseFromMenu(rosterRow(page, 'PatriK'), 'PatriK', 'Remove')

        await expect(tile(page, 'PatriK')).toHaveCount(0)
        await expect(lane(page, 'PatriK')).toHaveCount(0)
        await expect(lanes(page).getByRole('listitem')).toHaveCount(2)
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX}`)
        expect(await historyLength(page)).toBe(lengthBefore)
        await expect(drawer(page)).toBeVisible()
        await expect(drawer(page).getByRole('list', { name: 'Roster' }).getByRole('listitem')).toHaveCount(2)
    })

    test('setting another baseline measures the other runs against it', async ({ page }) => {
        const compared: string[] = []
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' }, compared })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)
        await expectAligned(page, 'PatriK')
        await expect(lane(page, 'Arturek')).toContainText('Baseline')

        await runsButton(page).click()
        await chooseFromMenu(rosterRow(page, 'PatriK'), 'PatriK', 'Set as Baseline')

        await expect(lane(page, 'PatriK')).toContainText('Baseline')
        await expect(lane(page, 'Arturek')).not.toContainText('Baseline')
        await expect(rosterRow(page, 'Arturek')).toContainText('Checkpoints only')
        await expect(rosterRow(page, 'PatriK')).toContainText('Baseline')
        const menu = await openMenu(rosterRow(page, 'PatriK'), 'PatriK')
        await expect(menu.getByRole('menuitem', { name: 'Unpin Baseline' })).toBeVisible()
        await page.keyboard.press('Escape')
        await expect(drawer(page).getByRole('listitem').first()).toContainText('PatriK')
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${PATRIK},${ARTUREK}&ref=${PATRIK}`)
        expect(compared).toEqual([`${PATRIK}:${ARTUREK}`, `${ARTUREK}:${PATRIK}`])
    })

    test('turning a video off keeps its lane and drops its tile', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect(tile(page, 'ShX').locator('video')).toHaveCount(1)
        await runsButton(page).click()

        await chooseFromMenu(rosterRow(page, 'ShX'), 'ShX', 'Hide Video, Keep the Graph')

        await expect(tile(page, 'ShX')).toHaveCount(0)
        await expect(lane(page, 'ShX')).toBeVisible()
        const menu = await openMenu(rosterRow(page, 'ShX'), 'ShX')
        await expect(menu.getByRole('menuitem', { name: 'Show Video' })).toBeVisible()
        await page.keyboard.press('Escape')
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX}&data=${SHX}`)
    })

    test('an older video is flagged and its sync is adjusted from the row menu', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX], converted: [SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect(tile(page, 'ShX').locator('video')).toHaveCount(1)
        await expect(tile(page, 'ShX')).toContainText('Older video')
        await expect(tile(page, 'Decl')).not.toContainText('Older video')
        await runsButton(page).click()
        await expect(rosterRow(page, 'ShX')).toContainText('Older video')
        await expect(rosterRow(page, 'Decl')).not.toContainText('Older video')
        const declMenu = await openMenu(rosterRow(page, 'Decl'), 'Decl')
        await expect(declMenu.getByRole('menuitem', { name: /^Adjust Sync/ })).toHaveCount(0)
        await page.keyboard.press('Escape')
        const lengthBefore = await historyLength(page)

        const menu = await openMenu(rosterRow(page, 'ShX'), 'ShX')
        await menu.getByRole('menuitem', { name: 'Adjust Sync · 0 ms' }).focus()
        await page.keyboard.press('ArrowRight')
        await expect(page.getByRole('menuitem', { name: '−100 ms' })).toBeFocused()
        await page.getByRole('menuitem', { name: '+1 frame' }).focus()
        await page.keyboard.press('Enter')
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX}&off=${SHX}:17`)
        await page.getByRole('menuitem', { name: '+100 ms' }).focus()
        await page.keyboard.press('Enter')

        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX}&off=${SHX}:117`)
        expect(await historyLength(page)).toBe(lengthBefore)

        await page.keyboard.press('Escape')
        await expect(page.getByRole('menu')).toHaveCount(0)
        await expect(drawer(page)).toBeVisible()
        const again = await openMenu(rosterRow(page, 'ShX'), 'ShX')
        await expect(again.getByRole('menuitem', { name: 'Adjust Sync · +117 ms' })).toBeVisible()
    })

    test('a link with one run opens with the drawer open', async ({ page }) => {
        await mockApi(page, { videos: [DECL] })
        await page.goto(`/compare?runs=${DECL}`)

        await expect(drawer(page)).toBeVisible()
        await expect(drawer(page)).toContainText('1 of 10')
        await expect(rosterRow(page, 'Decl')).not.toContainText('Baseline')
        const menu = await openMenu(rosterRow(page, 'Decl'), 'Decl')
        await expect(menu.getByRole('menuitem', { name: 'Remove' })).toBeDisabled()
    })

    test('Back closes the open drawer and keeps the page and its edits; the next Back leaves the page', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX, PATRIK] })
        await page.goto('/news')
        await page.evaluate(path => { window.location.assign(path) }, `/compare?runs=${DECL},${SHX},${PATRIK}`)
        await expect(lanes(page).getByRole('listitem')).toHaveCount(3)
        await runsButton(page).click()
        await chooseFromMenu(rosterRow(page, 'PatriK'), 'PatriK', 'Remove')
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX}`)

        await page.goBack()

        await expect(drawer(page)).toHaveCount(0)
        await expect(page.getByRole('heading', { name: /^Compare Runs/ })).toBeVisible()
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX}`)
        await expect(lanes(page).getByRole('listitem')).toHaveCount(2)

        await page.goBack()
        await expect.poll(() => new URL(page.url()).pathname).toBe('/news')
    })

    test('clicks on the open drawer stay in the drawer, even where it covers a tile', async ({ page, isMobile }) => {
        test.skip(isMobile, 'the phone sheet sits under the stage')
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect(tile(page, 'ShX').locator('video')).toHaveCount(1)
        await runsButton(page).click()
        await expect(drawer(page)).toBeVisible()

        const panel = (await drawer(page).boundingBox())!
        const covered = (await tile(page, 'ShX').boundingBox())!
        const area = {
            left: Math.max(panel.x, covered.x),
            right: Math.min(panel.x + panel.width, covered.x + covered.width),
            top: Math.max(panel.y, covered.y),
            bottom: Math.min(panel.y + panel.height, covered.y + covered.height),
        }
        expect(area.right).toBeGreaterThan(area.left)
        expect(area.bottom).toBeGreaterThan(area.top)
        const escaped = await page.evaluate(({ left, right, top, bottom }) => {
            const misses: string[] = []
            for (let y = top + 4; y < bottom; y += 24) {
                for (let x = left + 4; x < right; x += 24) {
                    const hit = document.elementFromPoint(x, y)
                    if (!hit?.closest('.run-compare-drawer')) misses.push(`${Math.round(x)},${Math.round(y)}`)
                }
            }
            return misses
        }, area)
        expect(escaped).toEqual([])

        await page.mouse.click(area.left + 6, area.top + 6)
        await expect(focusButton(page, 'ShX')).toHaveAttribute('aria-pressed', 'false')
        await expect(drawer(page)).toBeVisible()
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

function syncButton(page: Page, mode: 'Race' | 'Same Spot'): Locator {
    return transport(page).getByRole('group', { name: 'Sync' }).getByRole('button', { name: mode, exact: true })
}

function sectorTick(page: Page, label: string): Locator {
    return page.getByRole('list', { name: 'Sectors' }).getByRole('listitem').nth(Number(label.slice(1)) - 1)
}

async function jumpTo(page: Page, label: string) {
    await transport(page).getByRole('button', { name: 'Jump to Sector' }).click()
    await page.getByRole('menuitemradio', { name: new RegExp(`^${label}(?!\\d)`) }).click()
}

async function rounded(page: Page): Promise<number[]> {
    return (await clocksOf(page)).map(clock => Math.round(clock.time * 1000) / 1000)
}

test.describe('sector cue and sync by position', () => {
    test('clicking sector 4\'s tick puts each video at its own entry into it, and a click on the gap graph clears the cue', async ({ page, isMobile }) => {
        test.skip(isMobile, 'on touch the ticks are marks and the Jump to Sector menu cues')
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)
        await expectAligned(page, 'PatriK')
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)

        await page.getByRole('list', { name: 'Sectors' }).getByRole('button', { name: 'Jump to S4' }).click()

        await expect.poll(() => rounded(page)).toEqual([3.74, 3.549])
        expect((await clocksOf(page)).map(clock => clock.paused)).toEqual([true, true])
        await expect(transport(page).getByRole('slider', { name: 'Timeline' })).toHaveAttribute('aria-valuetext', '00:03.549')
        await expect(sectorTick(page, 'S4')).toHaveClass(/is-active/)

        const plot = gapPlot(page)
        const box = (await plot.boundingBox())!
        await plot.click({ position: { x: box.width / 2, y: box.height / 2 } })

        await expect.poll(async () => {
            const [patrik, arturek] = await rounded(page)
            return Math.abs(patrik - arturek)
        }).toBeLessThan(0.002)
        await expect(sectorTick(page, 'S4')).not.toHaveClass(/is-active/)
    })

    test('the Jump to Sector menu cues every run and checks the sector it cued', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)
        await expectAligned(page, 'PatriK')
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)

        await jumpTo(page, 'S4')
        await expect.poll(() => rounded(page)).toEqual([3.74, 3.549])

        await jumpTo(page, 'S5')
        await expect.poll(() => rounded(page)).toEqual([4.955, 4.732])
        await transport(page).getByRole('button', { name: 'Jump to Sector' }).click()
        await expect(page.getByRole('menuitemradio', { name: /^S5(?!\d)/ })).toHaveAttribute('aria-checked', 'true')
        await page.keyboard.press('Escape')

        await jumpTo(page, 'S3')
        await expect.poll(() => rounded(page)).toEqual([2.644, 2.366])
    })

    test('setting another baseline clears the cue', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)
        await expectAligned(page, 'PatriK')
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)
        await jumpTo(page, 'S4')
        await expect.poll(() => rounded(page)).toEqual([3.74, 3.549])

        await chooseFromMenu(tile(page, 'PatriK'), 'PatriK', 'Set as Baseline')

        await expect(lane(page, 'PatriK')).toContainText('Baseline')
        await expect(sectorTick(page, 'S4')).not.toHaveClass(/is-active/)
        await expect.poll(() => rounded(page)).toEqual([3.549, 3.549])
    })

    test('Same Spot writes sync=position in place and marks a run that plays in race time', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK, DECL], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK},${DECL}`)
        await expectAligned(page, 'PatriK')
        await expect(tile(page, 'Decl')).toContainText('Checkpoints only')
        await expect(page.getByText('Plays in race time')).toHaveCount(0)
        await expect(syncButton(page, 'Race')).toHaveAttribute('aria-pressed', 'true')
        await expect(syncButton(page, 'Same Spot')).toHaveAttribute('aria-pressed', 'false')
        const lengthBefore = await historyLength(page)

        await syncButton(page, 'Same Spot').click()

        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${PATRIK},${ARTUREK},${DECL}&sync=position`)
        expect(await historyLength(page)).toBe(lengthBefore)
        await expect(syncButton(page, 'Same Spot')).toHaveAttribute('aria-pressed', 'true')
        await expect(tile(page, 'Decl')).toContainText('Plays in race time')
        await expect(tile(page, 'PatriK')).not.toContainText('Plays in race time')
        await expect(tile(page, 'Arturek')).not.toContainText('Plays in race time')

        await syncButton(page, 'Race').click()

        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${PATRIK},${ARTUREK},${DECL}`)
        await expect(page.getByText('Plays in race time')).toHaveCount(0)
        expect(await historyLength(page)).toBe(lengthBefore)
    })

    test('a link with sync=position holds each aligned run at the reference\'s position', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK, DECL], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK},${DECL}&sync=position&t=6.000`)
        await expectAligned(page, 'PatriK')

        await expect.poll(() => rounded(page)).toEqual([6.038, 6, 6])
        expect((await clocksOf(page)).map(clock => clock.paused)).toEqual([true, true, true])

        await syncButton(page, 'Race').click()

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
        await expect(leaderboardRow(page, 'Decl').getByRole('button', { name: 'Remove Decl' })).toHaveAttribute('aria-pressed', 'true')
        await expect(leaderboard(page)).not.toContainText('Banned')
        await expect(quickAdd(page, 'World Record')).toBeEnabled()
        await expect(quickAdd(page, 'Top 3')).toBeEnabled()
        await expect(quickAdd(page, 'Your Best')).toHaveCount(0)
        const lengthBefore = await historyLength(page)

        await quickAdd(page, 'Next Slower').click()

        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX}`)
        await expect(tile(page, 'Decl').locator('video')).toHaveCount(1)
        await expect(drawer(page)).toBeVisible()
        await expect(leaderboardRow(page, 'ShX').getByRole('button', { name: 'Remove ShX' })).toHaveAttribute('aria-pressed', 'true')
        release()
        await expect(tile(page, 'ShX').locator('video')).toHaveCount(1)
        await expect(lane(page, 'ShX')).toBeVisible()
        await expect(rosterRow(page, 'ShX')).toBeVisible()
        await expect(drawer(page)).toBeVisible()
        await expect(quickAdd(page, 'Next Slower')).toBeDisabled()
        expect(await historyLength(page)).toBe(lengthBefore)
    })

    test('a search result adds its run with its video mark and side tag, and removing it from the list drops it', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX, BLUE] })
        await mockLeaderboard(page, [BLUE, DECL, SHX, FIERD, BUN])
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect(lanes(page).getByRole('listitem')).toHaveCount(2)
        await runsButton(page).click()

        const lengthBefore = await historyLength(page)
        await drawer(page).getByRole('searchbox', { name: 'Search Players' }).fill('blue')
        await expect(leaderboard(page).getByRole('listitem')).toHaveCount(1)
        await expect(leaderboardRow(page, 'Bluey').getByRole('img', { name: 'Has video' })).toBeVisible()
        await expect(leaderboardRow(page, 'Bluey')).not.toContainText('Checkpoints only')
        await expect(leaderboardRow(page, 'Bluey')).toContainText('Blue')
        await expect(drawer(page).getByRole('group', { name: 'Side' })).toBeVisible()
        await leaderboardRow(page, 'Bluey').getByRole('button', { name: 'Add Bluey' }).click()

        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX},${BLUE}`)
        await expect(tile(page, 'Bluey').locator('video')).toHaveCount(1)
        await expect(lane(page, 'Bluey')).toHaveCount(0)
        await expect(transport(page)).toContainText('1 blue run on the other route')
        await expect(drawer(page)).toBeVisible()
        expect(await historyLength(page)).toBe(lengthBefore)

        await drawer(page).getByRole('searchbox', { name: 'Search Players' }).fill('')
        await leaderboardRow(page, 'ShX').getByRole('button', { name: 'Remove ShX' }).click()

        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${BLUE}`)
        await expect(tile(page, 'ShX')).toHaveCount(0)
        await expect(lane(page, 'ShX')).toHaveCount(0)
        await expect(leaderboardRow(page, 'ShX').getByRole('button', { name: 'Add ShX' })).toHaveAttribute('aria-pressed', 'false')
        await expect(drawer(page)).toBeVisible()
    })

    test('an eleventh run is blocked with the explanation', async ({ page }) => {
        const ten = [DECL, SHX, BLUE, FIERD, BUN, PATRIK, ARTUREK, ...EXTRA.slice(0, 3)]
        await mockApi(page)
        await mockLeaderboard(page, [...ten, EXTRA[3]])
        await page.goto(`/compare?runs=${ten.join(',')}`)
        await expect(runsButton(page)).toContainText('10')
        await runsButton(page).click()

        await leaderboardRow(page, 'Extra 4').getByRole('button', { name: 'Add Extra 4' }).click()

        await expect(drawer(page).getByText('A comparison holds at most 10 runs. Remove one before adding another.')).toBeVisible()
        await expect(drawer(page).getByRole('list', { name: 'Roster' }).getByRole('listitem')).toHaveCount(10)
        expect(new URL(page.url()).search).toBe(`?runs=${ten.join(',')}`)
    })
})

function nameTag(scope: Locator): Locator {
    return scope.locator('.run-compare-tile-name')
}

function liveTag(scope: Locator): Locator {
    return scope.locator('.run-compare-tile-live')
}

function tagsMenu(page: Page): Locator {
    return transport(page).getByRole('button', { name: 'Show on Videos' })
}

function soundButton(scope: Locator, alias: string): Locator {
    return scope.getByRole('button', { name: `Sound from ${alias}` })
}

function mutedOf(page: Page): Promise<{ muted: boolean; volume: number }[]> {
    return page.getByRole('region', { name: 'Stage' }).locator('video').evaluateAll(videos => videos.map(video => {
        const { muted, volume } = video as HTMLVideoElement
        return { muted, volume }
    }))
}

test.describe('tags on the videos and sound', () => {
    test('each video shows its player and final time top left, and its live gap against the baseline or the baseline chip top right', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}&t=14.250`)
        const [decl, shx] = [tile(page, 'Decl'), tile(page, 'ShX')]
        await expect.poll(async () => (await clocksOf(page)).map(clock => clock.time)).toEqual([13, 14.25])

        await expect(nameTag(decl)).toContainText('Decl')
        await expect(nameTag(decl)).toContainText('00:13.000')
        await expect(liveTag(decl).getByText('Baseline', { exact: true })).toBeVisible()
        await expect(liveTag(decl).locator('.run-compare-gap-value')).toHaveCount(0)
        await expect(nameTag(shx)).toContainText('00:14.250')
        await expect(nameTag(shx)).toContainText('Checkpoints only')
        await expect(liveTag(shx).getByText('Baseline', { exact: true })).toHaveCount(0)
        await expect(liveTag(shx).locator('.run-compare-gap-value')).toHaveText('+1.250')
        await expect(liveTag(shx).locator('.run-compare-gap-value')).toHaveClass(/text-red-300/)
        await expect(liveTag(shx)).toContainText('vs Decl')
        await expect(page.getByText('REF', { exact: true })).toHaveCount(0)
    })

    test('the tags sit on the picture, in the top corners, and stay visible while playing', async ({ page, isMobile }) => {
        test.skip(isMobile, 'phones show the captions under the stage')
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        const shx = tile(page, 'ShX')
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)
        const video = (await shx.locator('video').boundingBox())!
        const name = (await nameTag(shx).boundingBox())!
        const live = (await liveTag(shx).boundingBox())!
        const actions = (await shx.locator('.run-compare-tile-actions').boundingBox())!
        expect(name.x).toBeLessThan(video.x + video.width / 2)
        expect(name.y).toBeLessThan(video.y + video.height / 4)
        expect(live.x).toBeGreaterThan(video.x + video.width / 2)
        expect(live.y).toBeLessThan(video.y + video.height / 4)
        expect(actions.y + actions.height).toBeLessThanOrEqual(video.y + video.height + 1)
        expect(actions.y).toBeGreaterThan(video.y + video.height / 2)
        expect(name.y + name.height).toBeLessThanOrEqual(video.y + video.height)

        await playButton(page).click()
        await expect.poll(async () => (await clocksOf(page)).every(clock => !clock.paused)).toBe(true)
        await page.waitForTimeout(2_500)

        await expect(nameTag(shx)).toBeVisible()
        await expect(liveTag(shx)).toBeVisible()
    })

    test('Show on Videos turns the names and the live gap off one at a time, and the choice survives a reload', async ({ page, isMobile }) => {
        test.skip(isMobile, 'phones show the captions under the stage instead')
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        const shx = tile(page, 'ShX')
        await expect(nameTag(shx)).toBeVisible()
        await expect(liveTag(shx)).toBeVisible()

        await tagsMenu(page).click()
        const menu = page.getByRole('menu')
        await expect(menu.getByRole('menuitemcheckbox', { name: 'Names' })).toHaveAttribute('aria-checked', 'true')
        await menu.getByRole('menuitemcheckbox', { name: 'Names' }).click()
        await expect(menu.getByRole('menuitemcheckbox', { name: 'Names' })).toHaveAttribute('aria-checked', 'false')
        await expect(menu.getByRole('menuitemcheckbox', { name: 'Live Gap' })).toHaveAttribute('aria-checked', 'true')
        await page.keyboard.press('Escape')
        await expect(menu).toHaveCount(0)
        await expect(nameTag(shx)).toHaveCount(0)
        await expect(liveTag(shx)).toBeVisible()

        await tagsMenu(page).click()
        await page.getByRole('menu').getByRole('menuitemcheckbox', { name: 'Live Gap' }).click()
        await page.keyboard.press('Escape')
        await expect(page.getByRole('menu')).toHaveCount(0)
        await expect(liveTag(shx)).toHaveCount(0)
        await expect(shx.getByRole('button', { name: 'Sound from ShX' })).toBeVisible()
        expect(JSON.parse((await page.evaluate(() => localStorage.getItem('utbt:compareVideoTags:v1')))!)).toEqual({ names: false, gap: false })

        await page.reload()
        await expect(shx.locator('video')).toHaveCount(1)
        await expect(nameTag(shx)).toHaveCount(0)
        await expect(liveTag(shx)).toHaveCount(0)

        await tagsMenu(page).click()
        await page.getByRole('menu').getByRole('menuitemcheckbox', { name: 'Names' }).click()
        await page.keyboard.press('Escape')
        await expect(nameTag(shx)).toBeVisible()
        await expect(liveTag(shx)).toHaveCount(0)
    })

    test('the videos never offer the picture-in-picture pop-out', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)

        expect(await page.getByRole('region', { name: 'Stage' }).locator('video').evaluateAll(videos => videos.map(video => (video as HTMLVideoElement).disablePictureInPicture))).toEqual([true, true])
    })

    test('every video starts muted, and each speaker turns its own sound on and off so several can play at once', async ({ page, isMobile }) => {
        await page.addInitScript(() => { localStorage.setItem('utbt:replayVideoVolume:v1', '0.4') })
        await mockApi(page, { videos: [DECL, SHX] })
        await page.goto(`/compare?runs=${DECL},${SHX}`)
        const [decl, shx] = [tile(page, 'Decl'), tile(page, 'ShX')]
        await expect.poll(async () => (await mutedOf(page)).map(video => video.muted)).toEqual([true, true])

        await soundButton(shx, 'ShX').click()

        await expect.poll(() => mutedOf(page)).toEqual([{ muted: true, volume: 0.4 }, { muted: false, volume: 0.4 }])
        await expect(soundButton(shx, 'ShX')).toHaveAttribute('aria-pressed', 'true')

        await soundButton(decl, 'Decl').click()

        await expect.poll(async () => (await mutedOf(page)).map(video => video.muted)).toEqual([false, false])
        await expect(soundButton(shx, 'ShX')).toHaveAttribute('aria-pressed', 'true')
        await expect(soundButton(decl, 'Decl')).toHaveAttribute('aria-pressed', 'true')

        await soundButton(shx, 'ShX').click()

        await expect.poll(async () => (await mutedOf(page)).map(video => video.muted)).toEqual([false, true])
        await expect(soundButton(shx, 'ShX')).toHaveAttribute('aria-pressed', 'false')
        if (isMobile) {
            await expect(transport(page).getByRole('slider', { name: 'Volume' })).toHaveCount(0)
        } else {
            await transport(page).getByRole('slider', { name: 'Volume' }).fill('0.7')
            await expect.poll(async () => (await mutedOf(page))[0].volume).toBeCloseTo(0.7)
            expect(await page.evaluate(() => localStorage.getItem('utbt:replayVideoVolume:v1'))).toBe('0.7')
        }

        await runsButton(page).click()
        await expect(soundButton(rosterRow(page, 'Decl'), 'Decl')).toHaveAttribute('aria-pressed', 'true')
        await soundButton(rosterRow(page, 'ShX'), 'ShX').click()
        await expect.poll(async () => (await mutedOf(page)).map(video => video.muted)).toEqual([false, false])
        await soundButton(rosterRow(page, 'Decl'), 'Decl').click()
        await expect.poll(async () => (await mutedOf(page)).map(video => video.muted)).toEqual([true, false])

        await chooseFromMenu(rosterRow(page, 'ShX'), 'ShX', 'Hide Video, Keep the Graph')
        await expect(tile(page, 'ShX')).toHaveCount(0)
        await expect(soundButton(rosterRow(page, 'ShX'), 'ShX')).toBeDisabled()
        await expect.poll(async () => (await mutedOf(page)).map(video => video.muted)).toEqual([true])
    })

    test('setting the baseline and removing from a tile menu change the set and replace the address in place', async ({ page, isMobile }) => {
        await mockApi(page, { videos: [DECL, SHX, PATRIK] })
        await page.goto(`/compare?runs=${DECL},${SHX},${PATRIK}`)
        await expect(tile(page, 'PatriK').locator('video')).toHaveCount(1)
        if (isMobile) {
            for (const target of [soundButton(tile(page, 'ShX'), 'ShX'), moreButton(tile(page, 'ShX'), 'ShX')]) {
                const box = (await target.boundingBox())!
                expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44)
            }
        }
        const lengthBefore = await historyLength(page)

        await chooseFromMenu(tile(page, 'ShX'), 'ShX', 'Set as Baseline')

        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${DECL},${SHX},${PATRIK}&ref=${SHX}`)
        await expect(tile(page, 'ShX').getByText('Baseline', { exact: true })).toBeVisible()
        await expect(tile(page, 'Decl').getByText('Baseline', { exact: true })).toHaveCount(0)
        const menu = await openMenu(tile(page, 'ShX'), 'ShX')
        await expect(menu.getByRole('menuitem', { name: 'Unpin Baseline' })).toBeVisible()
        await page.keyboard.press('Escape')

        await chooseFromMenu(tile(page, 'PatriK'), 'PatriK', 'Remove')

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

    test('focusing a tile keeps the sound when that tile already plays, and M moves a single sound along the tiles', async ({ page }) => {
        await mockApi(page, { videos: [DECL, SHX, PATRIK] })
        await page.goto(`/compare?runs=${DECL},${SHX},${PATRIK}`)
        const muted = async () => (await mutedOf(page)).map(video => video.muted)
        await expect.poll(muted).toEqual([true, true, true])

        await soundButton(tile(page, 'Decl'), 'Decl').click()
        await soundButton(tile(page, 'ShX'), 'ShX').click()
        await expect.poll(muted).toEqual([false, false, true])

        await clickTile(page, 'ShX')
        await expect(focusButton(page, 'ShX')).toHaveAttribute('aria-pressed', 'true')
        await expect.poll(muted).toEqual([false, false, true])
        await page.keyboard.press('0')

        await clickTile(page, 'PatriK')
        await expect(focusButton(page, 'PatriK')).toHaveAttribute('aria-pressed', 'true')
        await expect.poll(muted).toEqual([true, true, false])
        await page.keyboard.press('0')

        await page.keyboard.press('m')
        await expect.poll(muted).toEqual([true, true, true])
        await page.keyboard.press('m')
        await expect.poll(muted).toEqual([false, true, true])
        await page.keyboard.press('m')
        await expect.poll(muted).toEqual([true, false, true])
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
        await expect(page.getByText('Solo · 2 runs')).toBeVisible()
        await expect(transport(page).getByRole('button', { name: 'Play', exact: true })).toBeVisible()

        await expect(transport(page).getByRole('button', { name: 'Fullscreen' })).toHaveCount(0)
        await page.keyboard.press('f')
        expect(await fullscreenRequested(page)).toBeNull()
    })

    test('[ and ] step through the sectors of every run', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)
        await expectAligned(page, 'PatriK')
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)
        const active = () => page.getByRole('list', { name: 'Sectors' }).getByRole('listitem')
            .evaluateAll(items => items.findIndex(item => item.classList.contains('is-active')))

        await page.keyboard.press(']')
        await expect.poll(active).toBeGreaterThanOrEqual(0)
        const first = await active()
        await page.keyboard.press(']')
        await expect.poll(active).toBe(first + 1)
        await page.keyboard.press('[')
        await expect.poll(active).toBe(first)
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
        await expect(analysis(page).getByRole('heading', { name: 'Sector Times' })).toBeVisible()
    })

    test('clicking a sector row cues every video', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)
        await expectAligned(page, 'PatriK')
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)

        await analysis(page).getByRole('button', { name: 'Cue S4' }).click()

        await expect.poll(() => rounded(page)).toEqual([3.74, 3.549])
        await expect(page.getByRole('list', { name: 'Sectors' }).getByRole('listitem').nth(3)).toHaveClass(/is-active/)
    })

    test('the gap over the run lives in the transport only, and a click on it seeks every video', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)
        await expectAligned(page, 'PatriK')
        await expect.poll(async () => (await clocksOf(page)).length).toBe(2)
        await expect(analysis(page).getByRole('heading', { name: 'Sector Times' })).toBeVisible()
        await expect(analysis(page).locator('.run-compare-cumulative')).toHaveCount(0)
        await expect(analysis(page).getByRole('heading', { name: 'Gap Over the Run' })).toHaveCount(0)

        const chart = transport(page).locator('.run-compare-gap-plot')
        await chart.scrollIntoViewIfNeeded()
        const box = (await chart.boundingBox())!
        await chart.click({ position: { x: box.width / 2, y: box.height / 2 } })

        await expect.poll(async () => Math.min(...(await clocksOf(page)).map(clock => clock.time))).toBeGreaterThan(1)
        await expect(transport(page).getByRole('slider', { name: 'Timeline' })).not.toHaveAttribute('aria-valuetext', /^00:00.000/)
    })

    test('hovering the speed chart reads out both runs\' speed at that moment', async ({ page, isMobile }) => {
        test.skip(isMobile, 'the readout follows a mouse')
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)
        await expectAligned(page, 'PatriK')
        const plot = analysis(page).locator('.run-compare-speed-plot')
        await plot.scrollIntoViewIfNeeded()
        const readout = plot.locator('g[data-readout]')
        await expect(readout).toHaveCount(0)

        const box = (await plot.boundingBox())!
        await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.45)

        await expect(readout).toHaveCount(1)
        await expect(readout).toContainText('PatriK')
        await expect(readout).toContainText('Arturek')
        await expect(readout).toContainText('Difference')
        await expect(readout).toContainText('UU/s')

        await page.mouse.move(box.x + box.width * 0.4, box.y - 60)
        await expect(readout).toHaveCount(0)
    })

    test('the baseline row in Sector Times carries no per-sector numbers or note', async ({ page, isMobile }) => {
        test.skip(isMobile, 'phones show the table as cards')
        await mockApi(page, { videos: [PATRIK, ARTUREK], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${PATRIK},${ARTUREK}`)
        await expectAligned(page, 'PatriK')
        const panel = analysis(page).getByRole('region', { name: 'Sector Times' })
        await expect(panel).toBeVisible()
        await expect(panel).not.toContainText('Sectors are')
        await expect(panel).not.toContainText('Each sector is')
        const baseline = panel.locator('tr.is-baseline')
        await expect(baseline).toHaveCount(1)
        await expect(baseline).toContainText('Arturek')
        await expect(baseline.locator('.run-compare-sector-gap, .run-compare-sector-time')).toHaveCount(0)
    })

    test('choosing a run for speed highlights its tile', async ({ page }) => {
        await mockApi(page, { videos: [PATRIK, ARTUREK, DECL], comparisons: { [PATRIK]: 'short' } })
        await page.goto(`/compare?runs=${ARTUREK},${PATRIK},${DECL}`)
        await expectAligned(page, 'PatriK')
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
        await expect(analysis(page).getByRole('heading', { name: 'Sector Times' })).toBeVisible()

        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
        for (const panel of await analysis(page).locator('.run-compare-panel').all()) {
            expect(await panel.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
        }
        for (const table of await analysis(page).locator('table').all()) {
            expect(await table.evaluate(element => element.getBoundingClientRect().right)).toBeLessThanOrEqual(390)
        }
    })
})

function teamHeaders(page: Page): Locator {
    return page.getByRole('region', { name: 'Stage' }).locator('.run-compare-team-header')
}

function zoneCues(page: Page): Promise<string[]> {
    return page.getByRole('list', { name: 'Zones' }).getByRole('listitem').evaluateAll(items => items.map(item => {
        const name = item.querySelector('[aria-label]')?.getAttribute('aria-label') ?? item.textContent ?? ''
        return /Zone \S+/.exec(name)?.[0] ?? name
    }))
}

test.describe('team runs', () => {
    test('a single team run plays its members in one row on one clock, with every member crossing on the timeline', async ({ page }) => {
        await mockApi(page, { videos: TEAM_POVS })
        await mockTeamRuns(page, [ALPHA, BRAVO])
        await page.goto(`/compare?runs=${ALPHA.teamCapId}`)

        const [one, two] = [tile(page, 'Alpha One'), tile(page, 'Alpha Two')]
        await expect(one.locator('video')).toHaveCount(1)
        await expect(two.locator('video')).toHaveCount(1)
        await expect(teamHeaders(page)).toHaveCount(1)
        await expect(teamHeaders(page)).toContainText('Alpha One & Alpha Two')
        await expect(teamHeaders(page)).toContainText('00:13.500')
        await expect(teamHeaders(page)).toContainText('Baseline')
        const [left, right] = [await one.boundingBox(), await two.boundingBox()]
        expect(right!.y).toBeCloseTo(left!.y, 0)
        expect(right!.x).toBeGreaterThanOrEqual(left!.x + left!.width)
        await expect(page).toHaveTitle(/^Alpha One & Alpha Two on /)
        await expect(drawer(page)).toHaveCount(0)

        await expect.poll(() => zoneCues(page)).toEqual(['Zone Gate', 'Zone Crane'])
        await expect(lanes(page)).toHaveCount(0)
        await expect(one).toContainText('Checkpoints only')
        await expect(two).not.toContainText('Checkpoints only')
        await expect(page.getByRole('region', { name: 'Stage' }).locator('.run-compare-gap-value')).toHaveCount(0)

        await playButton(page).click()

        await expect.poll(async () => Math.min(...(await clocksOf(page)).map(clock => clock.time)), { timeout: 15_000 }).toBeGreaterThan(1)
        const clocks = await clocksOf(page)
        expect(clocks.map(clock => clock.paused)).toEqual([false, false])
        expect(Math.abs(clocks[0].time - clocks[1].time)).toBeLessThan(0.1)
    })

    test('adding a second team run from the drawer adds a row, and a member POV hides from the roster', async ({ page }) => {
        await mockApi(page, { videos: TEAM_POVS })
        await mockTeamRuns(page, [ALPHA, BRAVO])
        await page.goto(`/compare?runs=${ALPHA.teamCapId}`)
        await expect(tile(page, 'Alpha One').locator('video')).toHaveCount(1)

        await runsButton(page).click()
        await expect(drawer(page)).toBeVisible()
        const lengthBefore = await historyLength(page)
        const bravo = leaderboard(page).locator(':scope > li').filter({ hasText: 'Bravo One' })
        const members = bravo.getByRole('list', { name: 'Members' }).getByRole('listitem')
        await expect(members).toHaveCount(2)
        await expect(members.first()).toContainText('Checkpoints only')
        await expect(members.nth(1)).toContainText('Final time only')
        await expect(members.first()).not.toContainText('Red')
        await expect(drawer(page).getByRole('group', { name: 'Side' })).toHaveCount(0)
        await bravo.getByRole('button', { name: 'Add Bravo One & Bravo Two' }).click()

        await expect(teamHeaders(page)).toHaveCount(2)
        await expect(tile(page, 'Bravo Two').locator('video')).toHaveCount(1)
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${ALPHA.teamCapId},${BRAVO.teamCapId}`)
        expect(await historyLength(page)).toBe(lengthBefore)
        await expect.poll(async () => {
            const [alpha, bravoTile] = await Promise.all(['Alpha One', 'Bravo One'].map(async alias => (await tile(page, alias).boundingBox())!))
            return { below: bravoTile.y > alpha.y + alpha.height - 1, offset: Math.round(Math.abs(bravoTile.x - alpha.x)) }
        }).toEqual({ below: true, offset: 0 })
        await expect(page).toHaveTitle(/^Alpha One & Alpha Two vs Bravo One & Bravo Two on /)

        const roster = drawer(page).getByRole('list', { name: 'Roster' })
        await expect(roster.locator(':scope > li')).toHaveCount(2)
        await expect(drawer(page)).toContainText('2 of 4 team runs')
        const bravoTwo = roster.getByRole('list', { name: 'Members' }).getByRole('listitem').filter({ hasText: 'Bravo Two' })
        await chooseFromMenu(bravoTwo, 'Bravo Two', 'Hide Video, Keep the Graph')

        await expect(tile(page, 'Bravo Two')).toHaveCount(0)
        const menu = await openMenu(bravoTwo, 'Bravo Two')
        await expect(menu.getByRole('menuitem', { name: 'Show Video' })).toBeVisible()
        await page.keyboard.press('Escape')
        await expect.poll(() => new URL(page.url()).search).toBe(`?runs=${ALPHA.teamCapId},${BRAVO.teamCapId}&data=${BRAVO.members[1].capId}`)
    })
})

const TEAM_ALIGNED = runCompareFixture('teamAligned')
const ALIGNED_RUNNER = teamFixtureOf(TEAM_ALIGNED.runner)
const ALIGNED_REFERENCE = teamFixtureOf(TEAM_ALIGNED.reference)
const ALIGNED_POVS = [ALIGNED_RUNNER, ALIGNED_REFERENCE].flatMap(team => team.members.map(member => member.capId))
const ALIGNED_URL = `/compare?runs=${ALIGNED_RUNNER.teamCapId},${ALIGNED_REFERENCE.teamCapId}&ref=${ALIGNED_REFERENCE.teamCapId}`

function teamSplits(page: Page): Locator {
    return page.getByRole('region', { name: 'Team Splits' })
}

function splitRows(page: Page): Locator {
    return teamSplits(page).getByRole('button', { name: /^(Cue .+|Seek to the cap)$/ })
}

async function openAligned(page: Page, teamReads: string[] = []) {
    await mockApi(page, { videos: ALIGNED_POVS, comparisons: Object.fromEntries(ALIGNED_RUNNER.members.map(member => [member.capId, 'short' as const])) })
    await mockTeamRuns(page, [ALIGNED_RUNNER, ALIGNED_REFERENCE], { videos: ALIGNED_POVS })
    await mockTeamComparisons(page, [TEAM_ALIGNED], teamReads)
    await page.goto(ALIGNED_URL)
    for (const alias of ['fierd_6', 'Nightwolf`', 'gxls', '[UTW]Nettlez']) await expect(tile(page, alias).locator('video')).toHaveCount(1)
}

test.describe('team vs team', () => {
    test('a 2v2 opened by its link lines its members up by route in a 2×2 grid, whatever their finish order', async ({ page, isMobile }) => {
        test.skip(isMobile, 'the grid of rows is the wide layout')
        const teamReads: string[] = []
        await openAligned(page, teamReads)

        await expect(teamHeaders(page)).toHaveCount(2)
        await expect(tile(page, 'Nightwolf`').locator('.run-compare-team-index')).toHaveText('Role 1')
        await expect(tile(page, 'fierd_6').locator('.run-compare-team-index')).toHaveText('Role 2')
        const [nightwolf, fierd, gxls, nettlez] = await Promise.all(['Nightwolf`', 'fierd_6', 'gxls', '[UTW]Nettlez'].map(async alias => (await tile(page, alias).boundingBox())!))
        expect(nightwolf.x).toBeCloseTo(gxls.x, 0)
        expect(fierd.x).toBeCloseTo(nettlez.x, 0)
        expect(nettlez.x).toBeGreaterThan(gxls.x + gxls.width - 1)
        expect(nightwolf.y).toBeCloseTo(fierd.y, 0)
        expect(gxls.y).toBeCloseTo(nettlez.y, 0)
        expect(gxls.y).toBeGreaterThan(nightwolf.y + nightwolf.height - 1)
        expect(teamReads).toEqual([`${ALIGNED_RUNNER.teamCapId}:${ALIGNED_REFERENCE.teamCapId}`])

        await expect(lanes(page).locator(':scope > li')).toHaveCount(2)
        await expect(tile(page, 'Nightwolf`').locator('.run-compare-gap-value')).toHaveCount(1)
        await expect(tile(page, 'Nightwolf`')).toContainText('vs gxls')
        await expect(tile(page, 'gxls').locator('.run-compare-gap-value')).toHaveCount(0)
        const [header, firstTile] = await Promise.all([teamHeaders(page).first().boundingBox(), tile(page, 'Nightwolf`').boundingBox()])
        expect(header!.x + header!.width).toBeLessThanOrEqual(firstTile!.x + 1)
        expect(header!.y).toBeCloseTo(firstTile!.y, 0)
        await expect(teamHeaders(page).filter({ hasText: 'Baseline' })).toHaveCount(1)
        await expect(teamHeaders(page).first()).not.toContainText('Baseline')
        expect(new URL(page.url()).search).toBe(new URL(ALIGNED_URL, page.url()).search)
    })

    test('the analysis lists the team splits, then a member pair list linking each pair to its own comparison, and a split row cues each team to its own crossing', async ({ page }) => {
        await openAligned(page)

        await expect(splitRows(page)).toHaveText(['Zone Bridge', 'Zone Ramp', 'Zone Lift', 'Zone Pit', 'Zone Flag', 'Finish'])
        const flag = teamSplits(page).getByRole('row').filter({ has: page.getByRole('button', { name: 'Cue Flag' }) })
        await expect(flag).toContainText('01:18.433')
        await expect(flag).toContainText('−0.517')
        await expect(flag).toContainText('fierd_6')
        const pairs = page.getByRole('list', { name: 'Member Pairs' }).getByRole('listitem')
        await expect(pairs).toHaveCount(2)
        await expect(pairs.nth(0)).toContainText('Nightwolf`')
        await expect(pairs.nth(0)).toContainText('gxls')
        await expect(pairs.nth(1)).toContainText('fierd_6')
        await expect(pairs.nth(1)).toContainText('[UTW]Nettlez')
        await expect(pairs.nth(0).getByRole('link', { name: 'Compare Pair' })).toHaveAttribute('href', /\/compare\?runs=/)
        await expect(page.getByRole('region', { name: 'Nightwolf` vs gxls' })).toHaveCount(0)

        await teamSplits(page).getByRole('button', { name: 'Cue Bridge' }).click()

        await expect.poll(async () => (await Promise.all(['fierd_6', 'Nightwolf`'].map(async alias => (await clockOf(tile(page, alias))).time))).map(time => time.toFixed(1))).toEqual(['12.2', '12.2'])
        const reference = await Promise.all(['gxls', '[UTW]Nettlez'].map(async alias => (await clockOf(tile(page, alias))).time))
        reference.forEach(time => expect(time).toBeCloseTo(12.517, 1))
        await expect.poll(() => page.getByRole('list', { name: 'Zones' }).locator('.run-compare-cue.is-active')
            .evaluateAll(items => items.map(item => item.querySelector('button')?.getAttribute('aria-label') ?? item.textContent ?? ''))).toEqual([expect.stringContaining('Zone Bridge')])
    })

    test('a team read that fails leaves that team run on final time only', async ({ page }) => {
        await mockApi(page, { videos: ALIGNED_POVS })
        await mockTeamRuns(page, [ALIGNED_RUNNER, ALIGNED_REFERENCE], { videos: ALIGNED_POVS })
        await mockTeamComparisons(page, [])
        await page.goto(ALIGNED_URL)

        await expect(tile(page, 'fierd_6').locator('video')).toHaveCount(1)
        await expect(tile(page, 'fierd_6')).toContainText('Final time only')
        await expect(splitRows(page)).toHaveText(['Finish'])
    })
})

test.describe('pairing override and driving pair', () => {
    const [FIERD_6, NIGHTWOLF] = ALIGNED_RUNNER.members.map(member => member.capId)
    const [GXLS, NETTLEZ] = ALIGNED_REFERENCE.members.map(member => member.capId)

    async function xOf(page: Page, alias: string): Promise<number> {
        return (await tile(page, alias).boundingBox())!.x
    }

    function memberRow(page: Page, alias: string): Locator {
        return drawer(page).getByRole('list', { name: 'Members' }).getByRole('listitem').filter({ hasText: alias })
    }

    test('overriding a pair moves the tiles into the new columns, writes pair in place, and survives a reload', async ({ page, isMobile }) => {
        test.skip(isMobile, 'the grid of rows is the wide layout')
        await openAligned(page)
        const lengthBefore = await historyLength(page)

        const menu = await openMenu(tile(page, 'fierd_6'), 'fierd_6')
        await expect(menu.getByText('Compare fierd_6 With')).toBeVisible()
        await expect(menu.getByRole('menuitemradio')).toHaveCount(2)
        await expect(menu.getByRole('menuitemradio', { name: /Nettlez/ })).toHaveAttribute('aria-checked', 'true')
        await expect(menu.getByRole('menuitemradio', { name: /Nettlez/ })).toContainText('route match 95 %')
        await expect(menu.getByRole('menuitemradio', { name: /gxls/ })).toContainText('route match 39 %')
        await menu.getByRole('menuitemradio', { name: /gxls/ }).click()

        const paired = `${ALIGNED_URL.slice('/compare'.length)}&pair=${FIERD_6}:${GXLS},${NIGHTWOLF}:${NETTLEZ}`
        await expect.poll(() => new URL(page.url()).search).toBe(paired)
        expect(await historyLength(page)).toBe(lengthBefore)
        await expect.poll(async () => Math.round(await xOf(page, 'fierd_6')) - Math.round(await xOf(page, 'gxls'))).toBe(0)
        await expect.poll(async () => Math.round(await xOf(page, 'Nightwolf`')) - Math.round(await xOf(page, '[UTW]Nettlez'))).toBe(0)
        await expect(tile(page, 'fierd_6')).toContainText('Different route')

        await page.reload()
        for (const alias of ['fierd_6', 'Nightwolf`', 'gxls', '[UTW]Nettlez']) await expect(tile(page, alias).locator('video')).toHaveCount(1)
        expect(new URL(page.url()).search).toBe(paired)
        await expect.poll(async () => Math.round(await xOf(page, 'fierd_6')) - Math.round(await xOf(page, 'gxls'))).toBe(0)
        const again = await openMenu(tile(page, 'gxls'), 'gxls')
        await expect(again.getByRole('menuitemradio', { name: /fierd_6/ })).toHaveAttribute('aria-checked', 'true')
    })

    test('Shift+1 focuses the first team row', async ({ page, isMobile }) => {
        test.skip(isMobile, 'focus is a layout of the wide grid')
        await openAligned(page)

        await page.keyboard.press('Shift+Digit1')

        await expect.poll(async () => (await tile(page, 'fierd_6').boundingBox())!.width).toBeGreaterThan((await tile(page, 'gxls').boundingBox())!.width * 1.5)
        const [fierd, nightwolf, gxls] = await Promise.all(['fierd_6', 'Nightwolf`', 'gxls'].map(async alias => (await tile(page, alias).boundingBox())!))
        expect(nightwolf.width).toBeCloseTo(fierd.width, 0)
        expect(gxls.x).toBeGreaterThan(fierd.x + fierd.width - 1)

        await page.keyboard.press('Shift+Digit2')
        await expect.poll(async () => (await tile(page, 'gxls').boundingBox())!.width).toBeGreaterThan((await tile(page, 'fierd_6').boundingBox())!.width * 1.5)
        await expect(soundButton(tile(page, 'gxls'), 'gxls')).toHaveAttribute('aria-pressed', 'true')

        await page.keyboard.press('0')
        await expect.poll(async () => Math.round((await tile(page, 'fierd_6').boundingBox())!.width)).toBe(Math.round((await tile(page, 'gxls').boundingBox())!.width))
    })

    test('with Same Spot on, the roster offers the leading pair and writes drive in place', async ({ page }) => {
        await openAligned(page)
        await syncButton(page, 'Same Spot').click()
        await runsButton(page).click()

        const leads = (menu: Locator) => menu.getByRole('menuitemcheckbox', { name: 'Leads Same Spot Sync' })
        await expect(leads(await openMenu(memberRow(page, 'fierd_6'), 'fierd_6'))).toHaveAttribute('aria-checked', 'true')
        await page.keyboard.press('Escape')
        await expect(leads(await openMenu(memberRow(page, 'gxls'), 'gxls'))).toHaveCount(0)
        await page.keyboard.press('Escape')
        await leads(await openMenu(memberRow(page, 'Nightwolf`'), 'Nightwolf`')).click()

        await expect.poll(() => new URL(page.url()).search).toBe(`${ALIGNED_URL.slice('/compare'.length)}&drive=${NIGHTWOLF}&sync=position`)
        await expect(leads(await openMenu(memberRow(page, 'Nightwolf`'), 'Nightwolf`'))).toHaveAttribute('aria-checked', 'true')
        await page.keyboard.press('Escape')
        await expect((await openMenu(memberRow(page, 'fierd_6'), 'fierd_6')).getByText('Compare fierd_6 With')).toBeVisible()
    })
})
