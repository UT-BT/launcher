import { expect, test, type Locator, type Page } from '@playwright/test'
import { runCompareFixture } from '../app/utils/fixtures/runCompareFixtures'
import { displayMapName } from '../app/utils/format'
import type { CapDetail } from '../app/utils/api'
import { replayVideoUrl, serveReplayVideos } from './replayVideos'

const AVATAR = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64')
const BASE = runCompareFixture('capDetailCandidates')
const MAP = BASE.cap.map
const FIERD = 'a1a1a1a1-0000-4000-8000-0000000000a1'
const BUN = 'b2b2b2b2-0000-4000-8000-0000000000b2'
const DECL = 'd4d4d4d4-0000-4000-8000-0000000000d4'
const SHX = 'e5e5e5e5-0000-4000-8000-0000000000e5'

function detailFor(id: string, user: string, alias: string, seconds: number, team: number): CapDetail {
    return {
        ...BASE,
        cap: { ...BASE.cap, id, user, alias, cap_time_seconds: seconds, team, active_title: null, disallowed: false },
        compare_candidates: [],
    }
}

const DETAILS = new Map<string, CapDetail>([
    [FIERD, detailFor(FIERD, '700000000000000001', 'fierd_6', 81.234, 0)],
    [BUN, detailFor(BUN, '700000000000000002', 'Bun`', 79.5, 1)],
    [DECL, detailFor(DECL, '700000000000000004', 'Decl', 13, 0)],
    [SHX, detailFor(SHX, '700000000000000005', 'ShX', 14.25, 0)],
])

interface MockOptions {
    gate?: Promise<void>
    videos?: readonly string[]
    missingVideos?: readonly string[]
}

async function mockApi(page: Page, { gate = Promise.resolve(), videos = [], missingVideos = [] }: MockOptions = {}) {
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
                return route.fulfill({ json: { source: 'utrecorder', mp4_url: replayVideoUrl(replay[1]), view_url: null, fps: 60 } })
            }
            return route.fulfill({ json: [] })
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
