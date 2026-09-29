import type { PickBanActor, RawActiveTitle } from '@/app/utils/api'
import { parseApiInstant } from '@/app/utils/timezone'
import type { StreamMatch, StreamSide, StreamTeam, StreamUserRef } from '../../data/streamHotState'
import { formatLabel, relativeTimeText, stageLine, utcTimeText } from '../../sceneHelpers'
import { channelText, teamName, type FeedMatch, type FeedResult } from '../../ticker/streamFeed'
import type { BettingSidePrice, StartingSoonBetting, StartingSoonFeed } from './startingSoonReads'

const SECOND_MS = 1_000
const ALSO_TODAY_ROWS = 5
const ALSO_TODAY_RESULT_ROWS = 2
const CUE_LATE_LIMIT_MS = 5_000
const HIDDEN_ODDS_STATES: ReadonlySet<StartingSoonBetting['state']> = new Set(['not_enabled', 'no_market'])

export interface CountdownView {
    state: 'future' | 'passed' | 'unscheduled'
    label: string
    headline: string
    utc: string | null
    relative: string | null
}

export interface SoonPlayer {
    id: string
    name: string
    title: RawActiveTitle | null
}

export interface SoonTeam {
    side: StreamSide
    ab: PickBanActor
    name: string | null
    seed: number | null
    players: SoonPlayer[]
}

export interface OddsShare {
    percent: string
    odds: string
    share: number
}

export interface OddsView {
    a: OddsShare
    b: OddsShare
    draw: OddsShare | null
    summary: string
}

export interface AlsoTodayRow {
    id: string
    time: string
    relative: string
    a: string
    b: string
    score: string | null
    where: string
    note: { kind: 'final' | 'channel' | 'none'; text: string }
}

export interface StartingSoonView {
    kicker: string | null
    countdown: CountdownView
    stage: string
    format: string
    teams: [SoonTeam, SoonTeam]
    odds: OddsView | null
    alsoToday: AlsoTodayRow[]
}

export interface StartingSoonInput {
    match: StreamMatch
    betting: StartingSoonBetting | null
    feed: StartingSoonFeed | null
    now: number
}

export interface CountdownMark {
    matchId: string
    target: number | null
    now: number
}

function countdownTarget(match: Pick<StreamMatch, 'countdown_at' | 'scheduled_at'>): number | null {
    return parseApiInstant(match.countdown_at ?? match.scheduled_at)
}

function twoDigits(value: number): string {
    return String(value).padStart(2, '0')
}

function clockText(remainingMs: number): string {
    const seconds = Math.ceil(remainingMs / SECOND_MS)
    return `${Math.floor(seconds / 3600)}:${twoDigits(Math.floor((seconds % 3600) / 60))}:${twoDigits(seconds % 60)}`
}

function countdownView(target: number | null, now: number): CountdownView {
    if (target === null) return { state: 'unscheduled', label: 'Match starts', headline: 'Soon', utc: null, relative: null }
    const utc = utcTimeText(target, now)
    if (target <= now) return { state: 'passed', label: 'Match starts', headline: 'Any moment', utc, relative: null }
    return { state: 'future', label: 'Match starts in', headline: clockText(target - now), utc, relative: relativeTimeText(target, now) }
}

function kickerOf(countdown: CountdownView): string | null {
    if (countdown.utc === null) return null
    return `${countdown.utc} · ${countdown.relative ?? 'starting any moment'}`
}

function playerOf(ref: StreamUserRef, team: StreamTeam | null): SoonPlayer | null {
    if (ref.id === null) return null
    const member = team?.members.find(candidate => candidate.id === ref.id)
    return { id: ref.id, name: ref.display_name ?? member?.display_name ?? ref.id, title: member?.title ?? null }
}

function playersOf(match: StreamMatch, side: StreamSide): SoonPlayer[] {
    const team = match.teams[side]
    const lineup = [match.lineup[`${side}1`], match.lineup[`${side}2`]]
        .filter((ref): ref is StreamUserRef => ref !== null)
        .map(ref => playerOf(ref, team))
        .filter((player): player is SoonPlayer => player !== null)
    if (lineup.length > 0 || team === null) return lineup
    return team.members.map(member => ({ id: member.id, name: member.display_name ?? member.id, title: member.title }))
}

function teamOf(match: StreamMatch, side: StreamSide): SoonTeam {
    const team = match.teams[side]
    return {
        side,
        ab: side === 'a' ? 'A' : 'B',
        name: team?.name ?? null,
        seed: team?.stage_seed ?? null,
        players: playersOf(match, side),
    }
}

