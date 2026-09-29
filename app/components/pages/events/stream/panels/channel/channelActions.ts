import { apiGet, apiRequest } from '@/app/utils/api'
import { streamDeskError } from '../../streamDesk'
import type { ChannelChoice } from './channelView'

async function writeResult<T>(res: Response, pick: (data: unknown) => T): Promise<T> {
    if (!res.ok) throw await streamDeskError(res)
    const json = await res.json()
    if (!json?.success) throw new Error('Invalid response format from server')
    return pick(json.data)
}

export function matchChannelPath(slug: string, matchId: string): string {
    return `/tournaments/${encodeURIComponent(slug)}/stream/matches/${encodeURIComponent(matchId)}/channel`
}

export async function setMatchChannel(
    accessToken: string,
    slug: string,
    matchId: string,
    choice: ChannelChoice,
    url?: string,
): Promise<string | null> {
    const res = await apiRequest(matchChannelPath(slug, matchId), {
        token: accessToken,
        method: 'PUT',
        body: choice === 'other' ? { choice, url } : { choice },
    })
    return writeResult(res, data => (data as { channel?: { stream_url?: string | null } })?.channel?.stream_url ?? null)
}

export async function setOwnTwitchChannel(accessToken: string, twitch: string | null): Promise<string | null> {
    const res = await apiRequest('/users/me/twitch', { token: accessToken, method: 'PUT', body: { twitch } })
    return writeResult(res, data => (data as { twitch_url?: string | null })?.twitch_url ?? null)
}

export async function fetchOwnTwitchChannel(accessToken: string): Promise<string | null> {
    const profile = await apiGet<{ twitch_url?: string | null }>('/users/me', { token: accessToken })
    return profile.twitch_url ?? null
}
