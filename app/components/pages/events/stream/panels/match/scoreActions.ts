import { apiRequest } from '@/app/utils/api'
import { streamDeskError } from '../../streamDesk'
import type { StreamSide } from '../../streamDesk'

export interface MatchBroadcast {
    match_id: string
    live_at: string | null
    countdown_override_at: string | null
    countdown_at: string | null
    score_overrides: Record<string, { a: number; b: number }>
}

export type CountdownChange = { at: string } | { add_minutes: number }

export interface BroadcastTarget {
    accessToken: string
    slug: string
    matchId: string
}

export function matchBroadcastPath(slug: string, matchId: string, suffix: string): string {
    return `/tournaments/${encodeURIComponent(slug)}/stream/matches/${encodeURIComponent(matchId)}${suffix}`
}

async function broadcastWrite(
    { accessToken, slug, matchId }: BroadcastTarget,
    suffix: string,
    method: 'POST' | 'PUT' | 'DELETE',
    body?: unknown,
): Promise<MatchBroadcast> {
    const res = await apiRequest(matchBroadcastPath(slug, matchId, suffix), { token: accessToken, method, body })
    if (!res.ok) throw await streamDeskError(res)
    const json = await res.json()
    if (!json?.success || !json.data?.broadcast) throw new Error('Invalid response format from server')
    return json.data.broadcast
}

export function markMatchLive(target: BroadcastTarget): Promise<MatchBroadcast> {
    return broadcastWrite(target, '/live', 'POST')
}

export function clearMatchLive(target: BroadcastTarget): Promise<MatchBroadcast> {
    return broadcastWrite(target, '/live', 'DELETE')
}

export function adjustMapScore(target: BroadcastTarget, ordinal: number, side: StreamSide, delta: 1 | -1): Promise<MatchBroadcast> {
    return broadcastWrite(target, '/score/overrides', 'POST', { ordinal, side, delta })
}

export function clearScoreOverrides(target: BroadcastTarget): Promise<MatchBroadcast> {
    return broadcastWrite(target, '/score/overrides', 'DELETE')
}

export function moveCountdown(target: BroadcastTarget, change: CountdownChange): Promise<MatchBroadcast> {
    return broadcastWrite(target, '/countdown', 'PUT', change)
}

export function clearCountdown(target: BroadcastTarget): Promise<MatchBroadcast> {
    return broadcastWrite(target, '/countdown', 'DELETE')
}
