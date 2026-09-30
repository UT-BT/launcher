import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HOT_STATE_ACTIVE_MS, HOT_STATE_HIDDEN_MS } from './sceneCadence'
import { STREAM_T0, streamHotState, streamIso, streamMatch } from './streamFixtures'
import type { StreamHotState } from './streamHotState'
import { RECONNECTING_AFTER_FAILURES, createStreamHotStateStore } from './streamHotStateStore'
import { createSceneReadStore } from './sceneReadStore'

const SERVER_AHEAD = 5_000

type Handler = (url: string, init: RequestInit) => Response

function fresh(data: object, etag: string): Response {
    return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ETag: etag, 'X-Server-Now': streamIso(Date.now() + SERVER_AHEAD) },
    })
}

function hotState(overrides: Partial<StreamHotState> = {}): StreamHotState {
    return streamHotState({ server_now: streamIso(Date.now() + SERVER_AHEAD), ...overrides })
}

function unchanged(): Response {
    return new Response(null, { status: 304, headers: { 'X-Server-Now': streamIso(Date.now() + SERVER_AHEAD) } })
}

function failing(): Response {
    return new Response(JSON.stringify({ success: false, error: 'Unavailable' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
}

function stubFetch(...handlers: Handler[]) {
    const queue = [...handlers]
    const fetchMock = vi.fn((url: string, init: RequestInit) => Promise.resolve((queue.length > 1 ? queue.shift()! : queue[0])(url, init)))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

function ifNoneMatch(fetchMock: ReturnType<typeof stubFetch>, call: number): string | undefined {
    return (fetchMock.mock.calls[call][1].headers as { [key: string]: string })['If-None-Match']
}

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(STREAM_T0)
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

describe('createStreamHotStateStore', () => {
    it('reads the streamer hot state, then revalidates it with its ETag at the cadence interval', async () => {
        const fetchMock = stubFetch(() => fresh(hotState(), '"v1"'), () => unchanged())
        let intervalMs = HOT_STATE_ACTIVE_MS
        const store = createStreamHotStateStore({ eventSlug: '2v2-cup-2026', streamerId: '42', intervalMs: () => intervalMs })
        store.start()
        await vi.advanceTimersByTimeAsync(0)

        expect(fetchMock.mock.calls[0][0]).toMatch(/\/tournaments\/2v2-cup-2026\/stream\/42\/state$/)
        expect(ifNoneMatch(fetchMock, 0)).toBeUndefined()
        const first = store.getSnapshot()
        expect(first.loading).toBe(false)
        expect(first.state?.match?.id).toBe('match-1')

        await vi.advanceTimersByTimeAsync(HOT_STATE_ACTIVE_MS)
        expect(fetchMock).toHaveBeenCalledTimes(2)
        expect(ifNoneMatch(fetchMock, 1)).toBe('"v1"')
        expect(store.getSnapshot().state).toBe(first.state)

        intervalMs = HOT_STATE_HIDDEN_MS
        await vi.advanceTimersByTimeAsync(HOT_STATE_ACTIVE_MS)
        expect(fetchMock).toHaveBeenCalledTimes(3)
        await vi.advanceTimersByTimeAsync(HOT_STATE_HIDDEN_MS - 1)
        expect(fetchMock).toHaveBeenCalledTimes(3)
        await vi.advanceTimersByTimeAsync(1)
        expect(fetchMock).toHaveBeenCalledTimes(4)
        store.stop()
    })

    it('estimates the server clock offset from X-Server-Now', async () => {
        stubFetch(() => fresh(hotState(), '"v1"'))
        const store = createStreamHotStateStore({ eventSlug: 'cup', streamerId: '42', intervalMs: () => HOT_STATE_ACTIVE_MS })
        store.start()
        await vi.advanceTimersByTimeAsync(0)

        expect(store.getSnapshot().clockOffsetMs).toBe(SERVER_AHEAD)
        store.stop()
    })

    it('keeps unchanged parts of the payload by reference when a new version arrives', async () => {
        const before = hotState()
        const scheduledLater = streamMatch({ scheduled_at: streamIso(STREAM_T0 + 3_600_000) })
        stubFetch(() => fresh(before, '"v1"'), () => fresh(hotState({ match: scheduledLater }), '"v2"'))
        const store = createStreamHotStateStore({ eventSlug: 'cup', streamerId: '42', intervalMs: () => HOT_STATE_ACTIVE_MS })
        store.start()
        await vi.advanceTimersByTimeAsync(0)
        const first = store.getSnapshot().state!
        await store.pollNow()
        const second = store.getSnapshot().state!

        expect(second).not.toBe(first)
        expect(second.match?.scheduled_at).toBe(scheduledLater.scheduled_at)
        expect(second.match?.teams).toBe(first.match?.teams)
        expect(second.event).toBe(first.event)
        store.stop()
    })

    it('flags reconnecting after repeated failures and keeps the last good state', async () => {
        stubFetch(() => fresh(hotState(), '"v1"'), failing)
        const store = createStreamHotStateStore({ eventSlug: 'cup', streamerId: '42', intervalMs: () => HOT_STATE_ACTIVE_MS })
        store.start()
        await vi.advanceTimersByTimeAsync(0)
        const good = store.getSnapshot().state

        await vi.advanceTimersByTimeAsync(HOT_STATE_ACTIVE_MS * (RECONNECTING_AFTER_FAILURES - 1))
        expect(store.getSnapshot().reconnecting).toBe(false)
        await vi.advanceTimersByTimeAsync(HOT_STATE_ACTIVE_MS)
        expect(store.getSnapshot().reconnecting).toBe(true)
        expect(store.getSnapshot().state).toBe(good)
        store.stop()
    })

    it('rejects a payload that is not a hot state', async () => {
        stubFetch(() => fresh([], '"v1"'))
        const store = createStreamHotStateStore({ eventSlug: 'cup', streamerId: '42', intervalMs: () => HOT_STATE_ACTIVE_MS })
        store.start()
        await vi.advanceTimersByTimeAsync(0)

        expect(store.getSnapshot()).toMatchObject({ state: null, loading: false })
        expect(store.getSnapshot().error).toBeInstanceOf(Error)
        store.stop()
    })
})

describe('createSceneReadStore', () => {
    it('reads a composite and revalidates it with its ETag', async () => {
        const fetchMock = stubFetch(() => fresh({ rows: [1, 2] }, '"p1"'), () => unchanged())
        const store = createSceneReadStore<{ rows: number[] }>({ path: '/tournaments/cup/stream/matches/match-1/preview', intervalMs: () => 30_000 })
        store.start()
        await vi.advanceTimersByTimeAsync(0)
        const first = store.getSnapshot().data
        expect(first).toEqual({ rows: [1, 2] })

        await vi.advanceTimersByTimeAsync(30_000)
        expect(ifNoneMatch(fetchMock, 1)).toBe('"p1"')
        expect(store.getSnapshot().data).toBe(first)
        store.stop()
    })
})
