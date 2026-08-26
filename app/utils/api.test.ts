import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    apiGetOr,
    apiRequest,
    asArray,
    asNonEmptyObj,
    asNum,
    asStr,
    avatarSizeFor,
    getAvatarUrl,
    bearerHeaders,
    fetchCapDetail,
    fetchSummary,
    fetchTeamMapLeaderboard,
    fetchUserSummary,
    fetchUserFavoriteServers,
    addFavoriteServer,
    removeFavoriteServer,
} from './api'

function okJson(data: unknown) {
    return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    })
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('API authorization transport', () => {
    it('omits Authorization without a real token', () => {
        expect(bearerHeaders()).toEqual({})
        expect(bearerHeaders('')).toEqual({})
    })

    it('adds a bearer for authenticated requests', () => {
        expect(bearerHeaders('real-token')).toEqual({ Authorization: 'Bearer real-token' })
    })

    it('omits Authorization from shared anonymous requests', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson({}))
        vi.stubGlobal('fetch', fetchMock)

        await apiRequest('/probe')

        const init = fetchMock.mock.calls[0][1] as RequestInit
        expect(init.headers).not.toHaveProperty('Authorization')
    })

    it('omits Authorization from legacy public fetchers passed an empty token', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson({}))
        vi.stubGlobal('fetch', fetchMock)

        await fetchSummary('')

        const init = fetchMock.mock.calls[0][1] as RequestInit
        expect(init.headers).not.toHaveProperty('Authorization')
    })
})

describe('coercion helpers', () => {
    it('asNum treats empty string, null, undefined, and NaN as the fallback', () => {
        expect(asNum('')).toBe(0)
        expect(asNum(null)).toBe(0)
        expect(asNum(undefined)).toBe(0)
        expect(asNum('abc')).toBe(0)
        expect(asNum('', 5)).toBe(5)
    })

    it('asNum keeps real numbers including zero', () => {
        expect(asNum(0)).toBe(0)
        expect(asNum('42')).toBe(42)
        expect(asNum(1.5, 9)).toBe(1.5)
    })

    it('asArray returns [] for anything but an array', () => {
        expect(asArray(undefined)).toEqual([])
        expect(asArray(null)).toEqual([])
        expect(asArray({})).toEqual([])
        expect(asArray([1, 2])).toEqual([1, 2])
    })

    it('asNonEmptyObj maps empty objects and non-objects to null', () => {
        expect(asNonEmptyObj({})).toBeNull()
        expect(asNonEmptyObj(null)).toBeNull()
        expect(asNonEmptyObj([])).toBeNull()
        expect(asNonEmptyObj({ a: 1 })).toEqual({ a: 1 })
    })

    it('asStr falls back for non-strings', () => {
        expect(asStr(undefined)).toBe('')
        expect(asStr(3)).toBe('')
        expect(asStr('x', 'y')).toBe('x')
    })
})

describe('response envelope tolerance', () => {
    it('apiGetOr returns the fallback when the data key is absent', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }))
        vi.stubGlobal('fetch', fetchMock)

        await expect(apiGetOr('/probe', { count: 0 })).resolves.toEqual({ count: 0 })
    })

    it('apiGetOr returns data when present', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson({ count: 3 }))
        vi.stubGlobal('fetch', fetchMock)

        await expect(apiGetOr('/probe', { count: 0 })).resolves.toEqual({ count: 3 })
    })

    it('fetchTeamMapLeaderboard treats a missing data key as an empty leaderboard', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }))
        vi.stubGlobal('fetch', fetchMock)

        await expect(fetchTeamMapLeaderboard('', 'CTF-BT-Test')).resolves.toEqual([])
    })

    it('fetchTeamMapLeaderboard defaults missing members to an empty array', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson([{ team_cap_id: '1' }]))
        vi.stubGlobal('fetch', fetchMock)

        const rows = await fetchTeamMapLeaderboard('', 'CTF-BT-Test')
        expect(rows[0].members).toEqual([])
    })
})

describe('fetchUserSummary normalisation', () => {
    it('zero-fills medals and counts when the server omits them', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson({ profile: { id: 7 } }))
        vi.stubGlobal('fetch', fetchMock)

        const summary = await fetchUserSummary('', 7)
        expect(summary.medals.points).toBe(0)
        expect(summary.medals.world_records).toBe(0)
        expect(summary.counts.total_caps).toBe(0)
        expect(summary.counts.total_playtime_seconds).toBe(0)
        expect(summary.recentCaps).toEqual([])
        expect(summary.recentWrs).toEqual([])
    })

    it('coerces empty-string numerics to zero', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson({
            profile: { id: 7, active_ban: {} },
            medals: { points: '', rank: '3' },
            counts: { total_caps: '' },
        }))
        vi.stubGlobal('fetch', fetchMock)

        const summary = await fetchUserSummary('', 7)
        expect(summary.medals.points).toBe(0)
        expect(summary.medals.rank).toBe(3)
        expect(summary.counts.total_caps).toBe(0)
        expect(summary.profile.active_ban).toBeNull()
    })
})

