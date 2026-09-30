import { expect, test, type Page } from '@playwright/test'
import type { PickBanState } from '../app/utils/api'
import {
    ELIGIBLE_MAPS,
    INTRO_MS,
    LEAD_MS,
    T0,
    asSpectator,
    iso,
    pickBanState,
    readAt,
    started,
} from '../app/components/pages/events/pickban/pickBanFixtures'

const SLUG = 'watch-cup'
const MATCH = 'match-1'
const EVENT_NAME = '2v2 World Cup'
const STREAM_PATH = `/events/${SLUG}/matches/${MATCH}/stream?sound=0&motion=0`
const PICK_BAN_PATH = `/tournaments/${SLUG}/matches/${MATCH}/pick-ban`
const LOBBY_AT = T0 - 60_000
const AWAITING_AT = T0 + LEAD_MS + INTRO_MS + 1_000
const BADGE_CORNER = { x: 1420, y: 960, width: 500, height: 120 }
const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-expose-headers': 'ETag, X-Server-Now',
}

const LOBBY: PickBanState = pickBanState({
    ready: { team_a: { id: '1000', display_name: 'Ada', at: iso(LOBBY_AT - 30_000) }, team_b: null },
})

const AWAITING: PickBanState = {
    ...readAt(started(), AWAITING_AT),
    selection_preview: { side: 'team_a', map: ELIGIBLE_MAPS[0], at: iso(AWAITING_AT - 500) },
}

interface FakeApi {
    failFromNowOn: () => void
}

function mapNameOf(pathname: string): string {
    return decodeURIComponent(pathname.split('/').pop() ?? '').replace(/\.\w+$/, '')
}

function screenshotSvg(mapName: string): string {
    const hue = [...mapName].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) % 360, 7)
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

async function serve(page: Page, state: PickBanState, serverTime: number): Promise<FakeApi> {
    let failing = false
    const serverNow = iso(serverTime)
    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const request = route.request()
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
        const url = new URL(request.url())
        if (url.pathname.startsWith('/screenshots/')) {
            return route.fulfill({ headers: CORS, contentType: 'image/svg+xml', body: screenshotSvg(mapNameOf(url.pathname)) })
        }
        if (url.pathname === `/tournaments/${SLUG}`) {
            return route.fulfill({ headers: CORS, json: { success: true, data: { tournament: { slug: SLUG, name: EVENT_NAME } } } })
        }
        if (url.pathname !== PICK_BAN_PATH) return route.fulfill({ headers: CORS, json: { success: true, data: [] } })
        if (failing) return route.fulfill({ status: 503, headers: CORS, json: { success: false, error: 'Unavailable' } })
        const etag = `"v${state.version}"`
        const headers = { ...CORS, etag, 'x-server-now': serverNow }
        if (request.headers()['if-none-match'] === etag) return route.fulfill({ status: 304, headers })
        return route.fulfill({ status: 200, headers, json: { success: true, data: asSpectator({ ...state, server_now: serverNow }) } })
    })
    return { failFromNowOn: () => { failing = true } }
}

async function settle(page: Page) {
    await page.waitForFunction(() => {
        const faces = [...document.fonts].filter(face => face.family.replace(/["']/g, '') === 'Barlow Condensed')
        return faces.length === 4 && faces.every(face => face.status === 'loaded')
    })
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0))
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

async function openStream(page: Page, state: PickBanState, at: number): Promise<FakeApi> {
    await page.clock.setFixedTime(at)
    const api = await serve(page, state, at)
    await page.goto(STREAM_PATH)
    await expect(page.getByText(EVENT_NAME)).toBeVisible()
    return api
}

test('the lobby broadcast keeps its look', async ({ page }) => {
    await openStream(page, LOBBY, LOBBY_AT)
    await expect(page.getByText('Lobby open')).toBeVisible()
    await expect(page.getByText('Not ready')).toBeVisible()
    await settle(page)

    await expect(page).toHaveScreenshot('lobby.png')
})

test('the team currently choosing keeps its look', async ({ page }) => {
    await openStream(page, AWAITING, AWAITING_AT)
    await expect(page.getByText('Currently choosing')).toBeVisible()
    await settle(page)

    await expect(page).toHaveScreenshot('currently-choosing.png')
})

test('the reconnecting badge keeps its look and corner', async ({ page }) => {
    const api = await openStream(page, LOBBY, LOBBY_AT)
    await expect(page.getByText('Lobby open')).toBeVisible()
    api.failFromNowOn()
    await expect(page.getByRole('status').filter({ hasText: 'reconnecting' })).toBeVisible({ timeout: 15_000 })
    await settle(page)

    await expect(page).toHaveScreenshot('reconnecting.png', { clip: BADGE_CORNER })
})
