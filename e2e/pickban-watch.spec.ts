import { expect, test, type Page } from '@playwright/test'
import type { PickBanState } from '../app/utils/api'
import {
    ELIGIBLE_MAPS,
    INTRO_MS,
    LEAD_MS,
    T0,
    asSpectator,
    iso,
    locked,
    lockedInTurn,
    paused,
    pickBanState,
    readAt,
    resumed,
    started,
    undone,
} from '../app/components/pages/events/pickban/pickBanFixtures'

const SLUG = 'watch-cup'
const MATCH = 'match-1'
const PAGE_PATH = `/events/${SLUG}/matches/${MATCH}`
const [ALPHA, BRAVO, CHARLIE, DELTA, ECHO, FOXTROT] = ELIGIBLE_MAPS
const INTRO_START = T0 + LEAD_MS
const INTRO_END = INTRO_START + INTRO_MS
const FIRST_LOCK = INTRO_END + 10_000
const HOLD_MS = 600_000
const STAGE_WIDTHS = [360, 1024, 1440, 1920, 2240, 2560, 3840]
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

const stage = (page: Page) => page.getByLabel('Picks & Bans Stage')

function revealOf(state: PickBanState, index: number): number {
    return Date.parse(state.plan[index].reveal_at!)
}

function held(state: PickBanState): PickBanState {
    const reveals = state.plan.flatMap(step => (step.reveal_at ? [Date.parse(step.reveal_at)] : []))
    const seconds = HOLD_MS / 1000
    return {
        ...state,
        pacing: { intro: seconds, spotlight: seconds, ban_down_spotlight: seconds, decider_spotlight: seconds },
        spotlight_ends_at: reveals.length > 0 ? iso(Math.max(...reveals) + HOLD_MS) : state.spotlight_ends_at,
    }
}

async function stageFit(page: Page) {
    return page.evaluate(() => {
        const section = document.querySelector('section[aria-label="Picks & Bans Stage"]') as HTMLElement
        const box = section.getBoundingClientRect()
        const style = getComputedStyle(section)
        const inner = {
            top: box.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop),
            bottom: box.bottom - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingBottom),
            left: box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft),
            right: box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight),
        }
        const escaped = Array.from(section.querySelectorAll<HTMLElement>('*'))
            .filter(element => !element.closest('.sr-only') && !element.matches('.inset-0'))
            .filter(element => {
                const rect = element.getBoundingClientRect()
                if (rect.width === 0 || rect.height === 0) return false
                return rect.top < inner.top - 1 || rect.bottom > inner.bottom + 1 || rect.left < inner.left - 1 || rect.right > inner.right + 1
            })
            .map(element => `${element.tagName.toLowerCase()} "${(element.textContent ?? '').slice(0, 40)}"`)
        return { height: Math.round(box.height), escaped }
    })
}

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

    await expect(page.getByRole('link', { name: /Back to Bracket/ })).toHaveAttribute('href', `/events/${SLUG}?tab=bracket`)
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
            () => (document.querySelector('section[aria-label="Picks & Bans Stage"]')?.textContent?.includes('BANNED') ? Date.now() : 0),
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

