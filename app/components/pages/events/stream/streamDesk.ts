import { ApiError, apiRequest, type EventMatchStatus, type RawActiveTitle } from '@/app/utils/api'
import { createPoller, type PollerEnvironment } from '@/app/utils/poller'
import { addClockSample, clockSample, medianClockOffset } from '@/app/components/pages/events/pickban/clockOffset'

export const DESK_POLL_MS = 2_000

export type StreamSide = 'a' | 'b'
export type StreamReason = 'current' | 'live' | 'holding-finished' | 'next' | 'none'
export type StreamScoreSource = 'official' | 'live' | 'override'

export interface StreamPerson {
    id: string
    display_name: string | null
    avatar: string
}

export interface StreamMember extends StreamPerson {
    title: RawActiveTitle | null
    captain: boolean
}

export interface StreamTeam {
    id: string
    name: string
    match_side: StreamSide
    stage_seed: number | null
    pre_cup_seed: number | null
    members: StreamMember[]
}

export interface StreamCaster {
    id: string | null
    display_name: string | null
    avatar: string | null
}

export interface StreamMapScore {
    ordinal: number
    caps: { a: number; b: number }
    decided: boolean
    winner: StreamSide | null
    source: StreamScoreSource
}

export interface StreamMatch {
    id: string
    reason: StreamReason
    stage: { key: string; name: string }
    group: { id: string; name: string } | null
    round: { no: number; label: string | null }
    best_of: number
    mode: string
    caps_to_win: number
    scheduled_at: string | null
    countdown_at: string | null
    live_at: string | null
    status: EventMatchStatus
    stream_url: string | null
    pick_ban_status: string
    sides: { a: StreamSide; b: StreamSide }
    teams: { a: StreamTeam | null; b: StreamTeam | null }
    lineup: { a1: StreamPerson | null; a2: StreamPerson | null; b1: StreamPerson | null; b2: StreamPerson | null }
    maps: { ordinal: number; map: string | null; kind: string; picked_by: StreamSide | null }[]
    score: {
        maps: StreamMapScore[]
        current_map: number | null
        series: { a: number; b: number }
        winner: StreamSide | null
        live_decided: boolean
    }
    casters: StreamCaster[]
}

export interface StreamAssignedMatch {
    id: string
    stage: { key: string; name: string } | null
    group: { id: string; name: string } | null
    round: { no: number; label: string | null }
    best_of: number
    scheduled_at: string | null
    status: EventMatchStatus
    stream_url: string | null
    public: boolean
    finished: boolean
    teams: { a: { id: string; name: string } | null; b: { id: string; name: string } | null }
}

export interface StreamDesk {
    server_now: string
    event: { name: string; slug: string }
    streamer: { id: string; display_name: string | null; channel: string | null }
    desk: { brb_message: string | null; webcam_enabled: boolean; current_match_id: string | null }
    reason: StreamReason
    match: StreamMatch | null
    assigned_matches: StreamAssignedMatch[]
    next_match: StreamAssignedMatch | null
}

export type StreamDeskRead =
    | { kind: 'unchanged'; serverNow: string | null }
    | { kind: 'fresh'; desk: StreamDesk; etag: string | null; serverNow: string | null }

export function streamDeskPath(slug: string, streamerId: string, suffix = ''): string {
    return `/tournaments/${encodeURIComponent(slug)}/stream/${encodeURIComponent(streamerId)}/desk${suffix}`
}

export async function streamDeskError(res: Response): Promise<ApiError> {
    const body = await res.json().catch(() => null)
    return new ApiError(res.status, body?.error || body?.reason || undefined, `Request failed (${res.status})`, body?.code || undefined)
}

function isStreamDesk(value: unknown): value is StreamDesk {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false
    const desk = value as Partial<StreamDesk>
    return Array.isArray(desk.assigned_matches) && typeof desk.reason === 'string' && !!desk.desk && !!desk.streamer
}

