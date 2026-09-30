import { streamApiPath } from '../data/streamHotState'

export type FeedSide = 'a' | 'b'

export interface FeedTeam {
    id: string
    name: string
}

export interface FeedMatch {
    id: string
    stage: { key: string; name: string }
    round: { no: number | null; label: string | null }
    status: string
    scheduled_at: string | null
    stream_url: string | null
    teams: { a: FeedTeam | null; b: FeedTeam | null }
}

export interface FeedResult extends FeedMatch {
    score: { a: number | null; b: number | null }
    winner: FeedSide | null
}

export interface FeedPredictor {
    rank: number
    user_id: string
    alias: string | null
    profit: number
}

export interface StreamFeed {
    server_now: string
    event: { name: string; slug: string }
    results: FeedResult[]
    upcoming: FeedMatch[]
    top_predictors: FeedPredictor[] | null
    next_match: FeedMatch | null
}

export function streamFeedPath(eventSlug: string, streamerId: string): string {
    return streamApiPath(eventSlug, `/feed?streamer=${encodeURIComponent(streamerId)}`)
}

export function channelText(streamUrl: string | null): string | null {
    if (!streamUrl) return null
    const text = streamUrl.trim().replace(/^https?:\/\/(www\.)?/i, '').replace(/\/+$/, '')
    return text === '' ? null : text
}

export function teamName(team: FeedTeam | null): string {
    return team?.name ?? 'TBD'
}
