import { apiRequest } from '@/app/utils/api'
import { streamDeskError } from '../../streamDesk'
import type { StreamWinnerOverride } from '../../streamDesk'

export interface MapScoreState {
    a: number | null
    b: number | null
    winner: StreamWinnerOverride
}

export interface MatchBroadcast {
    match_id: string
    live_at: string | null
    countdown_override_at: string | null
    countdown_at: string | null
    score_state: Record<string, MapScoreState>
    live_counting: boolean
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

export function setMapScore(target: BroadcastTarget, ordinal: number, state: MapScoreState): Promise<MatchBroadcast> {
    return broadcastWrite(target, `/score/maps/${ordinal}`, 'PUT', { a: state.a, b: state.b, winner: state.winner })
}

export function resetMapScore(target: BroadcastTarget, ordinal: number): Promise<MatchBroadcast> {
    return broadcastWrite(target, `/score/maps/${ordinal}`, 'DELETE')
}

export function resetAllMapScores(target: BroadcastTarget): Promise<MatchBroadcast> {
    return broadcastWrite(target, '/score/maps', 'DELETE')
}

export function setLiveCounting(target: BroadcastTarget, enabled: boolean): Promise<MatchBroadcast> {
    return broadcastWrite(target, '/score/live-counting', 'PUT', { enabled })
}

export function moveCountdown(target: BroadcastTarget, change: CountdownChange): Promise<MatchBroadcast> {
    return broadcastWrite(target, '/countdown', 'PUT', change)
}

export function clearCountdown(target: BroadcastTarget): Promise<MatchBroadcast> {
    return broadcastWrite(target, '/countdown', 'DELETE')
}
