import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/app/utils/api'
import { streamSidesFixture, streamSidesFixtureResponse } from '@/app/utils/fixtures/streamSidesFixtures'
import { setMatchSides } from './sidesActions'

const TARGET = { accessToken: 'token', slug: 'cup 1', matchId: 'm-1' }
const BODY = { red_team_id: '3c889e6c-37c4-5552-a789-30ff137a5ee8' }

function stubFetch(response: Response) {
    const fetchMock = vi.fn((_url: string, _init: RequestInit) => Promise.resolve(response))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('setMatchSides', () => {
    it('puts the new Red team and returns the sides', async () => {
        const fetchMock = stubFetch(streamSidesFixtureResponse('streamSidesPut'))

        await expect(setMatchSides(TARGET, BODY)).resolves.toEqual(streamSidesFixture('streamSidesPut'))

        const [url, init] = fetchMock.mock.calls[0]
        expect(url).toMatch(/\/tournaments\/cup%201\/stream\/matches\/m-1\/sides$/)
        expect(init.method).toBe('PUT')
        expect(JSON.parse(init.body as string)).toEqual(BODY)
        expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token')
    })

    it.each([
        ['errorPickBanInProgress', 409, 'pick_ban_in_progress'],
        ['errorInvalidSide', 400, 'invalid_side'],
    ] as const)('turns %s into an error with its code', async (name, status, code) => {
        stubFetch(streamSidesFixtureResponse(name))

        const error = await setMatchSides(TARGET, BODY).catch(caught => caught)

        expect(error).toBeInstanceOf(ApiError)
        expect(error.status).toBe(status)
        expect(error.reason).toBe(code)
    })

    it('rejects a response without the sides', async () => {
        stubFetch(new Response(JSON.stringify({ success: true, data: {} }), { status: 200 }))

        await expect(setMatchSides(TARGET, BODY)).rejects.toThrow('Invalid response format from server')
    })
})
