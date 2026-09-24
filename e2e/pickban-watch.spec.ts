import { expect, test, type Page } from '@playwright/test'
import type { PickBanState } from '../app/utils/api'
import {
    ELIGIBLE_MAPS,
    INTRO_MS,
    LEAD_MS,
    T0,
    asSpectator,
    locked,
    lockedInTurn,
    pickBanState,
    readAt,
    started,
} from '../app/components/pages/events/pickban/pickBanFixtures'

const SLUG = 'watch-cup'
const MATCH = 'match-1'
const PAGE_PATH = `/events/${SLUG}/matches/${MATCH}`
const [ALPHA, BRAVO, CHARLIE, DELTA, ECHO, FOXTROT] = ELIGIBLE_MAPS
const INTRO_END = T0 + LEAD_MS + INTRO_MS
const FIRST_LOCK = INTRO_END + 10_000
const CORS = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-expose-headers': 'ETag, X-Server-Now',
}

interface FakeServer {
    stateAt: (serverTime: number) => PickBanState
    anchor: number
    startedAt: number
    servedFresh: number
    servedUnchanged: number
    firstServed: Map<number, number>
    authorized: boolean
}

function serverTimeOf(server: FakeServer): number {
    return server.anchor + (Date.now() - server.startedAt)
}

async function serve(page: Page, server: FakeServer) {
    await page.addInitScript(() => localStorage.setItem('utbt:analyticsConsent:v1', 'denied'))
    await page.route(/https:\/\/(api|gateway)\.utbt\.net\/.*/, async route => {
        const request = route.request()
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS })
        const url = new URL(request.url())
        if (url.pathname !== `/tournaments/${SLUG}/matches/${MATCH}/pick-ban`) {
            return route.fulfill({ headers: CORS, json: { success: true, data: [] } })
        }
        if (request.headers().authorization) server.authorized = true
        const now = serverTimeOf(server)
        const state = asSpectator({ ...server.stateAt(now), server_now: new Date(now).toISOString() })
        const etag = `"v${state.version}"`
        if (!server.firstServed.has(state.version)) server.firstServed.set(state.version, Date.now())
        const headers = { ...CORS, etag, 'x-server-now': state.server_now }
        if (request.headers()['if-none-match'] === etag) {
            server.servedUnchanged += 1
            return route.fulfill({ status: 304, headers })
        }
        server.servedFresh += 1
        return route.fulfill({ status: 200, headers, json: { success: true, data: state } })
    })
}

function fakeServer(anchor: number, stateAt: (serverTime: number) => PickBanState): FakeServer {
    return { stateAt, anchor, startedAt: Date.now(), servedFresh: 0, servedUnchanged: 0, firstServed: new Map(), authorized: false }
}

async function horizontalOverflow(page: Page): Promise<number> {
    return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
}

const stage = (page: Page) => page.getByLabel('Pick/ban stage')

test('an anonymous visitor watches the lobby, a live step and the summary at a phone width', async ({ page, isMobile }) => {
    test.skip(!isMobile)
    await page.setViewportSize({ width: 360, height: 800 })

    const scenarios: { name: string; state: PickBanState; at: number; expectText: RegExp }[] = [
        { name: 'lobby', state: pickBanState(), at: T0 - 60_000, expectText: /Waiting for an admin to start/ },
        { name: 'live', state: readAt(started(), INTRO_END + 1_000), at: INTRO_END + 1_000, expectText: /Crimson Cats/ },
        {
            name: 'complete',
            state: lockedInTurn(started(), [ALPHA, BRAVO, CHARLIE, DELTA, ECHO, FOXTROT]),
            at: T0 + 3_600_000,
            expectText: /Maps in play order/,
        },
    ]

    for (const scenario of scenarios) {
        const server = fakeServer(scenario.at, () => scenario.state)
        await page.unrouteAll()
        await serve(page, server)
        await page.goto(PAGE_PATH)

        await expect(stage(page)).toContainText(scenario.expectText)
        expect(await horizontalOverflow(page), scenario.name).toBeLessThanOrEqual(1)
        expect(server.authorized, scenario.name).toBe(false)
    }

    await expect(page.getByRole('link', { name: /Back to the bracket/ })).toHaveAttribute('href', `/events/${SLUG}?tab=bracket`)
})