function countText(count: number, one: string, many: string): string {
    return `${count.toLocaleString('en-US')} ${count === 1 ? one : many}`
}

function oddsShare(side: BettingSidePrice, total: number): OddsShare {
    return { percent: `${Math.round(side.price * 100)}%`, odds: side.odds.toFixed(2), share: total > 0 ? side.price / total : 0 }
}

function oddsView(betting: StartingSoonBetting | null): OddsView | null {
    if (!betting || HIDDEN_ODDS_STATES.has(betting.state) || !betting.sides || !betting.market) return null
    const { a, b, draw } = betting.sides
    const total = a.price + b.price + (draw?.price ?? 0)
    return {
        a: oddsShare(a, total),
        b: oddsShare(b, total),
        draw: draw ? oddsShare(draw, total) : null,
        summary: `${countText(betting.market.predictions, 'prediction', 'predictions')} · ${countText(betting.market.pool, 'coin', 'coins')} in the pool`,
    }
}

function utcClock(at: number): string {
    const date = new Date(at)
    return `${twoDigits(date.getUTCHours())}:${twoDigits(date.getUTCMinutes())} UTC`
}

function isResult(row: FeedMatch | FeedResult): row is FeedResult {
    return 'score' in row
}

function scoreText(row: FeedResult): string | null {
    const { a, b } = row.score
    return a === null || b === null ? null : `${a}–${b}`
}

function noteOf(row: FeedMatch | FeedResult): AlsoTodayRow['note'] {
    if (isResult(row)) return { kind: 'final', text: row.status === 'forfeit' ? 'Forfeit' : 'Final' }
    const channel = channelText(row.stream_url)
    if (channel) return { kind: 'channel', text: channel }
    return { kind: 'none', text: 'Not streamed' }
}

function alsoTodayRow(row: FeedMatch | FeedResult, at: number, now: number): AlsoTodayRow {
    return {
        id: row.id,
        time: utcClock(at),
        relative: relativeTimeText(at, now),
        a: teamName(row.teams.a),
        b: teamName(row.teams.b),
        score: isResult(row) ? scoreText(row) : null,
        where: [row.stage.name, row.round.label].filter(Boolean).join(' · '),
        note: noteOf(row),
    }
}

function timed<T extends FeedMatch>(rows: T[], excludeId: string): { row: T; at: number }[] {
    return rows
        .filter(row => row.id !== excludeId)
        .map(row => ({ row, at: parseApiInstant(row.scheduled_at) }))
        .filter((entry): entry is { row: T; at: number } => entry.at !== null)
        .sort((left, right) => left.at - right.at)
}

function alsoTodayRows(feed: StartingSoonFeed | null, matchId: string, now: number): AlsoTodayRow[] {
    if (!feed) return []
    const results = timed<FeedMatch | FeedResult>(feed.results, matchId)
    const upcoming = timed<FeedMatch | FeedResult>(feed.upcoming, matchId)
    const upcomingCount = Math.min(upcoming.length, ALSO_TODAY_ROWS - Math.min(results.length, ALSO_TODAY_RESULT_ROWS))
    const resultCount = Math.min(results.length, ALSO_TODAY_ROWS - upcomingCount)
    return [...results.slice(results.length - resultCount), ...upcoming.slice(0, upcomingCount)].map(({ row, at }) => alsoTodayRow(row, at, now))
}

export function startingSoonView({ match, betting, feed, now }: StartingSoonInput): StartingSoonView {
    const countdown = countdownView(countdownTarget(match), now)
    return {
        kicker: kickerOf(countdown),
        countdown,
        stage: stageLine(match),
        format: formatLabel(match),
        teams: [teamOf(match, 'a'), teamOf(match, 'b')],
        odds: oddsView(betting),
        alsoToday: alsoTodayRows(feed, match.id, now),
    }
}

export function countdownMarkOf(match: Pick<StreamMatch, 'id' | 'countdown_at' | 'scheduled_at'>, now: number): CountdownMark {
    return { matchId: match.id, target: countdownTarget(match), now }
}

function sameCountdown(left: CountdownMark | null, right: CountdownMark): boolean {
    return left !== null && left.matchId === right.matchId && left.target === right.target
}

export function countdownCueDue(previous: CountdownMark | null, next: CountdownMark, played: CountdownMark | null = null): boolean {
    if (previous === null || next.target === null) return false
    if (!sameCountdown(previous, next) || sameCountdown(played, next)) return false
    return previous.now < next.target && next.now >= next.target && next.now - next.target <= CUE_LATE_LIMIT_MS
}
