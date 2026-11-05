import { afterEach, describe, expect, it, vi } from 'vitest'
import { API_BASE_URL, ApiError, restartServer, startServer, stopServer } from './api'
import { serverActionResultFixture, serverControlFixtureResponse } from './fixtures/serverControlFixtures'

const SERVER_ID = '7c3e9d14-2a5b-4f68-8e01-3b9c4d5e6f01'

function stubFetch(response: Response) {
    const fetchMock = vi.fn().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

function sentRequest(fetchMock: ReturnType<typeof vi.fn>): { url: string; init: RequestInit } {
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    return { url, init }
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe.each([
    ['restart', restartServer],
    ['start', startServer],
    ['stop', stopServer],
] as const)('%sServer', (action, send) => {
    it(`posts an empty body to the ${action} route`, async () => {
        const fetchMock = stubFetch(serverControlFixtureResponse('serverActionOk'))

        await send('staff-token', SERVER_ID)

        const { url, init } = sentRequest(fetchMock)
        expect(url).toBe(`${API_BASE_URL}/admin/servers/${SERVER_ID}/${action}`)
        expect(init.method).toBe('POST')
        expect(init.body).toBeUndefined()
        expect(init.headers).toMatchObject({ Authorization: 'Bearer staff-token' })
    })
})

describe('server actions', () => {
    it('returns the result on success', async () => {
        stubFetch(serverControlFixtureResponse('serverActionOk'))

        await expect(restartServer('t', SERVER_ID)).resolves.toEqual({ ok: true, result: serverActionResultFixture() })
    })

    it('maps rate_limited with its retry_after', async () => {
        stubFetch(serverControlFixtureResponse('serverActionRateLimited'))

        await expect(restartServer('t', SERVER_ID)).resolves.toEqual({
            ok: false,
            failure: {
                code: 'rate_limited',
                message: 'Another action reached this server less than 15 seconds ago.',
                retry_after: 9,
            },
        })
    })

    it('maps action_not_offered with the state and the actions now offered', async () => {
        stubFetch(serverControlFixtureResponse('serverActionNotOffered'))

        await expect(stopServer('t', SERVER_ID)).resolves.toEqual({
            ok: false,
            failure: {
                code: 'action_not_offered',
                message: "That action is not available in the server's current state.",
                unit_state: 'held',
                actions: ['start'],
            },
        })
    })

    it('maps not_managed', async () => {
        stubFetch(serverControlFixtureResponse('serverActionNotManaged'))

        await expect(startServer('t', SERVER_ID)).resolves.toEqual({
            ok: false,
            failure: { code: 'not_managed', message: 'This server is not on a managed host.' },
        })
    })

    it('maps agent_error', async () => {
        stubFetch(serverControlFixtureResponse('serverActionAgentError'))

        await expect(restartServer('t', SERVER_ID)).resolves.toEqual({
            ok: false,
            failure: { code: 'agent_error', message: "That host's agent did not respond. It may be offline." },
        })
    })

    it('throws an ApiError for any other failure', async () => {
        stubFetch(new Response(JSON.stringify({ success: false, error: 'Server not found' }), { status: 404 }))

        const error = await restartServer('t', SERVER_ID).catch((e: unknown) => e)

        expect(error).toBeInstanceOf(ApiError)
        expect(error).toMatchObject({ status: 404, message: 'Server not found' })
    })

    it('throws for a known code whose data is missing', async () => {
        stubFetch(new Response(JSON.stringify({ success: false, error: 'Slow down', code: 'rate_limited' }), { status: 429 }))

        const error = await restartServer('t', SERVER_ID).catch((e: unknown) => e)

        expect(error).toBeInstanceOf(ApiError)
        expect(error).toMatchObject({ status: 429, reason: 'rate_limited' })
    })
})
