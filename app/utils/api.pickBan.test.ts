import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    ApiError,
    PICK_BAN_ERROR_CODES,
    fetchPickBanQueue,
    fetchPickBanState,
    pickBanErrorCode,
    sendPickBanCommand,
    sendPickBanManagerCommand,
} from './api'
import { pickBanState } from '@/app/components/pages/events/pickban/pickBanFixtures'

function stateResponse(data: unknown, headers: { [key: string]: string } = {}) {
    return new Response(JSON.stringify({ success: true, data }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...headers },
    })
}

function lastCall(fetchMock: ReturnType<typeof vi.fn>) {
    const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1] as [string, RequestInit]
    return { url, init, headers: init.headers as { [key: string]: string } }
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('fetchPickBanState', () => {
    it('reads the match state with its ETag and server time', async () => {
        const state = pickBanState()
        const fetchMock = vi.fn().mockResolvedValue(stateResponse(state, { ETag: '"abc123"' }))
        vi.stubGlobal('fetch', fetchMock)

        const read = await fetchPickBanState(undefined, 'cup 2026', 'm/1')

        expect(read).toEqual({ kind: 'fresh', state, etag: '"abc123"', serverNow: state.server_now })
        const { url, init, headers } = lastCall(fetchMock)
        expect(url).toMatch(/\/tournaments\/cup%202026\/matches\/m%2F1\/pick-ban$/)
        expect(init.method).toBe('GET')
        expect(headers).not.toHaveProperty('If-None-Match')
        expect(headers).not.toHaveProperty('Authorization')
    })

    it('sends the last ETag verbatim and treats a 304 as unchanged', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(null, {
            status: 304,
            headers: { 'X-Server-Now': '2026-09-26T20:00:05.250000+00:00' },
        }))
        vi.stubGlobal('fetch', fetchMock)

        const read = await fetchPickBanState('token', 'cup', 'm1', { etag: '"abc123"' })

        expect(read).toEqual({ kind: 'unchanged', serverNow: '2026-09-26T20:00:05.250000+00:00' })
        expect(lastCall(fetchMock).headers['If-None-Match']).toBe('"abc123"')
        expect(lastCall(fetchMock).headers.Authorization).toBe('Bearer token')
    })

    it('reports no server time on a 304 without the header', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 304 })))

        await expect(fetchPickBanState(undefined, 'cup', 'm1', { etag: '"x"' })).resolves.toEqual({ kind: 'unchanged', serverNow: null })
    })

    it('surfaces a refusal as an ApiError carrying its code', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ success: false, error: 'Not found', code: 'no_session' }),
            { status: 404, headers: { 'Content-Type': 'application/json' } },
        )))

        const error = await fetchPickBanState(undefined, 'cup', 'm1').catch((e: unknown) => e)

        expect(error).toBeInstanceOf(ApiError)
        expect((error as ApiError).status).toBe(404)
        expect((error as ApiError).reason).toBe('no_session')
    })
})

describe('pick/ban commands', () => {
    it('posts a participant command with the expected version and returns the new state', async () => {
        const state = pickBanState({ version: 8 })
        const fetchMock = vi.fn().mockResolvedValue(stateResponse(state))
        vi.stubGlobal('fetch', fetchMock)

        const next = await sendPickBanCommand('token', 'cup', 'm1', 'lock', { map: 'CTF-BT-Alpha', plan_index: 2, version: 7 })

        expect(next).toEqual(state)
        const { url, init } = lastCall(fetchMock)
        expect(url).toMatch(/\/tournaments\/cup\/matches\/m1\/pick-ban\/lock$/)
        expect(init.method).toBe('POST')
        expect(JSON.parse(init.body as string)).toEqual({ map: 'CTF-BT-Alpha', plan_index: 2, version: 7 })
    })

    it('posts a manager command under the admin namespace', async () => {
        const fetchMock = vi.fn().mockResolvedValue(stateResponse(pickBanState()))
        vi.stubGlobal('fetch', fetchMock)

        await sendPickBanManagerCommand('token', 'cup', 'm1', 'choose-a', { side: 'team_b', version: 3 })

        const { url, init } = lastCall(fetchMock)
        expect(url).toMatch(/\/tournaments\/cup\/admin\/matches\/m1\/pick-ban\/choose-a$/)
        expect(JSON.parse(init.body as string)).toEqual({ side: 'team_b', version: 3 })
    })

    it('opens a lobby without a body', async () => {
        const fetchMock = vi.fn().mockResolvedValue(stateResponse(pickBanState()))
        vi.stubGlobal('fetch', fetchMock)

        await sendPickBanManagerCommand('token', 'cup', 'm1', 'open')

        const { url, init, headers } = lastCall(fetchMock)
        expect(url).toMatch(/\/admin\/matches\/m1\/pick-ban\/open$/)
        expect(init.method).toBe('POST')
        expect(init.body).toBeUndefined()
        expect(headers).not.toHaveProperty('Content-Type')
    })

    it('exposes the refusal code of a failed command', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
            JSON.stringify({ success: false, error: 'Someone else locked first.', code: 'version_conflict' }),
            { status: 409, headers: { 'Content-Type': 'application/json' } },
        )))

        const error = await sendPickBanCommand('token', 'cup', 'm1', 'ready', { version: 1 }).catch((e: unknown) => e)

        expect(pickBanErrorCode(error)).toBe('version_conflict')
        expect((error as ApiError).message).toBe('Someone else locked first.')
    })
})

describe('pickBanErrorCode', () => {
    it('knows every stable refusal code', () => {
        for (const code of PICK_BAN_ERROR_CODES) {
            expect(pickBanErrorCode(new ApiError(409, 'x', 'y', code))).toBe(code)
        }
    })

    it('ignores unknown codes and non-API errors', () => {
        expect(pickBanErrorCode(new ApiError(409, 'x', 'y', 'slot_no_longer_valid'))).toBeNull()
        expect(pickBanErrorCode(new ApiError(500, 'x', 'y'))).toBeNull()
        expect(pickBanErrorCode(new Error('network'))).toBeNull()
    })
})

describe('fetchPickBanQueue', () => {
    it('reads the manager queue and tolerates an empty answer', async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        }))
        vi.stubGlobal('fetch', fetchMock)

        await expect(fetchPickBanQueue('token', 'cup')).resolves.toEqual([])
        expect(lastCall(fetchMock).url).toMatch(/\/tournaments\/cup\/admin\/pick-ban\/queue$/)
    })
})
