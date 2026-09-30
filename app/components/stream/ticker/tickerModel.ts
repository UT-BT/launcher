import { parseApiInstant } from '@/app/utils/timezone'
import { sceneTimeText } from '../sceneHelpers'
import { TICKER_SET_MS } from './tickerTiming'
import { channelText, teamName, type FeedMatch, type FeedPredictor, type FeedResult, type StreamFeed } from './streamFeed'

const RESULT_LIMIT = 2
const UPCOMING_LIMIT = 2
const PREDICTOR_LIMIT = 3
const UNSCHEDULED_TEXT = 'time TBD'

export type TickerSetKind = 'results' | 'upcoming' | 'predictors' | 'next'

export type TickerItem =
    | { kind: 'result'; key: string; teams: [string, string]; score: string; where: string }
    | { kind: 'upcoming'; key: string; when: string; teams: [string, string]; channel: string | null }
    | { kind: 'predictor'; key: string; rank: number; userId: string; alias: string; profit: string }
    | { kind: 'next'; key: string; when: string; teams: [string, string]; channel: string | null }

export interface TickerSet {
    kind: TickerSetKind
    tag: string
    items: TickerItem[]
}

export interface TickerRotation {
    index: number
    set: TickerSet
}

function teamsOf(match: FeedMatch): [string, string] {
    return [teamName(match.teams.a), teamName(match.teams.b)]
}

function signedCoins(value: number): string {
    const sign = value > 0 ? '+' : value < 0 ? '−' : ''
    return `${sign}${Math.round(Math.abs(value)).toLocaleString('en-US')}`
}

function resultItem(result: FeedResult): TickerItem {
    return {
        kind: 'result',
        key: result.id,
        teams: teamsOf(result),
        score: `${result.score.a ?? 0}–${result.score.b ?? 0}`,
        where: [result.stage.name, result.round.label].filter(Boolean).join(' · '),
    }
}

function matchItem(kind: 'upcoming' | 'next', match: FeedMatch, now: number): TickerItem | null {
    const when = sceneTimeText(match.scheduled_at, now) ?? (kind === 'next' && match.scheduled_at === null ? UNSCHEDULED_TEXT : null)
    if (when === null) return null
    return { kind, key: match.id, when, teams: teamsOf(match), channel: channelText(match.stream_url) }
}

function predictorItem(row: FeedPredictor): TickerItem {
    return {
        kind: 'predictor',
        key: row.user_id,
        rank: row.rank,
        userId: row.user_id,
        alias: row.alias ?? 'Predictor',
        profit: signedCoins(row.profit),
    }
}

function present(items: (TickerItem | null)[]): TickerItem[] {
    return items.filter((item): item is TickerItem => item !== null)
}

function byTime(left: FeedMatch, right: FeedMatch): number {
    return (parseApiInstant(left.scheduled_at) ?? 0) - (parseApiInstant(right.scheduled_at) ?? 0)
}

export function tickerSets(feed: StreamFeed | null, now: number): TickerSet[] {
    if (!feed) return []
    const sets: TickerSet[] = [
        { kind: 'results', tag: "Today's results", items: [...feed.results].sort(byTime).slice(-RESULT_LIMIT).map(resultItem) },
        {
            kind: 'upcoming',
            tag: 'Coming up',
            items: present([...feed.upcoming].sort(byTime).map(match => matchItem('upcoming', match, now))).slice(0, UPCOMING_LIMIT),
        },
        { kind: 'predictors', tag: 'Top predictors', items: (feed.top_predictors ?? []).slice(0, PREDICTOR_LIMIT).map(predictorItem) },
        { kind: 'next', tag: 'Next on this channel', items: present([feed.next_match ? matchItem('next', feed.next_match, now) : null]) },
    ]
    return sets.filter(set => set.items.length > 0)
}

export function tickerRotation(sets: TickerSet[], now: number): TickerRotation | null {
    if (sets.length === 0) return null
    const index = Math.floor(now / TICKER_SET_MS) % sets.length
    return { index, set: sets[index] }
}
