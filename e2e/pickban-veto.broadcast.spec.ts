import { expect, test, type Page } from '@playwright/test'
import { pickBanVetoFixture } from '../app/utils/fixtures/pickBanVetoFixtures'
import type { PickBanViewState } from '../app/components/pages/events/pickban/pickBanView'

const SLUG = 'veto-cup'
const MATCH = 'match-1'
const EVENT_NAME = '2v2 World Cup'
const STREAM_PATH = `/events/${SLUG}/matches/${MATCH}/stream?sound=0&motion=0`
const PICK_BAN_PATH = `/tournaments/${SLUG}/matches/${MATCH}/pick-ban`
const HARD_MAPS = ['Diplopia-V4', 'FuriumMineCE2', 'InventionCE2', 'Synchronize-vF2']
const AFTER_STAMPS_MS = 2_000
const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-expose-headers': 'ETag, X-Server-Now',
}

type VetoFixtureName = 'pickBanVetoChoice' | 'pickBanVetoSpotlightVetoed' | 'pickBanVetoSpotlightPlayed' | 'pickBanSideChoiceAfterVeto'

function spectatorState(name: VetoFixtureName): PickBanViewState {
    const fixture = pickBanVetoFixture(name)
    return {
        ...fixture,
        match: { ...fixture.match, id: MATCH },
        viewer: { side: null, roster_captain: false },
        capabilities: { ...fixture.capabilities, acting_side: null, can_veto: false, can_choose_side: false, can_ready: false, can_lock_now: false },
    }
}

function afterStamps(state: PickBanViewState): number {
    return Date.parse(state.veto!.reveal_at!) + AFTER_STAMPS_MS
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

async function serve(page: Page, state: PickBanViewState, serverTime: number) {
    const serverNow = new Date(serverTime).toISOString()
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
        const etag = `"v${state.version}"`
        const headers = { ...CORS, etag, 'x-server-now': serverNow }
        if (request.headers()['if-none-match'] === etag) return route.fulfill({ status: 304, headers })
        return route.fulfill({ status: 200, headers, json: { success: true, data: { ...state, server_now: serverNow } } })
    })
}

async function settle(page: Page) {
    await page.waitForFunction(() => {
        const faces = [...document.fonts].filter(face => face.family.replace(/["']/g, '') === 'Barlow Condensed')
        return faces.length === 4 && faces.every(face => face.status === 'loaded')
    })
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0))
    await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

async function openStream(page: Page, state: PickBanViewState, at: number) {
    await page.clock.setFixedTime(at)
    await serve(page, state, at)
    await page.goto(STREAM_PATH)
    await expect(page.getByText(EVENT_NAME)).toBeVisible()
}

test('while the teams decide, the Hard cards read as pending and the caption names who is deciding', async ({ page }) => {
    const state = spectatorState('pickBanVetoChoice')
    await openStream(page, state, Date.parse(state.server_now))

    await expect(page.getByText('Hard-map veto · 13 or 9 maps')).toBeVisible()
    await expect(page.getByText('T16 are deciding on the Hard maps')).toBeVisible()
    await expect(page.getByText('Hard?', { exact: true })).toHaveCount(HARD_MAPS.length)
    await expect(page.locator('[data-broadcast-moment]')).toHaveCount(0)
})

test('the veto spotlight stamps the four Hard maps VETOED and names the team that vetoed', async ({ page }) => {
    const state = spectatorState('pickBanVetoSpotlightVetoed')
    await openStream(page, state, afterStamps(state))
    const moment = page.locator('[data-broadcast-moment="veto-reveal"]')
    await expect(moment.getByText('T15 veto the Hard maps')).toBeVisible()
    await expect(moment.getByText('9 maps in play')).toBeVisible()
    await expect(moment.getByText('Next: T15 choose their side')).toBeVisible()
    for (const map of HARD_MAPS) await expect(moment.locator(`[data-veto-map="${map}"]`).getByText('Vetoed')).toBeVisible()
    await settle(page)

    await expect(page).toHaveScreenshot('veto-vetoed.png')
})

test('the veto spotlight says the Hard maps stay in when every eligible team plays them', async ({ page }) => {
    const state = spectatorState('pickBanVetoSpotlightPlayed')
    await openStream(page, state, afterStamps(state))
    const moment = page.locator('[data-broadcast-moment="veto-reveal"]')
    await expect(moment.getByText('Hard maps stay in')).toBeVisible()
    await expect(moment.getByText('13 maps in play')).toBeVisible()
    await expect(moment.getByText('In play', { exact: true })).toHaveCount(HARD_MAPS.length)
    await expect(moment.getByText('Vetoed')).toHaveCount(0)
    await settle(page)

    await expect(page).toHaveScreenshot('veto-played.png')
})

test('after a veto, the side spotlight says why the chooser chooses and the board keeps the stamped maps', async ({ page }) => {
    const state = spectatorState('pickBanSideChoiceAfterVeto')
    await openStream(page, state, Date.parse(state.server_now))
    const moment = page.locator('[data-broadcast-moment="side-choice"]')
    await expect(moment.getByText('T15', { exact: true })).toBeVisible()
    await expect(moment.getByText('choose their side')).toBeVisible()
    await expect(moment.locator('[data-chooser-reason]')).toHaveText('T15 choose: lower group finish (4th vs 3rd)')
    await expect(page.locator('main li').getByText('Vetoed', { exact: true })).toHaveCount(HARD_MAPS.length)
    await expect(page.getByText('Diplopia-V4, vetoed by T15')).toBeAttached()
    await settle(page)

    await expect(page).toHaveScreenshot('side-choice-after-veto.png')
})
