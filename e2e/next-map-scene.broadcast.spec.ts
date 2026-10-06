import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { expect, test, type Page } from '@playwright/test'
import { STREAM_T0, streamHotState } from '../app/components/stream/data/streamFixtures'
import { ONE_PLAYED, nextMapDetails, nextMapHotState, nextMapRead } from '../app/components/stream/scenes/nextMap/nextMapFixtures'
import { expectSceneScreenshot, scenePath, serveStreamApi, SCENE_OPTIONS, SCENE_SLUG, type StreamApiSetup, type StreamFakeApi } from './streamHarness'

const VIDEO = readFileSync(resolve(__dirname, 'next-map-flythrough.webm'))
const READ_PATH = (ordinal: number) => `/tournaments/${SCENE_SLUG}/stream/matches/match-1/next-map/${ordinal}`
const NO_VIDEO = nextMapRead({ map: nextMapDetails({ video: { available: false, version: null, url: null } }) })

interface NextMapPage {
    api: StreamFakeApi
    videoRequests: () => string[]
}

async function openNextMap(page: Page, setup: StreamApiSetup & { query?: string; video?: boolean }): Promise<NextMapPage> {
    const requests: string[] = []
    await page.clock.setFixedTime(setup.at ?? STREAM_T0)
    const api = await serveStreamApi(page, setup)
    await page.route(/https:\/\/api\.utbt\.net\/videos\//, route => {
        requests.push(route.request().url())
        if (setup.video === false) return route.fulfill({ status: 404, body: '' })
        const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers()['range'] ?? '')
        const headers = { 'access-control-allow-origin': '*', 'accept-ranges': 'bytes', 'content-type': 'video/webm' }
        if (!range) return route.fulfill({ status: 200, headers, body: VIDEO })
        const start = Number(range[1])
        const end = range[2] ? Math.min(Number(range[2]), VIDEO.length - 1) : VIDEO.length - 1
        return route.fulfill({
            status: 206,
            headers: { ...headers, 'content-range': `bytes ${start}-${end}/${VIDEO.length}` },
            body: VIDEO.subarray(start, end + 1),
        })
    })
    await page.goto(scenePath('next-map', setup.query ?? SCENE_OPTIONS))
    return { api, videoRequests: () => requests }
}

async function videoState(page: Page) {
    return page.locator('[data-next-map-video]').evaluate((node: HTMLVideoElement) => ({
        muted: node.muted,
        loop: node.loop,
        preload: node.preload,
        paused: node.paused,
        readyState: node.readyState,
        currentTime: node.currentTime,
        src: node.currentSrc,
    }))
}

async function waitForFirstFrame(page: Page) {
    await expect.poll(async () => (await videoState(page)).readyState).toBeGreaterThanOrEqual(2)
}

test('the Next Map scene shows the fly-through video beside the map, its times, its cup history and the series', async ({ page }) => {
    await openNextMap(page, { hotState: nextMapHotState(ONE_PLAYED), reads: { [READ_PATH(1)]: nextMapRead() } })

    const scene = page.locator('[data-stream-scene="next-map"]')
    await expect(scene.locator('[data-next-map-state="map"]')).toHaveAttribute('data-next-map', '2')
    await expect(scene.getByText('Map 2 of 4')).toBeVisible()
    await expect(page.locator('[data-next-map-name]')).toHaveText('II-MountainBase')
    await expect(scene.getByText('by RoelerCoaster')).toBeVisible()
    await expect(page.locator('[data-next-map-pick]')).toHaveText('Picked by Azure Owls')
    await expect(page.locator('[data-next-map-panel="wr"]')).toContainText('01:37.260')
    await expect(page.locator('[data-next-map-panel="wr"]')).toContainText('Mirelle')
    await expect(page.locator('[data-pb-slot="a1"] [data-pb-gap]')).toHaveText('+4.610s')
    await expect(page.locator('[data-pb-slot="a2"] [data-pb-gap]')).toHaveText('WR')
    await expect(page.locator('[data-pb-slot="b1"]')).toContainText('Pending')
    await expect(page.locator('[data-pb-slot="b2"]')).toContainText('No time yet')
    await expect(page.locator('[data-next-map-panel="history"]')).toContainText('Played 2 times in this cup')
    await expect(page.locator('[data-next-map-panel="history"]')).toContainText('Jade Foxes')
    await expect(page.locator('[data-series-score]')).toContainText('Crimson Cats')

    await waitForFirstFrame(page)
    const video = await videoState(page)
    expect(video).toMatchObject({ muted: true, loop: true, preload: 'auto', paused: true, currentTime: 0 })
    expect(video.src).toBe(`https://api.utbt.net/videos/CTF-BT-II-MountainBase.webm?v=${encodeURIComponent('2026-09-20T09:30:00+00:00')}`)
    await expect(page.locator('[data-next-map-screenshot]')).toHaveCount(0)

    await expectSceneScreenshot(page, 'next-map-video.png')
})