test('the centre stage keeps one height per width and fits every state inside it', async ({ page, isMobile }) => {
    test.skip(isMobile)
    test.setTimeout(180_000)

    const firstBan = held(locked(started(), ALPHA, FIRST_LOCK))
    const firstPick = held(lockedInTurn(started(), [ALPHA, BRAVO, CHARLIE]))
    const decider = held(lockedInTurn(started(), [ALPHA, BRAVO, CHARLIE, DELTA, ECHO, FOXTROT]))
    const scenarios: { name: string; state: PickBanState; at: number; expectText: RegExp }[] = [
        { name: 'lobby', state: pickBanState(), at: T0 - 60_000, expectText: /Waiting for an admin to start/ },
        {
            name: 'intro',
            state: { ...held(started()), intro_ends_at: iso(INTRO_START + HOLD_MS) },
            at: INTRO_START + 1_000,
            expectText: /Starting/,
        },
        {
            name: 'awaiting',
            state: { ...readAt(started(), INTRO_END + 1_000), selection_preview: { side: 'team_a', map: ALPHA, at: iso(INTRO_END + 500) } },
            at: INTRO_END + 1_000,
            expectText: /considering this map/,
        },
        { name: 'ban reveal', state: firstBan, at: revealOf(firstBan, 0) + 1_000, expectText: /BANNED/ },
        { name: 'pick reveal', state: firstPick, at: revealOf(firstPick, 2) + 1_000, expectText: /Picked by/ },
        { name: 'decider reveal', state: decider, at: revealOf(decider, 6) + 1_000, expectText: /Left by both teams/ },
        { name: 'paused', state: paused(firstBan, revealOf(firstBan, 0) + 1_000), at: revealOf(firstBan, 0) + 5_000, expectText: /Session paused/ },
        {
            name: 'summary',
            state: lockedInTurn(started(), [ALPHA, BRAVO, CHARLIE, DELTA, ECHO, FOXTROT]),
            at: T0 + 3_600_000,
            expectText: /Maps in play order/,
        },
        {
            name: 'cancelled',
            state: pickBanState({
                status: 'cancelled',
                phase: 'cancelled',
                end_reason: 'Match postponed.',
                warnings: ['Results were already entered, so the map slots were left alone.'],
            }),
            at: T0,
            expectText: /Match postponed/,
        },
    ]

    const heights = new Map<number, Map<string, number>>()
    for (const scenario of scenarios) {
        await page.unrouteAll()
        await serve(page, fakeServer(scenario.at, () => scenario.state))
        await page.setViewportSize({ width: STAGE_WIDTHS[0], height: 1_100 })
        await page.goto(PAGE_PATH)
        await expect(stage(page)).toContainText(scenario.expectText)

        for (const width of STAGE_WIDTHS) {
            await page.setViewportSize({ width, height: 1_100 })
            await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
            const fit = await stageFit(page)
            expect(fit.escaped, `${scenario.name} at ${width}px`).toEqual([])
            expect(await horizontalOverflow(page), `${scenario.name} at ${width}px`).toBeLessThanOrEqual(1)
            heights.set(width, (heights.get(width) ?? new Map()).set(scenario.name, fit.height))
        }
    }

    for (const [width, byScenario] of heights) {
        expect(new Set(byScenario.values()).size, `stage heights at ${width}px: ${JSON.stringify([...byScenario])}`).toBe(1)
    }
})

test('the countdown bar glides, and steps once a second with reduced motion on', async ({ page, isMobile }) => {
    test.skip(isMobile)

    const intro = { ...held(started()), intro_ends_at: iso(INTRO_START + HOLD_MS) }
    const barPositions = () => page.evaluate(() => new Promise<number>(resolve => {
        const bar = document.querySelector('section[aria-label="Picks & Bans Stage"] .origin-left') as HTMLElement
        const seen = new Set<string>()
        const startedAt = performance.now()
        const sample = () => {
            seen.add(bar.style.transform)
            if (performance.now() - startedAt < 2_500) requestAnimationFrame(sample)
            else resolve(seen.size)
        }
        requestAnimationFrame(sample)
    }))

    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
        await page.emulateMedia({ reducedMotion })
        await page.unrouteAll()
        await serve(page, fakeServer(INTRO_START + 1_000, () => intro))
        await page.goto(PAGE_PATH)
        await expect(stage(page)).toContainText(/Starting/)

        const positions = await barPositions()
        if (reducedMotion === 'reduce') expect(positions).toBeLessThanOrEqual(4)
        else expect(positions).toBeGreaterThan(20)
    }
})

function sampleStageOpacity(page: Page, part: 'reveal' | 'paused', durationMs: number) {
    return page.evaluate(([part, durationMs]) => new Promise<number[]>(resolve => {
        const seen: number[] = []
        const startedAt = performance.now()
        const sample = () => {
            const element = document.querySelector<HTMLElement>(`section[aria-label="Picks & Bans Stage"] [data-stage-part="${part}"]`)
            if (element) seen.push(Number(getComputedStyle(element).opacity))
            if (performance.now() - startedAt < durationMs) setTimeout(sample, 4)
            else resolve(seen)
        }
        sample()
    }), [part, durationMs] as const)
}

