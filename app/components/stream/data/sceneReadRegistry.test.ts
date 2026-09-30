import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COMPOSITE_HIDDEN_MS, createSceneCadenceStore, type SceneCadenceHost } from './sceneCadence'
import { createSceneReadRegistry } from './sceneReadRegistry'

const FEED = '/tournaments/cup/stream/feed?streamer=s1'
const BETTING = '/tournaments/cup/stream/matches/match-1/betting'

function stubFetch() {
    const fetchMock = vi.fn(() => Promise.resolve(new Response(JSON.stringify({ success: true, data: { rows: [] } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ETag: '"f1"' },
    })))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

function readsOf(fetchMock: ReturnType<typeof stubFetch>, path: string): number {
    return fetchMock.mock.calls.filter(call => String((call as unknown[])[0]).endsWith(path)).length
}

function obsRegistry() {
    const target = new EventTarget()
    const host: SceneCadenceHost = {
        obsstudio: {},
        addEventListener: target.addEventListener.bind(target),
        removeEventListener: target.removeEventListener.bind(target),
    }
    const cadence = createSceneCadenceStore({ host, preview: false })
    cadence.start()
    const goOnProgram = () => target.dispatchEvent(new CustomEvent('obsSourceActiveChanged', { detail: { active: true } }))
    return { registry: createSceneReadRegistry(cadence), goOnProgram }
}

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

describe('createSceneReadRegistry', () => {
    it('shares one read between every user of the same path, including the refetch on program', async () => {
        const fetchMock = stubFetch()
        const { registry, goOnProgram } = obsRegistry()
        const ticker = registry.storeFor(FEED)
        const board = registry.storeFor(FEED)
        expect(board).toBe(ticker)

        const releaseTicker = registry.retain(FEED, ticker)
        const releaseBoard = registry.retain(FEED, board)
        const releaseBetting = registry.retain(BETTING, registry.storeFor(BETTING))
        await vi.advanceTimersByTimeAsync(0)
        expect(readsOf(fetchMock, FEED)).toBe(1)
        expect(readsOf(fetchMock, BETTING)).toBe(1)

        goOnProgram()
        await vi.advanceTimersByTimeAsync(0)
        expect(readsOf(fetchMock, FEED)).toBe(2)
        expect(readsOf(fetchMock, BETTING)).toBe(2)

        releaseTicker()
        releaseBoard()
        releaseBetting()
    })

    it('keeps polling while one user remains and stops once the last one leaves', async () => {
        const fetchMock = stubFetch()
        const { registry } = obsRegistry()
        const store = registry.storeFor(FEED)
        const releaseFirst = registry.retain(FEED, store)
        const releaseSecond = registry.retain(FEED, store)
        await vi.advanceTimersByTimeAsync(0)

        releaseFirst()
        await vi.advanceTimersByTimeAsync(COMPOSITE_HIDDEN_MS)
        expect(readsOf(fetchMock, FEED)).toBe(2)

        releaseSecond()
        await vi.advanceTimersByTimeAsync(COMPOSITE_HIDDEN_MS)
        expect(readsOf(fetchMock, FEED)).toBe(2)
    })

    it('restarts a store that is retained again after its last user left', async () => {
        const fetchMock = stubFetch()
        const { registry } = obsRegistry()
        const store = registry.storeFor(FEED)
        registry.retain(FEED, store)()
        const release = registry.retain(FEED, store)
        await vi.advanceTimersByTimeAsync(0)

        expect(registry.storeFor(FEED)).toBe(store)
        expect(readsOf(fetchMock, FEED)).toBeGreaterThan(0)
        release()
    })
})
