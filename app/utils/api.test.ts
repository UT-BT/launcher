import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    apiGetOr,
    apiRequest,
    asArray,
    asNonEmptyObj,
    asNum,
    asStr,
    bearerHeaders,
    fetchCapDetail,
    fetchSummary,
    fetchTeamMapLeaderboard,
    fetchUserSummary,
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
        expect(detail!.total_on_map).toBe(0)
    })

    it('returns null when the payload has no cap', async () => {
        const fetchMock = vi.fn().mockResolvedValue(okJson({ neighbors: {} }))
        vi.stubGlobal('fetch', fetchMock)

        await expect(fetchCapDetail('', 'c1')).resolves.toBeNull()
    })
})
