import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchUserSummary } from '@/app/utils/api'
import { capItAllTiles } from './capItAllProgress'
import fixture from './capItAllProgress.fixture.json'

type ResponseName = keyof typeof fixture.responses

function stubSummaryResponse(name: ResponseName) {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(fixture.responses[name]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    }))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('Cap It All standing from the user summary', () => {
    it('reads a ranked player from the summary request alone', async () => {
        const fetchMock = stubSummaryResponse('ranked')

        const summary = await fetchUserSummary('token', 42)

        expect(fetchMock).toHaveBeenCalledTimes(1)
        const [url, init] = fetchMock.mock.calls[0]
        expect(String(url)).toMatch(/\/v2\/summary\/user\/42$/)
        expect(init.method ?? 'GET').toBe('GET')
        expect(init.headers).toEqual({ Authorization: 'Bearer token' })
        expect(summary.capItAll).toEqual({ rank: 12, team_caps: 4 })
        expect(capItAllTiles(summary)).toEqual({ rank: '#12', teamCaps: '4', unavailable: false })
    })

    it('reads a null rank as an unranked player, not an unavailable one', async () => {
        stubSummaryResponse('unranked')

        const summary = await fetchUserSummary('token', 43)

        expect(summary.capItAll).toEqual({ rank: null, team_caps: 0 })
        expect(capItAllTiles(summary)).toEqual({ rank: 'Unranked', teamCaps: '0', unavailable: false })
    })

    it.each<ResponseName>(['withoutCapItAll', 'capItAllWithoutRank'])(
        'shows the tiles as unavailable for %s, never a made-up rank or zero',
        async name => {
            stubSummaryResponse(name)

            const summary = await fetchUserSummary('token', 42)

            expect(summary.capItAll).toBeNull()
            expect(capItAllTiles(summary)).toEqual({ rank: '—', teamCaps: '—', unavailable: true })
        },
    )
})