function midway(opacities: number[]): number[] {
    return opacities.filter(opacity => opacity > 0.05 && opacity < 0.95)
}

test('an undo plays the reveal backwards, and is instant with reduced motion', async ({ page, isMobile }) => {
    test.skip(isMobile)

    const revealed = held(locked(started(), ALPHA, FIRST_LOCK))
    const reveal = revealOf(revealed, 0)
    const afterUndo = undone(revealed, reveal + 1_000)

    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
        let undoServed = false
        await page.emulateMedia({ reducedMotion })
        await page.unrouteAll()
        await serve(page, fakeServer(reveal + 1_000, () => (undoServed ? afterUndo : revealed)))
        await page.goto(PAGE_PATH)
        await expect(stage(page)).toContainText('BANNED')

        const sampling = sampleStageOpacity(page, 'reveal', 4_000)
        undoServed = true
        const opacities = await sampling

        await expect(stage(page)).toContainText(/Waiting for Crimson Cats to lock in/)
        await expect(stage(page)).not.toContainText('BANNED')
        if (reducedMotion === 'reduce') expect(midway(opacities), reducedMotion).toEqual([])
        else expect(midway(opacities).length, reducedMotion).toBeGreaterThan(2)
    }
})

test('the paused overlay fades in and out, and is instant with reduced motion', async ({ page, isMobile }) => {
    test.skip(isMobile)

    const revealed = held(locked(started(), ALPHA, FIRST_LOCK))
    const reveal = revealOf(revealed, 0)
    const pausedState = paused(revealed, reveal + 1_000)
    const resumedState = resumed(pausedState, reveal + 1_000)

    for (const reducedMotion of ['no-preference', 'reduce'] as const) {
        let served: PickBanState = revealed
        await page.emulateMedia({ reducedMotion })
        await page.unrouteAll()
        await serve(page, fakeServer(reveal + 1_000, () => served))
        await page.goto(PAGE_PATH)
        await expect(stage(page)).toContainText('BANNED')

        const fadingIn = sampleStageOpacity(page, 'paused', 2_500)
        served = pausedState
        const fadeIn = await fadingIn
        await expect(stage(page)).toContainText('Session paused')

        const fadingOut = sampleStageOpacity(page, 'paused', 2_500)
        served = resumedState
        const fadeOut = await fadingOut
        await expect(stage(page)).not.toContainText('Session paused')
        await expect(stage(page)).toContainText('BANNED')

        if (reducedMotion === 'reduce') {
            expect([...midway(fadeIn), ...midway(fadeOut)], reducedMotion).toEqual([])
        } else {
            expect(midway(fadeIn).length, `${reducedMotion} fade in`).toBeGreaterThan(2)
            expect(midway(fadeOut).length, `${reducedMotion} fade out`).toBeGreaterThan(2)
        }
    }
})

test('polls, including 304s and a warning arriving mid-session, never remount, flash or shift the page', async ({ page, isMobile }) => {
    test.skip(isMobile)

    const lobby = pickBanState()
    const flipped = {
        ...lobby,
        version: lobby.version + 1,
        teams: {
            ...lobby.teams,
            team_b: { ...lobby.teams.team_b!, members: lobby.teams.team_b!.members.map((m, i) => (i === 1 ? { ...m, online: false } : m)) },
        },
        warnings: ['Results were already entered, so the map slots were left alone.'],
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
            stage: box('section[aria-label="Picks & Bans Stage"]'),
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
    await expect(page.getByText('Results were already entered')).toBeVisible()

    const after = await probe()
    expect(after.cardProbe).toBe('kept')
    expect(after.memberProbe).toBe('kept')
    expect(after.stage).toEqual(before.stage)
    expect(after.busy).toBe(0)
})
