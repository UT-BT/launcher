import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type SessionPayload = {
    session_id: string
    sequence: number
    page_views: Record<string, number>
    outcomes: Record<string, number>
    visible_seconds: number
}

type Post = { body: SessionPayload; keepalive: boolean }

const CONSENT_KEY = 'utbt:analyticsConsent:v1'
const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

let posts: Post[] = []
let listeners: Record<string, () => void> = {}
let telemetry: typeof import('./telemetry')

function makeStorage() {
    const values = new Map<string, string>()
    return {
        getItem: (key: string) => (values.has(key) ? values.get(key)! : null),
        setItem: (key: string, value: string) => { values.set(key, String(value)) },
        removeItem: (key: string) => { values.delete(key) },
    }
}

function recordingFetch() {
    return vi.fn(async (_url: string, init: RequestInit) => {
        posts.push({ body: JSON.parse(String(init.body)) as SessionPayload, keepalive: Boolean(init.keepalive) })
        return { ok: true } as Response
    })
}

const fakeDocument = () => globalThis.document as unknown as { visibilityState: string }

function setVisibility(value: 'visible' | 'hidden') {
    fakeDocument().visibilityState = value
    listeners.visibilitychange?.()
}

const settle = () => vi.advanceTimersByTimeAsync(1)
const lastBody = () => posts[posts.length - 1].body
const sessionIds = () => new Set(posts.map((post) => post.body.session_id))

beforeEach(async () => {
    vi.useFakeTimers()
    vi.setSystemTime(Date.UTC(2026, 7, 26, 9, 0, 0))
    posts = []
    listeners = {}

    vi.stubGlobal('localStorage', makeStorage())
    vi.stubGlobal('sessionStorage', makeStorage())
    vi.stubGlobal('document', {
        visibilityState: 'visible',
        referrer: '',
        addEventListener: (type: string, handler: () => void) => { listeners[type] = handler },
        removeEventListener: (type: string) => { delete listeners[type] },
    })
    vi.stubGlobal('window', {
        setInterval: (handler: () => void, ms: number) => globalThis.setInterval(handler, ms),
        clearInterval: (id: number) => globalThis.clearInterval(id),
        addEventListener: (type: string, handler: () => void) => { listeners[type] = handler },
        removeEventListener: (type: string) => { delete listeners[type] },
    })
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/140.0' })
    vi.stubGlobal('innerWidth', 1280)
    vi.stubGlobal('location', { hostname: 'utbt.net' })
    vi.stubGlobal('fetch', recordingFetch())

    vi.resetModules()
    telemetry = await import('./telemetry')
    localStorage.setItem(CONSENT_KEY, 'granted')
})

afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
})

describe('flushTelemetry session rotation', () => {
    it('keeps one session id when a hidden tab keeps flushing past the session cap', async () => {
        telemetry.initializeTelemetry()
        await settle()
        const opened = lastBody().session_id

        setVisibility('hidden')
        await settle()

        for (let flush = 0; flush < 6; flush += 1) {
            vi.setSystemTime(Date.now() + 30 * MINUTE)
            await telemetry.flushTelemetry()
        }

        expect(sessionIds()).toEqual(new Set([opened]))
        expect(lastBody().page_views).toEqual({ home: 1 })
    })

    it('stops the flush interval while the tab is hidden', async () => {
        telemetry.initializeTelemetry()
        await settle()

        setVisibility('hidden')
        await settle()
        const flushesAtHide = posts.length

        await vi.advanceTimersByTimeAsync(HOUR)

        expect(posts).toHaveLength(flushesAtHide)
    })

    it('rotates when the user returns to a tab that idled past the cap', async () => {
        telemetry.initializeTelemetry()
        await settle()
        const opened = lastBody().session_id

        setVisibility('hidden')
        await settle()
        vi.setSystemTime(Date.now() + 5 * HOUR)
        setVisibility('visible')
        await telemetry.flushTelemetry()

        expect(lastBody().session_id).not.toBe(opened)
        expect(lastBody().page_views).toEqual({ home: 1 })
    })

    it('keeps the session when a flush fails so its counters are retried, then rotates once delivered', async () => {
        telemetry.initializeTelemetry()
        await settle()
        const opened = lastBody().session_id
        telemetry.trackOutcome('login')
        await settle()

        vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
        vi.setSystemTime(Date.now() + 5 * HOUR)
        await telemetry.flushTelemetry()

        vi.stubGlobal('fetch', recordingFetch())
        await telemetry.flushTelemetry()

        expect(lastBody().session_id).toBe(opened)
        expect(lastBody().outcomes).toEqual({ login: 1 })

        await telemetry.flushTelemetry()

        expect(lastBody().session_id).not.toBe(opened)
        expect(lastBody().outcomes).toEqual({})
    })
})

describe('flushTelemetry queueing', () => {
    it('re-fires a queued flush with the keepalive its own caller asked for', async () => {
        let release: () => void = () => {}
        vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
            posts.push({ body: JSON.parse(String(init.body)) as SessionPayload, keepalive: Boolean(init.keepalive) })
            return new Promise<Response>((resolve) => { release = () => resolve({ ok: true } as Response) })
        }))

        telemetry.initializeTelemetry()
        await Promise.resolve()

        expect(posts).toHaveLength(1)
        expect(posts[0].keepalive).toBe(false)

        void telemetry.flushTelemetry(true)
        release()
        await settle()

        expect(posts).toHaveLength(2)
        expect(posts[1].keepalive).toBe(true)
    })

    it('does not downgrade a queued keepalive flush to a plain one', async () => {
        let release: () => void = () => {}
        vi.stubGlobal('fetch', vi.fn((_url: string, init: RequestInit) => {
            posts.push({ body: JSON.parse(String(init.body)) as SessionPayload, keepalive: Boolean(init.keepalive) })
            return new Promise<Response>((resolve) => { release = () => resolve({ ok: true } as Response) })
        }))

        telemetry.initializeTelemetry()
        await Promise.resolve()

        void telemetry.flushTelemetry(true)
        void telemetry.flushTelemetry(false)
        release()
        await settle()

        expect(posts[1].keepalive).toBe(true)
    })
})
