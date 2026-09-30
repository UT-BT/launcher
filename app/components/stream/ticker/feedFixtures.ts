import { STREAM_EVENT, streamIso } from '../data/streamFixtures'
import type { FeedMatch, FeedPredictor, FeedResult, StreamFeed } from './streamFeed'

export function feedMatch(id: string, a: string, b: string, at: number | null, overrides: Partial<FeedMatch> = {}): FeedMatch {
    return {
        id,
        stage: { key: 'group', name: 'Group Stage' },
        round: { no: 4, label: 'Round 4' },
        status: 'scheduled',
        scheduled_at: at === null ? null : streamIso(at),
        stream_url: null,
        teams: { a: { id: `${id}-a`, name: a }, b: { id: `${id}-b`, name: b } },
        ...overrides,
    }
}

export function feedResult(id: string, a: string, b: string, at: number, score: [number, number], overrides: Partial<FeedResult> = {}): FeedResult {
    return {
        ...feedMatch(id, a, b, at, { status: 'complete' }),
        score: { a: score[0], b: score[1] },
        winner: score[0] === score[1] ? null : score[0] > score[1] ? 'a' : 'b',
        ...overrides,
    }
}

export function feedPredictor(rank: number, userId: string, alias: string, profit: number): FeedPredictor {
    return { rank, user_id: userId, alias, profit }
}

export function streamFeed(now: number, overrides: Partial<StreamFeed> = {}): StreamFeed {
    return {
        server_now: streamIso(now),
        event: STREAM_EVENT,
        results: [],
        upcoming: [],
        top_predictors: null,
        next_match: null,
        ...overrides,
    }
}
