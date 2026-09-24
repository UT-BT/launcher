import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, type PickBanState } from '@/app/utils/api'
import type { PollerEnvironment } from '@/app/utils/poller'
import {
    ACTIVE_POLL_MS,
    IDLE_POLL_MS,
    RECONNECTING_AFTER_FAILURES,
    createPickBanSessionStore,
    pickBanPollIntervalMs,
} from './pickBanSession'
import { ELIGIBLE_MAPS, T0, asCaptain, iso, locked, readAt, started, unlockAt } from './pickBanFixtures'

const LOCAL_START = T0 + 10_000
const SERVER_AHEAD = 5_000

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>

function fresh(state: PickBanState, etag: string | null = null): Response {
    return new Response(JSON.stringify({ success: true, data: state }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...(etag ? { ETag: etag } : {}) },
    })
}

function unchanged(serverNow: string | null): Response {
    return new Response(null, { status: 304, headers: serverNow ? { 'X-Server-Now': serverNow } : {} })
}

function refused(status: number, code: string): Response {
    return new Response(JSON.stringify({ success: false, error: `refused: ${code}`, code }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    })
}

function stubFetch(...handlers: Handler[]) {
    const queue = [...handlers]
    const fetchMock = vi.fn((url: string, init: RequestInit) => {
        const handler = queue.length > 1 ? queue.shift()! : queue[0]
        return Promise.resolve(handler(url, init))
    })
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

function header(fetchMock: ReturnType<typeof stubFetch>, call: number, name: string): string | undefined {
    return (fetchMock.mock.calls[call][1].headers as { [key: string]: string })[name]
}

function visibleDocument(): PollerEnvironment {
    return { isVisible: () => true, onVisibilityChange: () => () => undefined }
}

function hiddenDocument(): PollerEnvironment {
    return { isVisible: () => false, onVisibilityChange: () => () => undefined }
}

function serverNow(): string {
    return iso(Date.now() + SERVER_AHEAD)
}

function store(options: { alwaysPoll?: boolean; environment?: PollerEnvironment } = {}) {
    return createPickBanSessionStore({
        slug: 'cup',
        matchId: 'match-1',
        accessToken: () => 'token',
        environment: options.environment ?? visibleDocument(),
        alwaysPoll: options.alwaysPoll,
    })
}

function runningState(): PickBanState {
    return asCaptain(readAt(started(), unlockAt(started()) + 1_000), 'team_a')
}

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(LOCAL_START)
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('pickBanPollIntervalMs', () => {
    it('is active for lobby, running and paused sessions', () => {
        expect(pickBanPollIntervalMs('lobby', null, false)).toBe(ACTIVE_POLL_MS)
        expect(pickBanPollIntervalMs('running', null, false)).toBe(ACTIVE_POLL_MS)
        expect(pickBanPollIntervalMs('paused', null, false)).toBe(ACTIVE_POLL_MS)
    })

    it('is idle for a terminal session regardless of alwaysPoll', () => {
        expect(pickBanPollIntervalMs('complete', null, false)).toBe(IDLE_POLL_MS)
        expect(pickBanPollIntervalMs('cancelled', null, false)).toBe(IDLE_POLL_MS)
        expect(pickBanPollIntervalMs('voided', null, false)).toBe(IDLE_POLL_MS)
        expect(pickBanPollIntervalMs('complete', null, true)).toBe(IDLE_POLL_MS)
    })

    it('is idle with no session and an unreachable error, when not always-polling', () => {
        expect(pickBanPollIntervalMs(null, new ApiError(404, undefined, 'no_session'), false)).toBe(IDLE_POLL_MS)
        expect(pickBanPollIntervalMs(null, new ApiError(403, undefined, 'not_authorized'), false)).toBe(IDLE_POLL_MS)
    })

    it('stays active with no session and an unreachable error, in always-poll mode', () => {
        expect(pickBanPollIntervalMs(null, new ApiError(404, undefined, 'no_session'), true)).toBe(ACTIVE_POLL_MS)
        expect(pickBanPollIntervalMs(null, new ApiError(401, undefined, 'not_authorized'), true)).toBe(ACTIVE_POLL_MS)
    })

    it('is active with no session and no error yet, in either mode', () => {
        expect(pickBanPollIntervalMs(null, null, false)).toBe(ACTIVE_POLL_MS)
        expect(pickBanPollIntervalMs(null, null, true)).toBe(ACTIVE_POLL_MS)
    })
})

describe('polling the session state', () => {
    it('shows loading until the first answer, then the state', async () => {
        const state = { ...runningState(), server_now: serverNow() }
        stubFetch(() => fresh(state, '"v1"'))
        const session = store()

        expect(session.getSnapshot()).toMatchObject({ state: null, loading: true, reconnecting: false })
        session.start()
        await vi.advanceTimersByTimeAsync(0)

        expect(session.getSnapshot()).toMatchObject({ state, loading: false, error: null, reconnecting: false })
        session.stop()
    })

    it('keeps the previous state object when the server answers 304', async () => {
        const state = runningState()
        const fetchMock = stubFetch(() => fresh(state, '"v1"'), () => unchanged(serverNow()))
        const session = store()
        const listener = vi.fn()
        session.subscribe(listener)

        session.start()
        await vi.advanceTimersByTimeAsync(0)
        const first = session.getSnapshot().state
        await vi.advanceTimersByTimeAsync(ACTIVE_POLL_MS * 3)

        expect(fetchMock).toHaveBeenCalledTimes(4)
        expect(header(fetchMock, 0, 'If-None-Match')).toBeUndefined()
        expect(header(fetchMock, 1, 'If-None-Match')).toBe('"v1"')
        expect(header(fetchMock, 3, 'If-None-Match')).toBe('"v1"')
        expect(session.getSnapshot().state).toBe(first)
        session.stop()
    })

    it('merges a changed payload so every unchanged card, step and member keeps its identity', async () => {
        const before = runningState()
        const after = asCaptain(locked(before, ELIGIBLE_MAPS[0], unlockAt(before) + 2_000), 'team_a')
        stubFetch(() => fresh(before, '"v1"'), () => fresh(after, '"v2"'))
        const session = store()

        session.start()
        await vi.advanceTimersByTimeAsync(0)
        const first = session.getSnapshot().state!
        await vi.advanceTimersByTimeAsync(ACTIVE_POLL_MS)
        const second = session.getSnapshot().state!

        expect(second.plan[0].map).toBe(ELIGIBLE_MAPS[0])
        expect(second.plan[1]).toBe(first.plan[1])
        expect(second.pool[0]).toBe(first.pool[0])
        expect(second.teams).toBe(first.teams)
        session.stop()
    })

    it('estimates the clock offset from server_now and from the time header on a 304', async () => {
        stubFetch(
            () => fresh({ ...runningState(), server_now: serverNow() }, '"v1"'),
            () => unchanged(serverNow()),
            () => unchanged(null),
        )
        const session = store()

        session.start()
        await vi.advanceTimersByTimeAsync(0)
        expect(session.getSnapshot().clockOffsetMs).toBe(SERVER_AHEAD)
        await vi.advanceTimersByTimeAsync(ACTIVE_POLL_MS * 2)

        expect(session.getSnapshot().clockOffsetMs).toBe(SERVER_AHEAD)
        session.stop()
    })

    it('keeps the last good state through failures and only then reports reconnecting', async () => {
        const state = runningState()
        const fetchMock = stubFetch(() => fresh(state, '"v1"'), () => Promise.reject(new TypeError('Failed to fetch')))
        const session = store()

        session.start()
        await vi.advanceTimersByTimeAsync(0)
        const good = session.getSnapshot().state
        for (let failure = 1; failure < RECONNECTING_AFTER_FAILURES; failure++) {
            await vi.advanceTimersByTimeAsync(ACTIVE_POLL_MS)
            expect(session.getSnapshot()).toMatchObject({ state: good, reconnecting: false })
        }
        await vi.advanceTimersByTimeAsync(ACTIVE_POLL_MS)
        expect(session.getSnapshot()).toMatchObject({ state: good, reconnecting: true })

        fetchMock.mockImplementation(() => Promise.resolve(unchanged(serverNow())))
        await vi.advanceTimersByTimeAsync(ACTIVE_POLL_MS)
        expect(session.getSnapshot()).toMatchObject({ state: good, reconnecting: false, error: null })
        session.stop()
    })

    it('reports a first load that failed', async () => {
        stubFetch(() => refused(404, 'no_session'))
        const session = store()

        session.start()
        await vi.advanceTimersByTimeAsync(0)

        expect(session.getSnapshot()).toMatchObject({ state: null, loading: false })
        expect(session.getSnapshot().error).toBeInstanceOf(ApiError)
        session.stop()
    })

    it('polls every second while the session is live and every ten seconds once it is over', async () => {
        const live = runningState()
        const over = { ...live, status: 'complete' as const, phase: 'complete' as const, version: live.version + 1 }
        const fetchMock = stubFetch(() => fresh(live, '"v1"'), () => fresh(over, '"v2"'), () => unchanged(serverNow()))
        const session = store()

        session.start()
        await vi.advanceTimersByTimeAsync(ACTIVE_POLL_MS)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        await vi.advanceTimersByTimeAsync(IDLE_POLL_MS - 1)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        await vi.advanceTimersByTimeAsync(1)
        expect(fetchMock).toHaveBeenCalledTimes(3)
        session.stop()
    })

    it('keeps a stream view polling every second before the lobby opens, not just once running', async () => {
        const fetchMock = stubFetch(() => refused(404, 'no_session'))
        const session = store({ alwaysPoll: true })

        session.start()
        await vi.advanceTimersByTimeAsync(ACTIVE_POLL_MS * 3)

        expect(fetchMock).toHaveBeenCalledTimes(4)
        session.stop()
    })

    it('keeps polling a hidden stream view every second', async () => {
        const fetchMock = stubFetch(() => fresh(runningState(), '"v1"'), () => unchanged(serverNow()))
        const hidden = store({ environment: hiddenDocument() })
        const stream = store({ environment: hiddenDocument(), alwaysPoll: true })

        hidden.start()
        stream.start()
        await vi.advanceTimersByTimeAsync(ACTIVE_POLL_MS * 5)

        expect(fetchMock).toHaveBeenCalledTimes(1 + 6)
        hidden.stop()
        stream.stop()
    })

    it('stops polling when stopped', async () => {
        const fetchMock = stubFetch(() => fresh(runningState(), '"v1"'), () => unchanged(serverNow()))
        const session = store()

        session.start()
        await vi.advanceTimersByTimeAsync(0)
        session.stop()
        await vi.advanceTimersByTimeAsync(ACTIVE_POLL_MS * 10)

        expect(fetchMock).toHaveBeenCalledTimes(1)
        expect(fetchMock.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
    })
})

describe('commands', () => {
    it('sends the expected version and shows the returned state at once', async () => {
        const before = runningState()
        const after = asCaptain(locked(before, ELIGIBLE_MAPS[0], Date.now()), 'team_a')
        const fetchMock = stubFetch(
            () => fresh(before, '"v1"'),
            (_url, init) => (init.method === 'POST' ? fresh(after) : unchanged(serverNow())),
        )
        const session = store()
        session.start()
        await vi.advanceTimersByTimeAsync(0)

        const result = await session.sendCommand('lock', { map: ELIGIBLE_MAPS[0], plan_index: 0 })

        const [url, init] = fetchMock.mock.calls[1]
        expect(url).toMatch(/\/tournaments\/cup\/matches\/match-1\/pick-ban\/lock$/)
        expect(JSON.parse(init.body as string)).toEqual({ map: ELIGIBLE_MAPS[0], plan_index: 0, version: before.version })
        expect(session.getSnapshot().state?.version).toBe(after.version)
        expect(session.getSnapshot().state?.plan[0].map).toBe(ELIGIBLE_MAPS[0])
        expect(result).toBe(session.getSnapshot().state)
        session.stop()
    })

    it('ignores a poll that was answered before the command landed', async () => {
        const before = runningState()
        const after = asCaptain(locked(before, ELIGIBLE_MAPS[0], Date.now()), 'team_a')
        let answerSlowPoll: (response: Response) => void = () => undefined
        stubFetch(
            () => fresh(before, '"v1"'),
            () => new Promise<Response>((resolve) => { answerSlowPoll = resolve }),
            () => fresh(after),
        )
        const session = store()
        session.start()
        await vi.advanceTimersByTimeAsync(ACTIVE_POLL_MS)

        await session.sendCommand('lock', { map: ELIGIBLE_MAPS[0], plan_index: 0 })
        answerSlowPoll(fresh(before, '"v1"'))
        await vi.advanceTimersByTimeAsync(0)

        expect(session.getSnapshot().state?.version).toBe(after.version)
        expect(session.getSnapshot().state?.plan[0].map).toBe(ELIGIBLE_MAPS[0])
        session.stop()
    })

    it('posts manager commands with the version, and Open without a body', async () => {
        const state = runningState()
        const fetchMock = stubFetch((_url, init) => fresh(init.method === 'POST' ? { ...state, version: state.version + 1 } : state, '"v1"'))
        const session = store()
        session.start()
        await vi.advanceTimersByTimeAsync(0)

        await session.sendManagerCommand('pause')
        await session.sendManagerCommand('choose-a', { side: 'team_b' })
        await session.sendManagerCommand('open')

        const posts = fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')
        expect(posts.map(([url]) => url.replace(/^.*\/pick-ban\//, ''))).toEqual(['pause', 'choose-a', 'open'])
        expect(JSON.parse(posts[0][1].body as string)).toEqual({ version: state.version })
        expect(JSON.parse(posts[1][1].body as string)).toEqual({ side: 'team_b', version: state.version + 1 })
        expect(posts[2][1].body).toBeUndefined()
        session.stop()
    })

    it('holds a Lock-in sent while a hover is in flight, then sends it with the version the hover answered with', async () => {
        const before = runningState()
        const hovered = { ...before, version: before.version + 1, selection_preview: { side: 'team_a' as const, map: ELIGIBLE_MAPS[1], at: iso(Date.now()) } }
        const lockedIn = asCaptain(locked(hovered, ELIGIBLE_MAPS[1], Date.now()), 'team_a')
        let answerHover: (response: Response) => void = () => undefined
        const fetchMock = stubFetch((url, init) => {
            if (init.method !== 'POST') return fresh(before, '"v1"')
            if (url.endsWith('/hover')) return new Promise<Response>((resolve) => { answerHover = resolve })
            return fresh(lockedIn)
        })
        const session = store()
        session.start()
        await vi.advanceTimersByTimeAsync(0)
        const posts = () => fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')

        const hover = session.sendCommand('hover', { map: ELIGIBLE_MAPS[1] })
        const lock = session.sendCommand('lock', { map: ELIGIBLE_MAPS[1], plan_index: 0 })
        await vi.advanceTimersByTimeAsync(0)
        expect(posts()).toHaveLength(1)

        answerHover(fresh(hovered))
        await hover
        await lock

        expect(posts().map(([url]) => url.replace(/^.*\/pick-ban\//, ''))).toEqual(['hover', 'lock'])
        expect(JSON.parse(posts()[0][1].body as string)).toEqual({ map: ELIGIBLE_MAPS[1], version: before.version })
        expect(JSON.parse(posts()[1][1].body as string)).toEqual({ map: ELIGIBLE_MAPS[1], plan_index: 0, version: before.version + 1 })
        expect(session.getSnapshot().state?.version).toBe(lockedIn.version)
        session.stop()
    })

    it('still sends a held command, with the unchanged version, when the one before it is refused', async () => {
        const state = runningState()
        const lockedIn = asCaptain(locked(state, ELIGIBLE_MAPS[1], Date.now()), 'team_a')
        let refuseHover: (response: Response) => void = () => undefined
        const fetchMock = stubFetch((url, init) => {
            if (init.method !== 'POST') return fresh(state, '"v1"')
            if (url.endsWith('/hover')) return new Promise<Response>((resolve) => { refuseHover = resolve })
            return fresh(lockedIn)
        })
        const session = store()
        session.start()
        await vi.advanceTimersByTimeAsync(0)

        const hover = session.sendCommand('hover', { map: ELIGIBLE_MAPS[1] }).catch((error: unknown) => error)
        const lock = session.sendCommand('lock', { map: ELIGIBLE_MAPS[1], plan_index: 0 })
        await vi.advanceTimersByTimeAsync(0)
        refuseHover(refused(429, 'rate_limited'))

        expect(await hover).toBeInstanceOf(ApiError)
        await lock
        const posts = fetchMock.mock.calls.filter(([, init]) => init.method === 'POST')
        expect(posts.map(([url]) => url.replace(/^.*\/pick-ban\//, ''))).toEqual(['hover', 'lock'])
        expect(JSON.parse(posts[1][1].body as string)).toEqual({ map: ELIGIBLE_MAPS[1], plan_index: 0, version: state.version })
        session.stop()
    })

    it('refreshes and rethrows when a command is refused', async () => {
        const state = runningState()
        const fetchMock = stubFetch(
            () => fresh(state, '"v1"'),
            (_url, init) => (init.method === 'POST' ? refused(409, 'version_conflict') : unchanged(serverNow())),
        )
        const session = store()
        session.start()
        await vi.advanceTimersByTimeAsync(0)
        const loaded = session.getSnapshot().state

        const error = await session.sendCommand('ready', {}).catch((e: unknown) => e)
        await vi.advanceTimersByTimeAsync(0)

        expect((error as ApiError).reason).toBe('version_conflict')
        expect(fetchMock).toHaveBeenCalledTimes(3)
        expect(fetchMock.mock.calls[2][1].method).toBe('GET')
        expect(session.getSnapshot().state).toBe(loaded)
        session.stop()
    })
})
