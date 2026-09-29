import type { EventMatchMode, PickBanSessionStatus, RawActiveTitle } from '@/app/utils/api'
import { readConditional, type ConditionalReadOptions } from './conditionalRead'

export type StreamSide = 'a' | 'b'
export type BracketSide = 'a' | 'b'
export type StreamReason = 'current' | 'live' | 'holding-finished' | 'next' | 'none'
export type StreamScoreSource = 'official' | 'live' | 'override'
export type StreamLineupSlot = 'a1' | 'a2' | 'b1' | 'b2'

export interface StreamUserRef {
    id: string | null
    display_name: string | null
    avatar: string | null
}

export interface StreamTeamMember {
    id: string
    display_name: string | null
    avatar: string
    title: RawActiveTitle | null
    captain: boolean
}

export interface StreamTeam {
    id: string
    name: string
    match_side: BracketSide
    stage_seed: number | null
    pre_cup_seed: number | null
    members: StreamTeamMember[]
}

export interface StreamMatchMap {
    ordinal: number
    map: string
    kind: string
    picked_by: StreamSide | null
}

export interface StreamMapScore {
    ordinal: number
    caps: { a: number | null; b: number | null }
    decided: boolean
    winner: StreamSide | null
    source: StreamScoreSource
}

export interface StreamScore {
    maps: StreamMapScore[]
    current_map: number | null
    series: { a: number; b: number }
    winner: StreamSide | null
    live_decided: boolean
}

export interface StreamMatch {
    id: string
    reason: StreamReason
    stage: { key: string; name: string }
    group: { id: string; name: string } | null
    round: { no: number | null; label: string | null }
    best_of: number
    mode: EventMatchMode
    caps_to_win: number | null
    scheduled_at: string | null
    countdown_at: string | null
    live_at: string | null
    status: string
    stream_url: string | null
    pick_ban_status: PickBanSessionStatus
    sides: { a: BracketSide; b: BracketSide }
    teams: { a: StreamTeam | null; b: StreamTeam | null }
    lineup: Record<StreamLineupSlot, StreamUserRef | null>
    maps: StreamMatchMap[]
    score: StreamScore
    casters: StreamUserRef[]
}

export interface StreamHotState {
    server_now: string
    event: { name: string; slug: string }
    streamer: { id: string; display_name: string | null; channel: string | null }
    desk: { brb_message: string | null; webcam_enabled: boolean }
    reason: StreamReason
    match: StreamMatch | null
}

export type StreamHotStateRead =
    | { kind: 'unchanged'; serverNow: string | null }
    | { kind: 'fresh'; state: StreamHotState; etag: string | null; serverNow: string | null }

export function streamApiPath(eventSlug: string, suffix: string): string {
    return `/tournaments/${encodeURIComponent(eventSlug)}/stream${suffix}`
}

export function streamHotStatePath(eventSlug: string, streamerId: string): string {
    return streamApiPath(eventSlug, `/${encodeURIComponent(streamerId)}/state`)
}

export function streamMatchReadPath(eventSlug: string, matchId: string, read: string): string {
    return streamApiPath(eventSlug, `/matches/${encodeURIComponent(matchId)}/${read}`)
}

function isHotState(data: object): data is StreamHotState {
    const record = data as { [key: string]: unknown }
    return typeof record.reason === 'string' && typeof record.event === 'object' && record.event !== null && 'match' in record
}

export async function fetchStreamHotState(
    eventSlug: string,
    streamerId: string,
    opts: ConditionalReadOptions = {},
): Promise<StreamHotStateRead> {
    const read = await readConditional(streamHotStatePath(eventSlug, streamerId), opts)
    if (read.kind === 'unchanged') return read
    if (!isHotState(read.data)) throw new Error('Invalid response format from server')
    return { kind: 'fresh', state: read.data, etag: read.etag, serverNow: read.data.server_now || read.serverNow }
}
