import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/app/utils/api'
import {
    adjustMapScore,
    clearCountdown,
    clearMatchLive,
    clearScoreOverrides,
    markMatchLive,
    matchBroadcastPath,
    moveCountdown,
} from './scoreActions'

const TARGET = { accessToken: 'token', slug: 'cup 1', matchId: 'm-1' }
const BROADCAST = { match_id: 'm-1', live_at: null, countdown_override_at: null, countdown_at: null, score_overrides: {} }

function stubFetch(response: Response) {
    const fetchMock = vi.fn((_url: string, _init: RequestInit) => Promise.resolve(response))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

function ok() {
    return new Response(JSON.stringify({ success: true, data: { broadcast: BROADCAST } }), { status: 200 })
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('match broadcast writes', () => {
    it('builds the match path', () => {
        expect(matchBroadcastPath('cup 1', 'm-1', '/live')).toBe('/tournaments/cup%201/stream/matches/m-1/live')
    })

    it.each([
        ['mark live', () => markMatchLive(TARGET), 'POST', '/live', undefined],
        ['clear live', () => clearMatchLive(TARGET), 'DELETE', '/live', undefined],
        ['adjust', () => adjustMapScore(TARGET, 1, 'b', -1), 'POST', '/score/overrides', { ordinal: 1, side: 'b', delta: -1 }],
        ['clear overrides', () => clearScoreOverrides(TARGET), 'DELETE', '/score/overrides', undefined],
        ['move countdown', () => moveCountdown(TARGET, { add_minutes: 10 }), 'PUT', '/countdown', { add_minutes: 10 }],
        ['set countdown', () => moveCountdown(TARGET, { at: '2026-09-26T21:00:00Z' }), 'PUT', '/countdown', { at: '2026-09-26T21:00:00Z' }],
        ['clear countdown', () => clearCountdown(TARGET), 'DELETE', '/countdown', undefined],
    ])('%s sends the right request and returns the broadcast', async (_name, write, method, suffix, body) => {
        const fetchMock = stubFetch(ok())

        await expect(write()).resolves.toEqual(BROADCAST)

        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toMatch(new RegExp(`/tournaments/cup%201/stream/matches/m-1${suffix}$`))
        expect(init.method).toBe(method)
        expect(init.body === undefined ? undefined : JSON.parse(init.body as string)).toEqual(body)
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token')
    })

    it('turns a rejected write into an error with the server message and code', async () => {
        stubFetch(new Response(
            JSON.stringify({ success: false, error: 'That correction would not change the score shown for this map.', code: 'no_effect' }),
            { status: 422 },
        ))

        const error = await adjustMapScore(TARGET, 0, 'a', -1).catch(caught => caught)

        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(422)
        expect(error.reason).toBe('no_effect')
        expect(error.message).toBe('That correction would not change the score shown for this map.')
    })

    it('rejects a response without the broadcast', async () => {
        stubFetch(new Response(JSON.stringify({ success: true, data: {} }), { status: 200 }))

        await expect(markMatchLive(TARGET)).rejects.toThrow('Invalid response format from server')
    })
})