export async function fetchStreamDesk(
    accessToken: string,
    slug: string,
    streamerId: string,
    opts: { etag?: string | null; signal?: AbortSignal } = {},
): Promise<StreamDeskRead> {
    const res = await apiRequest(streamDeskPath(slug, streamerId), {
        token: accessToken,
        signal: opts.signal,
        headers: opts.etag ? { 'If-None-Match': opts.etag } : {},
    })
    const headerServerNow = res.headers.get('X-Server-Now')
    if (res.status === 304) return { kind: 'unchanged', serverNow: headerServerNow }
    if (!res.ok) throw await streamDeskError(res)
    const json = await res.json()
    if (!json?.success || !isStreamDesk(json.data)) throw new Error('Invalid response format from server')
    return { kind: 'fresh', desk: json.data, etag: res.headers.get('ETag'), serverNow: json.data.server_now || headerServerNow }
}

export function insideObs(win: object | undefined): boolean {
    const obs = (win as { obsstudio?: unknown } | undefined)?.obsstudio
    return typeof obs === 'object' && obs !== null
}

export function deskPollActive(pageHidden: boolean, inObs: boolean): boolean {
    return inObs || !pageHidden
}

export function deskPollEnvironment(
    win: object | undefined = typeof window === 'undefined' ? undefined : window,
    doc: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'> | undefined =
        typeof document === 'undefined' ? undefined : document,
): PollerEnvironment {
    return {
        isVisible: () => deskPollActive(doc?.visibilityState === 'hidden', insideObs(win)),
        onVisibilityChange: (listener) => {
            if (!doc) return () => undefined
            doc.addEventListener('visibilitychange', listener)
            return () => doc.removeEventListener('visibilitychange', listener)
        },
    }
}

export interface StreamDeskSnapshot {
    desk: StreamDesk | null
    clockOffsetMs: number
    loading: boolean
    error: unknown
}

export interface StreamDeskStore {
    subscribe: (listener: () => void) => () => void
    getSnapshot: () => StreamDeskSnapshot
    start: () => void
    stop: () => void
    refresh: () => Promise<void>
}

export interface StreamDeskStoreOptions {
    slug: string
    streamerId: string
    accessToken: () => string
    environment?: PollerEnvironment
    now?: () => number
}

export function createStreamDeskStore({
    slug,
    streamerId,
    accessToken,
    environment = deskPollEnvironment(),
    now = Date.now,
}: StreamDeskStoreOptions): StreamDeskStore {
    const listeners = new Set<() => void>()
    let snapshot: StreamDeskSnapshot = { desk: null, clockOffsetMs: 0, loading: true, error: null }
    let etag: string | null = null
    let clockSamples: readonly number[] = []

    const publish = (patch: Partial<StreamDeskSnapshot>) => {
        const next = { ...snapshot, ...patch }
        if ((Object.keys(next) as (keyof StreamDeskSnapshot)[]).every(key => Object.is(next[key], snapshot[key]))) return
        snapshot = next
        for (const listener of listeners) listener()
    }

    const poller = createPoller({
        intervalMs: () => DESK_POLL_MS,
        environment,
        poll: async (signal) => {
            const sentAt = now()
            const read = await fetchStreamDesk(accessToken(), slug, streamerId, { etag, signal })
            if (signal.aborted) return
            clockSamples = addClockSample(clockSamples, clockSample(read.serverNow, sentAt, now()))
            if (read.kind === 'fresh') etag = read.etag
            publish({
                desk: read.kind === 'fresh' ? read.desk : snapshot.desk,
                clockOffsetMs: medianClockOffset(clockSamples),
                loading: false,
                error: null,
            })
        },
        onSettled: ({ ok, error }) => {
            if (!ok) publish({ loading: false, error })
        },
    })

    return {
        subscribe(listener) {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
        },
        getSnapshot: () => snapshot,
        start: poller.start,
        stop: poller.stop,
        refresh: poller.refresh,
    }
}
