import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchOwnTwitchChannel, matchChannelPath, setMatchChannel, setOwnTwitchChannel } from './channelActions'

function respond(status: number, body: unknown) {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }))
    vi.stubGlobal('fetch', fetchMock)
    return fetchMock
}

function sent(fetchMock: ReturnType<typeof respond>) {
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    return { url, method: init.method, body: JSON.parse(String(init.body)) }
}

afterEach(() => vi.unstubAllGlobals())

describe('setMatchChannel', () => {
    it('sends the choice alone for my channel and the UTBT channel', async () => {
        const fetchMock = respond(200, { success: true, data: { channel: { stream_url: 'https://twitch.tv/utbt' } } })
        await expect(setMatchChannel('tok', 'cup', 'm1', 'utbt')).resolves.toBe('https://twitch.tv/utbt')
        const call = sent(fetchMock)
        expect(call.url.endsWith(matchChannelPath('cup', 'm1'))).toBe(true)
        expect(call).toMatchObject({ method: 'PUT', body: { choice: 'utbt' } })
    })

    it('sends the link for another URL', async () => {
        const fetchMock = respond(200, { success: true, data: { channel: { stream_url: 'https://example.com/x' } } })
        await setMatchChannel('tok', 'cup', 'm1', 'other', 'https://example.com/x')
        expect(sent(fetchMock).body).toEqual({ choice: 'other', url: 'https://example.com/x' })
    })

    it('throws the server message', async () => {
        respond(422, { success: false, error: 'The assigned streamer has no Twitch channel set.', code: 'no_channel' })
        await expect(setMatchChannel('tok', 'cup', 'm1', 'mine')).rejects.toMatchObject({
            message: 'The assigned streamer has no Twitch channel set.',
        })
    })
})

describe('setOwnTwitchChannel', () => {
    it('puts the value and returns the stored channel', async () => {
        const fetchMock = respond(200, { success: true, data: { twitch_url: 'https://twitch.tv/keeper' } })
        await expect(setOwnTwitchChannel('tok', 'https://twitch.tv/keeper')).resolves.toBe('https://twitch.tv/keeper')
        expect(sent(fetchMock)).toMatchObject({ method: 'PUT', body: { twitch: 'https://twitch.tv/keeper' } })
    })

    it('sends null to clear', async () => {
        const fetchMock = respond(200, { success: true, data: { twitch_url: null } })
        await expect(setOwnTwitchChannel('tok', null)).resolves.toBeNull()
        expect(sent(fetchMock).body).toEqual({ twitch: null })
    })
})

describe('fetchOwnTwitchChannel', () => {
    it('reads the signed-in user own channel', async () => {
        const fetchMock = respond(200, { success: true, data: { id: '1', twitch_url: 'https://twitch.tv/keeper' } })
        await expect(fetchOwnTwitchChannel('tok')).resolves.toBe('https://twitch.tv/keeper')
        expect((fetchMock.mock.calls[0] as unknown as [string])[0].endsWith('/users/me')).toBe(true)
    })

    it('returns null when no channel is set', async () => {
        respond(200, { success: true, data: { id: '1', twitch_url: null } })
        await expect(fetchOwnTwitchChannel('tok')).resolves.toBeNull()
    })
})
