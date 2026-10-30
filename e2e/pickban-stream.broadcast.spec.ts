import { expect, test, type Page } from '@playwright/test'
import type { PickBanState } from '../app/utils/api'
import { streamSidesFixture } from '../app/utils/fixtures/streamSidesFixtures'
import type { PickBanViewState } from '../app/components/pages/events/pickban/pickBanView'
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

const LOBBY: PickBanState = asSpectator(pickBanState({
    ready: { team_a: { id: '1000', display_name: 'Ada', at: iso(LOBBY_AT - 30_000) }, team_b: null },
}))

const AWAITING: PickBanState = asSpectator({
    ...readAt(started(), AWAITING_AT),
    selection_preview: { side: 'team_a', map: ELIGIBLE_MAPS[0], at: iso(AWAITING_AT - 500) },
})

function stepZeroState(name: 'pickBanSideChoice' | 'pickBanSideSpotlight' | 'pickBanAdminSet'): PickBanViewState {
    const fixture = streamSidesFixture(name)
    return {
        ...fixture,
        match: { ...fixture.match, id: MATCH },
        viewer: { side: null, roster_captain: false },
        capabilities: { ...fixture.capabilities, acting_side: null, can_ready: false, can_choose_side: false, can_lock_now: false },
    }
}

const SIDE_CHOICE = stepZeroState('pickBanSideChoice')
const SIDE_REVEAL = stepZeroState('pickBanSideSpotlight')
const ADMIN_SET = stepZeroState('pickBanAdminSet')

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

async function serve(page: Page, state: PickBanViewState, serverTime: number): Promise<FakeApi> {
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
        return route.fulfill({ status: 200, headers, json: { success: true, data: { ...state, server_now: serverNow } } })
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

async function openStream(page: Page, state: PickBanViewState, at: number): Promise<FakeApi> {
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

test('step 0 spotlights the team choosing its side, with what each colour means', async ({ page }) => {
    await openStream(page, SIDE_CHOICE, Date.parse(SIDE_CHOICE.server_now))
    const moment = page.locator('[data-broadcast-moment="side-choice"]')
    await expect(moment.getByText('T04', { exact: true })).toBeVisible()
    await expect(moment.getByText('choose their side')).toBeVisible()
    await expect(moment.locator('[data-side-option="red"]')).toHaveText(/RED\s*Ban 1st, pick 2nd/)
    await expect(moment.locator('[data-side-option="blue"]')).toHaveText(/BLUE\s*Ban 2nd, pick 1st/)
    await expect(page.locator('[data-plate-tag]')).toHaveCount(0)
    await settle(page)

    await expect(page).toHaveScreenshot('side-choice.png')
})

test('step 0 reveals the chosen colour and tags both team plates from then on', async ({ page }) => {
    await openStream(page, SIDE_REVEAL, Date.parse(SIDE_REVEAL.server_now))
    const moment = page.locator('[data-broadcast-moment="side-reveal"]')
    await expect(moment.getByText('T04 → RED · bans first')).toBeVisible()
    await expect(page.getByRole('region', { name: 'T04' }).locator('[data-plate-tag="RED"]')).toBeVisible()
    await expect(page.getByRole('region', { name: 'T01' }).locator('[data-plate-tag="BLUE"]')).toBeVisible()
    await settle(page)

    await expect(page).toHaveScreenshot('side-reveal.png')
})

test('the intro says the sides were set by an admin when step 0 is skipped', async ({ page }) => {
    await openStream(page, ADMIN_SET, Date.parse(ADMIN_SET.intro_ends_at!) - 2_000)

    await expect(page.getByText('Sides set by admin')).toBeVisible()
    await expect(page.locator('[data-plate-tag="RED"]')).toBeVisible()
    await expect(page.locator('[data-plate-tag="BLUE"]')).toBeVisible()
})

test('the reconnecting badge keeps its look and corner', async ({ page }) => {
    const api = await openStream(page, LOBBY, LOBBY_AT)
    await expect(page.getByText('Lobby open')).toBeVisible()
    api.failFromNowOn()
    await expect(page.getByRole('status').filter({ hasText: 'reconnecting' })).toBeVisible({ timeout: 15_000 })
    await settle(page)

    await expect(page).toHaveScreenshot('reconnecting.png', { clip: BADGE_CORNER })
})