test('a map with no video shows its screenshot instead', async ({ page }) => {
    const { videoRequests } = await openNextMap(page, { hotState: nextMapHotState(ONE_PLAYED), reads: { [READ_PATH(1)]: NO_VIDEO } })

    await expect(page.locator('[data-next-map-screenshot="still"]')).toBeVisible()
    await expect(page.locator('[data-next-map-video]')).toHaveCount(0)
    expect(videoRequests()).toEqual([])

    await expectSceneScreenshot(page, 'next-map-screenshot.png')
})

test('a video that fails to load falls back to the screenshot', async ({ page }) => {
    const { videoRequests } = await openNextMap(page, { hotState: nextMapHotState(ONE_PLAYED), reads: { [READ_PATH(1)]: nextMapRead() }, video: false })

    await expect(page.locator('[data-next-map-screenshot="still"]')).toBeVisible()
    await expect(page.locator('[data-next-map-video]')).toHaveCount(0)
    expect(videoRequests().length).toBeGreaterThan(0)
})

test('with motion on, the video plays on a loop and the screenshot pans', async ({ page }) => {
    const { api } = await openNextMap(page, { hotState: nextMapHotState(ONE_PLAYED), reads: { [READ_PATH(1)]: nextMapRead() }, query: 'sound=0' })

    await expect.poll(async () => (await videoState(page)).paused).toBe(false)
    expect(await videoState(page)).toMatchObject({ muted: true, loop: true })

    api.setHotState(nextMapHotState([[2, 1, 'a'], [0, 2, 'b']]))
    api.setRead(READ_PATH(2), nextMapRead({ ordinal: 2, map: nextMapDetails({ name: 'CTF-BT-II-FuriumMineCE2', picked_by: 'a', video: { available: false, version: null, url: null } }) }))
    await expect(page.locator('[data-next-map-name]')).toHaveText('II-FuriumMineCE2')
    await expect(page.locator('[data-next-map-screenshot="pan"]')).toBeVisible()
})

test('the video starts loading while the page is hidden in OBS', async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(window, 'obsstudio', { value: { pluginVersion: '30.0.0' } })
        Object.defineProperty(document, 'visibilityState', { get: () => 'hidden' })
        Object.defineProperty(document, 'hidden', { get: () => true })
    })
    const { videoRequests } = await openNextMap(page, { hotState: nextMapHotState(ONE_PLAYED), reads: { [READ_PATH(1)]: nextMapRead() }, query: 'sound=0' })

    expect(await page.evaluate(() => document.visibilityState)).toBe('hidden')
    await expect.poll(() => videoRequests().length).toBeGreaterThan(0)
    await waitForFirstFrame(page)
    expect(await videoState(page)).toMatchObject({ muted: true, loop: true, preload: 'auto' })
})

test('before pick and ban places the map, the scene says Maps to be decided and reads nothing', async ({ page }) => {
    const requested: string[] = []
    page.on('request', request => {
        if (request.url().includes('/next-map/')) requested.push(request.url())
    })
    await openNextMap(page, { hotState: nextMapHotState(ONE_PLAYED, 1) })

    await expect(page.locator('[data-next-map-state="tbd"]')).toContainText('Maps to be decided')
    await expect(page.getByText('Map 2 of 4')).toBeVisible()
    await expect(page.locator('[data-next-map-video]')).toHaveCount(0)
    expect(requested).toEqual([])

    await expectSceneScreenshot(page, 'next-map-to-be-decided.png')
})

test('once the series is decided, the scene says so instead of naming a map', async ({ page }) => {
    const decided = nextMapHotState([[2, 1, 'a'], [2, 0, 'a']])
    const match = decided.match!
    await openNextMap(page, { hotState: streamHotState({ match: { ...match, score: { ...match.score, current_map: null, winner: 'a', live_decided: true, series_state: 'won' } } }) })

    await expect(page.locator('[data-next-map-state="over"]')).toContainText('Series complete')
    await expect(page.getByText('Series 2–0 · final')).toBeVisible()
})
