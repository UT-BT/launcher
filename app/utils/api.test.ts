import { afterEach, describe, expect, it, vi } from 'vitest'
import { apiRequest, bearerHeaders, fetchSummary } from './api'

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
