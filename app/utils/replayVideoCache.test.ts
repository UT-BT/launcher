import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReplayVideo } from './api'
import { resolveCompareVideo } from './replayVideoCache'

const FIVE_MINUTES_MS = 5 * 60 * 1000

const video: ReplayVideo = { source: 'utrecorder', mp4_url: 'https://example.test/a.mp4', view_url: null, fps: 60 }

function replayResponse(body: ReplayVideo | null): Response {
    if (!body) return new Response('{}', { status: 404, headers: { 'Content-Type': 'application/json' } })
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

function stubReplays(answer: (capId: string) => ReplayVideo | null) {
    const fetchMock = vi.fn(async (url: string) => replayResponse(answer(url.split('/').pop()!)))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

function replayReads(fetchMock: ReturnType<typeof stubReplays>, capId: string): number {
    return fetchMock.mock.calls.filter(([url]) => url.endsWith(`/replays/${capId}`)).length
}

afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
})

describe('resolveCompareVideo', () => {
    it('reads a cap once and answers later calls from the cache', async () => {
        const fetchMock = stubReplays(() => video)
        expect(await resolveCompareVideo('cached-once')).toEqual(video)
        expect(await resolveCompareVideo('cached-once')).toEqual(video)
        expect(replayReads(fetchMock, 'cached-once')).toBe(1)
    })

    it('remembers a cap without a video too', async () => {
        const fetchMock = stubReplays(() => null)
        expect(await resolveCompareVideo('no-video')).toBeNull()
        expect(await resolveCompareVideo('no-video')).toBeNull()
        expect(replayReads(fetchMock, 'no-video')).toBe(1)
    })

    it('reads the cap again once the five minutes are over', async () => {
        vi.useFakeTimers()
        vi.setSystemTime(1_000)
        let answer: ReplayVideo | null = null
        const fetchMock = stubReplays(() => answer)
        await resolveCompareVideo('expiring')
        vi.setSystemTime(1_000 + FIVE_MINUTES_MS)
        expect(await resolveCompareVideo('expiring')).toBeNull()
        expect(replayReads(fetchMock, 'expiring')).toBe(1)

        answer = video
        vi.setSystemTime(1_001 + FIVE_MINUTES_MS)
        expect(await resolveCompareVideo('expiring')).toEqual(video)
        expect(replayReads(fetchMock, 'expiring')).toBe(2)
    })

    it('keeps each cap apart', async () => {
        stubReplays(capId => capId === 'with-video' ? video : null)
        expect(await resolveCompareVideo('with-video')).toEqual(video)
        expect(await resolveCompareVideo('without-video')).toBeNull()
    })
})