test('a lock-in delivered early is revealed at its reveal_at, at the same moment on two screens', async ({ browser, isMobile }) => {
    test.skip(isMobile)

    const beforeLock = readAt(started(), FIRST_LOCK - 5_000)
    const afterLock = locked(started(), ALPHA, FIRST_LOCK)
    const server = fakeServer(FIRST_LOCK - 15_000, serverTime => (serverTime < FIRST_LOCK ? beforeLock : afterLock))
    const revealAtLocal = server.startedAt + (FIRST_LOCK + LEAD_MS - server.anchor)

    const context = await browser.newContext()
    const screens = [await context.newPage(), await context.newPage()]
    for (const screen of screens) {
        await serve(screen, server)
        await screen.goto(PAGE_PATH)
        await expect(stage(screen)).toContainText('Crimson Cats')
    }

    const revealedAt = await Promise.all(screens.map(async screen => {
        const handle = await screen.waitForFunction(
            () => (document.querySelector('section[aria-label="Pick/ban stage"]')?.textContent?.includes('BANNED') ? Date.now() : 0),
            null,
            { polling: 'raf', timeout: 30_000 },
        )
        return Number(await handle.jsonValue())
    }))

    const deliveredAt = server.firstServed.get(afterLock.version)
    expect(deliveredAt).toBeDefined()
    expect(deliveredAt!).toBeLessThan(revealAtLocal - 250)
    for (const at of revealedAt) {
        expect(at).toBeGreaterThanOrEqual(revealAtLocal - 100)
        expect(at).toBeLessThan(revealAtLocal + 400)
    }
    expect(Math.abs(revealedAt[0] - revealedAt[1])).toBeLessThan(150)

    await context.close()
})

test('polls, including 304s, never remount, flash or shift the page', async ({ page, isMobile }) => {
    test.skip(isMobile)

    const lobby = pickBanState()
    const flipped = {
        ...lobby,
        version: lobby.version + 1,
        teams: {
            ...lobby.teams,
            team_b: { ...lobby.teams.team_b!, members: lobby.teams.team_b!.members.map((m, i) => (i === 1 ? { ...m, online: false } : m)) },
        },
    }
    const server = fakeServer(T0 - 60_000, serverTime => (serverTime < T0 - 55_000 ? lobby : flipped))
    await serve(page, server)
    await page.goto(PAGE_PATH)
    await expect(stage(page)).toContainText(/Waiting for an admin to start/)

    const probe = () => page.evaluate(() => {
        const card = document.querySelector('ul li [title="CTF-BT-Alpha"]') as HTMLElement | null
        const member = document.querySelector('section[aria-label="Crimson Cats"] li') as HTMLElement | null
        const box = (selector: string) => {
            const rect = document.querySelector(selector)?.getBoundingClientRect()
            return rect ? [Math.round(rect.top), Math.round(rect.height)] : null
        }
        return {
            cardProbe: card?.dataset.probe ?? null,
            memberProbe: member?.dataset.probe ?? null,
            stage: box('section[aria-label="Pick/ban stage"]'),
            busy: document.querySelectorAll('[aria-busy="true"]').length,
        }
    })

    await page.evaluate(() => {
        const card = document.querySelector('ul li [title="CTF-BT-Alpha"]') as HTMLElement
        const member = document.querySelector('section[aria-label="Crimson Cats"] li') as HTMLElement
        card.dataset.probe = 'kept'
        member.dataset.probe = 'kept'
    })
    const before = await probe()

    await expect.poll(() => server.servedUnchanged, { timeout: 15_000 }).toBeGreaterThanOrEqual(3)
    await expect.poll(() => server.firstServed.has(flipped.version), { timeout: 15_000 }).toBe(true)
    await expect(page.getByText('1 of 2 online')).toBeVisible()

    const after = await probe()
    expect(after.cardProbe).toBe('kept')
    expect(after.memberProbe).toBe('kept')
    expect(after.stage).toEqual(before.stage)
    expect(after.busy).toBe(0)
})
