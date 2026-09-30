import { expect, type Locator, type Page, type PageScreenshotOptions } from '@playwright/test'
import type { PickBanState } from '../app/utils/api'
import type { StreamHotState } from '../app/components/stream/data/streamHotState'
import { STREAM_EVENT, STREAM_STREAMER_ID, STREAM_T0, streamIso } from '../app/components/stream/data/streamFixtures'

export const SCENE_SLUG = STREAM_EVENT.slug
export const SCENE_STREAMER = STREAM_STREAMER_ID
export const SCENE_OPTIONS = 'sound=0&motion=0'
export const TICKER_STRIP = { x: 0, y: 1016, width: 1920, height: 64 }

const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-expose-headers': 'ETag, X-Server-Now',
}

export interface StreamApiSetup {
    hotState: StreamHotState
    reads?: { [path: string]: object }
    pickBan?: { [matchId: string]: PickBanState }
    at?: number
}

export interface StreamFakeApi {
    setHotState: (state: StreamHotState) => void
    setRead: (path: string, data: object) => void
    failFromNowOn: () => void
    hotStateRequests: () => number
}

export function hotStatePath(slug = SCENE_SLUG, streamerId = SCENE_STREAMER): string {
    return `/tournaments/${slug}/stream/${streamerId}/state`
}

export function scenePath(scene: string, query = SCENE_OPTIONS, slug = SCENE_SLUG, streamerId = SCENE_STREAMER): string {
    return `/stream/${slug}/${streamerId}/${scene}${query ? `?${query}` : ''}`
}

function hueOf(text: string): number {
    return [...text].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 7)
}

function screenshotSvg(name: string): string {
    const hue = hueOf(name)
    return [
        '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640" viewBox="0 0 640 640">',
        '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
        `<stop offset="0" stop-color="hsl(${hue} 45% 40%)"/>`,
        `<stop offset="1" stop-color="hsl(${(hue + 40) % 360} 35% 14%)"/>`,
        '</linearGradient></defs>',
        '<rect width="640" height="640" fill="url(#g)"/>',
        '</svg>',
    ].join('')
}

function avatarSvg(key: string): string {
    const hue = hueOf(key)
    return `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" fill="hsl(${hue} 55% 45%)"/></svg>`
}

function lastSegment(pathname: string): string {
    return decodeURIComponent(pathname.split('/').pop() ?? '').replace(/\.\w+$/, '')
}

export async function serveStreamApi(page: Page, setup: StreamApiSetup): Promise<StreamFakeApi> {
    const serverNow = streamIso(setup.at ?? STREAM_T0)
    const reads = new Map(Object.entries(setup.reads ?? {}).map(([path, data]) => [path, { data, version: 1 }]))
    const pickBan = setup.pickBan ?? {}
    let hot = { state: setup.hotState, version: 1 }
    let failing = false
    let hotRequests = 0

    const fulfilJson = (route: Parameters<Parameters<Page['route']>[1]>[0], data: object, etag: string) => {
        const headers = { ...CORS, etag, 'x-server-now': serverNow }
        if (route.request().headers()['if-none-match'] === etag) return route.fulfill({ status: 304, headers })
        return route.fulfill({ status: 200, headers, json: { success: true, data } })
    }

    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await page.route('https://example.test/**', route =>
        route.fulfill({ contentType: 'image/svg+xml', body: avatarSvg(new URL(route.request().url()).pathname) }),
    )
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const request = route.request()
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
        const url = new URL(request.url())
        const path = url.pathname
        if (path.startsWith('/screenshots/')) {
            return route.fulfill({ headers: CORS, contentType: 'image/svg+xml', body: screenshotSvg(lastSegment(path)) })
        }
        if (path.startsWith('/users/') && path.endsWith('/avatar')) {
            return route.fulfill({ headers: CORS, contentType: 'image/svg+xml', body: avatarSvg(path) })
        }
        if (failing) return route.fulfill({ status: 503, headers: CORS, json: { success: false, error: 'Unavailable' } })
        if (path === hotStatePath()) {
            hotRequests += 1
            return fulfilJson(route, { ...hot.state, server_now: serverNow }, `"hot-${hot.version}"`)
        }
        const read = reads.get(`${path}${url.search}`) ?? reads.get(path)
        if (read) return fulfilJson(route, read.data, `"read-${read.version}"`)
        const pickBanMatch = /^\/tournaments\/[^/]+\/matches\/([^/]+)\/pick-ban$/.exec(path)
        const pickBanState = pickBanMatch ? pickBan[decodeURIComponent(pickBanMatch[1])] : undefined
        if (pickBanState) return fulfilJson(route, { ...pickBanState, server_now: serverNow }, `"v${pickBanState.version}"`)
        if (path === `/tournaments/${SCENE_SLUG}`) {
            return route.fulfill({ headers: CORS, json: { success: true, data: { tournament: { slug: SCENE_SLUG, name: setup.hotState.event.name } } } })
        }
        return route.fulfill({ status: 404, headers: CORS, json: { success: false, error: 'Not found' } })
    })

    return {
        setHotState(state) {
            hot = { state, version: hot.version + 1 }
        },
        setRead(path, data) {
            reads.set(path, { data, version: (reads.get(path)?.version ?? 0) + 1 })
        },
        failFromNowOn() {
            failing = true
        },
        hotStateRequests: () => hotRequests,
    }
}

export async function openScene(page: Page, scene: string, setup: StreamApiSetup & { query?: string }): Promise<StreamFakeApi> {
    await page.clock.setFixedTime(setup.at ?? STREAM_T0)
    const api = await serveStreamApi(page, setup)
    await page.goto(scenePath(scene, setup.query ?? SCENE_OPTIONS))
    return api
}

export async function settleScene(page: Page): Promise<void> {
    await page.waitForFunction(() => {
        const faces = [...document.fonts].filter(face => face.family.replace(/["']/g, '') === 'Barlow Condensed')
        return faces.length === 4 && faces.every(face => face.status === 'loaded')
    })
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0))
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

export function tickerMask(page: Page): Locator[] {
    return [page.locator('[data-scene-ticker]')]
}

export async function expectSceneScreenshot(page: Page, name: string, options: Pick<PageScreenshotOptions, 'omitBackground' | 'clip'> = {}): Promise<void> {
    await settleScene(page)
    await expect(page).toHaveScreenshot(name, { ...options, mask: tickerMask(page), maskColor: '#ff00ff' })
}
