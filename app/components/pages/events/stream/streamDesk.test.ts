import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
    DESK_POLL_MS,
    createStreamDeskStore,
    deskPollActive,
    deskPollEnvironment,
    insideObs,
    type StreamDesk,
} from './streamDesk'

type Handler = (url: string, init: RequestInit) => Response

const OBS_WINDOW = { obsstudio: { pluginVersion: '2.24.0' } }

function hiddenDocument() {
    return {
        visibilityState: 'hidden' as DocumentVisibilityState,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }
}

function visibleDocument() {
    return { ...hiddenDocument(), visibilityState: 'visible' as DocumentVisibilityState }
}

function desk(overrides: Partial<StreamDesk> = {}): StreamDesk {
    return {
        server_now: '2026-09-26T20:00:00+00:00',
        event: { name: 'Stream Cup', slug: 'cup' },
        streamer: { id: '111', display_name: 'Alice', channel: null },
        desk: { brb_message: null, webcam_enabled: false, current_match_id: null },
        reason: 'none',
        match: null,
        assigned_matches: [],
        next_match: null,
        ...overrides,
    }
}

function fresh(body: StreamDesk, etag: string | null = null): Response {
    return new Response(JSON.stringify({ success: true, data: body }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...(etag ? { ETag: etag } : {}) },
    })
}

function unchanged(): Response {
    return new Response(null, { status: 304, headers: { 'X-Server-Now': '2026-09-26T20:00:02+00:00' } })
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

function store(win: object | undefined, doc: ReturnType<typeof hiddenDocument>) {
    return createStreamDeskStore({
        slug: 'cup',
        streamerId: '111',
        accessToken: () => 'token',
        environment: deskPollEnvironment(win, doc),
    })
}

beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.parse('2026-09-26T20:00:00Z'))
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('the desk polling decision', () => {
    it('keeps polling inside OBS while the page reports hidden', () => {
        expect(deskPollActive(true, true)).toBe(true)
        expect(deskPollEnvironment(OBS_WINDOW, hiddenDocument()).isVisible()).toBe(true)
    })

    it('pauses in an ordinary browser tab that is hidden', () => {
        expect(deskPollActive(true, false)).toBe(false)
        expect(deskPollEnvironment({}, hiddenDocument()).isVisible()).toBe(false)
    })

    it('polls whenever the page is visible', () => {
        expect(deskPollActive(false, false)).toBe(true)
        expect(deskPollActive(false, true)).toBe(true)
        expect(deskPollEnvironment({}, visibleDocument()).isVisible()).toBe(true)
    })

    it('recognises the OBS browser only by its window object', () => {
        expect(insideObs(OBS_WINDOW)).toBe(true)
        expect(insideObs({})).toBe(false)
        expect(insideObs({ obsstudio: null })).toBe(false)
        expect(insideObs(undefined)).toBe(false)
    })
})

describe('the desk store', () => {
    it('keeps reading every 2 s inside a hidden OBS dock', async () => {
        const fetchMock = stubFetch(() => fresh(desk()))
        const deskStore = store(OBS_WINDOW, hiddenDocument())

        deskStore.start()
        await vi.advanceTimersByTimeAsync(DESK_POLL_MS * 3)

        expect(fetchMock).toHaveBeenCalledTimes(4)
        deskStore.stop()
    })

    it('stops reading in a hidden browser tab outside OBS', async () => {
        const fetchMock = stubFetch(() => fresh(desk()))
        const deskStore = store({}, hiddenDocument())

        deskStore.start()
        await vi.advanceTimersByTimeAsync(DESK_POLL_MS * 3)

        expect(fetchMock).toHaveBeenCalledTimes(1)
        deskStore.stop()
    })

    it('reads the operating-as streamer and keeps the payload on a 304', async () => {
        const first = desk({ reason: 'next' })
        const fetchMock = stubFetch(() => fresh(first, '"v1"'), () => unchanged())
        const deskStore = store({}, visibleDocument())

        expect(deskStore.getSnapshot()).toMatchObject({ desk: null, loading: true })
        deskStore.start()
        await vi.advanceTimersByTimeAsync(0)
        expect(deskStore.getSnapshot()).toMatchObject({ desk: first, loading: false, error: null })
        const adopted = deskStore.getSnapshot().desk

        await vi.advanceTimersByTimeAsync(DESK_POLL_MS)
        expect(deskStore.getSnapshot().desk).toBe(adopted)
        expect(fetchMock.mock.calls[0][0]).toMatch(/\/tournaments\/cup\/stream\/111\/desk$/)
        expect((fetchMock.mock.calls[1][1].headers as { [key: string]: string })['If-None-Match']).toBe('"v1"')
        deskStore.stop()
    })

    it('reads straight away on refresh and shows the change', async () => {
        const changed = desk({ reason: 'current' })
        stubFetch(() => fresh(desk()), () => fresh(changed))
        const deskStore = store({}, visibleDocument())

        deskStore.start()
        await vi.advanceTimersByTimeAsync(0)
        await deskStore.refresh()

        expect(deskStore.getSnapshot().desk).toEqual(changed)
        deskStore.stop()
    })

    it('reports a failed read and keeps the last payload', async () => {
        const first = desk()
        stubFetch(
            () => fresh(first),
            () => new Response(JSON.stringify({ success: false, error: 'Nope', code: 'not_authorized' }), { status: 403 }),
        )
        const deskStore = store({}, visibleDocument())

        deskStore.start()
        await vi.advanceTimersByTimeAsync(DESK_POLL_MS)

        expect(deskStore.getSnapshot().desk).toEqual(first)
        expect(deskStore.getSnapshot().error).toMatchObject({ status: 403, reason: 'not_authorized', message: 'Nope' })
        deskStore.stop()
    })

    it('treats a payload without the desk fields as a failed read', async () => {
        stubFetch(() => new Response(JSON.stringify({ success: true, data: [] }), { status: 200 }))
        const deskStore = store({}, visibleDocument())

        deskStore.start()
        await vi.advanceTimersByTimeAsync(0)

        expect(deskStore.getSnapshot()).toMatchObject({ desk: null, loading: false })
        expect(deskStore.getSnapshot().error).toBeInstanceOf(Error)
        deskStore.stop()
    })
})