describe('fetchCapDetail normalisation', () => {
    it('fills missing nested structures with safe defaults', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson({ cap: { id: 'c1', cap_time_seconds: 10 } }))
        vi.stubGlobal('fetch', fetchMock)

        const detail = await fetchCapDetail('', 'c1')
        expect(detail).not.toBeNull()
        expect(detail!.neighbors).toEqual({ above: [], below: [] })
        expect(detail!.deltas.wr).toBeNull()
        expect(detail!.medals.world_record).toBeNull()
        expect(detail!.checkpoints).toEqual([])
        expect(detail!.compare_candidates).toEqual([])
        expect(detail!.server).toEqual({ name: null, region: null })
        expect(detail!.total_on_map).toBeNull()
        expect(detail!.rank_on_map).toBeNull()
    })

    it('returns null when the payload has no cap', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson({ neighbors: {} }))
        vi.stubGlobal('fetch', fetchMock)

        await expect(fetchCapDetail('', 'c1')).resolves.toBeNull()
    })
})

describe('avatar urls', () => {
    it('asks for the smallest CDN size that covers a 2x display', () => {
        expect(avatarSizeFor(20)).toBe(64)
        expect(avatarSizeFor(24)).toBe(64)
        expect(avatarSizeFor(32)).toBe(64)
        expect(avatarSizeFor(48)).toBe(128)
        expect(avatarSizeFor(128)).toBe(256)
    })

    it('only ever returns a size Discord actually serves', () => {
        const allowed = [16, 32, 64, 128, 256, 512, 1024]
        for (let px = 1; px <= 600; px++) {
            expect(allowed).toContain(avatarSizeFor(px))
        }
    })

    it('never exceeds the gateway default, which the OG card renderer depends on', () => {
        for (const px of [20, 24, 32, 48, 128]) {
            expect(avatarSizeFor(px)).toBeLessThanOrEqual(256)
        }
    })

    it('omits the size param entirely when none is given', () => {
        expect(getAvatarUrl('123456789')).not.toContain('size=')
        expect(getAvatarUrl('123456789', 64)).toContain('?size=64')
    })
})

describe('server favorites', () => {
    it('reduces the favorites payload to server ids in the order the API returned them', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okJson([
            { user: '1', server_id: 'b', created_at: '2026-01-01 00:00:00' },
            { user: '1', server_id: 'a', created_at: '2026-01-02 00:00:00' },
        ])))

        expect(await fetchUserFavoriteServers('token', '1')).toEqual(['b', 'a'])
    })

    it('scopes the read to a user id when one is known', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson([]))
        vi.stubGlobal('fetch', fetchMock)

        await fetchUserFavoriteServers('token', '228152236587483136')

        expect(fetchMock.mock.calls[0][0]).toContain('?user=228152236587483136')
    })

    it('degrades to no favorites rather than throwing when the read fails', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 500 })))
        vi.stubGlobal('console', { ...console, error: vi.fn() })

        expect(await fetchUserFavoriteServers('token', '1')).toEqual([])
    })

    it('adds a favorite by posting the resolved server id', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson({}))
        vi.stubGlobal('fetch', fetchMock)

        await addFavoriteServer('token', '0f9d5f7a-2b41-4c8e-9a3d-6d2f1b8c4e77')

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toMatch(/\/user_favorite_servers\/$/)
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body as string)).toEqual({ server_id: '0f9d5f7a-2b41-4c8e-9a3d-6d2f1b8c4e77' })
    })

    it('removes a favorite by id and surfaces a failed write to the caller', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson({}))
        vi.stubGlobal('fetch', fetchMock)

        await removeFavoriteServer('token', '0f9d5f7a-2b41-4c8e-9a3d-6d2f1b8c4e77')

        const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
        expect(url).toMatch(/\/user_favorite_servers\/0f9d5f7a-2b41-4c8e-9a3d-6d2f1b8c4e77$/)
        expect(init.method).toBe('DELETE')

        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))
        await expect(removeFavoriteServer('token', 'x')).rejects.toThrow()
    })
})
