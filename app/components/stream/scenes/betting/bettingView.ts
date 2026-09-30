import type { RawActiveTitle } from '@/app/utils/api'
import { parseApiInstant } from '@/app/utils/timezone'
import type { StreamMatch, StreamSide } from '../../data/streamHotState'
import { relativeTimeText, sceneTimeText, utcTimeText } from '../../sceneHelpers'
import type { BettingBacker, BettingLeaderboardRow, BettingRead, BettingResult, BettingSide } from './bettingRead'

const BACKER_ROWS = 5
const BACKER_ROWS_WITH_DRAW = 4
const LEADERBOARD_ROWS = 5
const MINUS = '−'

export type BettingTone = 'emerald' | 'amber' | 'sky' | 'neutral'
export type BettingVerdict = 'won' | 'lost'
export type BettingPayoutChip = 'Pending' | 'Paid' | 'Refunded'
export type BettingColumns = 'locked' | 'result'

export interface BettingStatus {
    chip: string
    tone: BettingTone
    text: string
}

export interface OddsSide {
    side: StreamSide | 'draw'
    name: string
    label: string | null
    percent: number
    odds: string
    share: number
}

export interface BackerRow {
    userId: string
    name: string
    stake: number
    payout: number
    multiplier: string
    biggest: boolean
    profit: number | null
    payoutChip: BettingPayoutChip | null
}

export interface BackerList {
    side: StreamSide
    name: string
    odds: string
    backers: number
    staked: number
    verdict: BettingVerdict | null
    rows: BackerRow[]
    more: { count: number; stake: number } | null
}

export interface DrawLine {
    odds: string
    backers: number
    staked: number
    verdict: BettingVerdict | null
    biggest: BackerRow | null
}

export interface PredictorRow {
    rank: number
    userId: string
    name: string
    title: RawActiveTitle | null
    profit: number
    correct: string
}

export type BettingPositionsKind = 'closed' | 'awaiting' | 'paying-out' | 'settled' | 'voided'

export type BettingView =
    | { kind: 'not-enabled' }
    | { kind: 'no-market'; leaderboard: PredictorRow[] }
    | {
        kind: 'open'
        status: BettingStatus
        kicker: string | null
        totals: string
        odds: OddsSide[]
        pool: number
        predictions: number
        closes: { value: string; sub: string }
        leaderboard: PredictorRow[]
    }
    | {
        kind: BettingPositionsKind
        status: BettingStatus
        columns: BettingColumns
        a: BackerList
        b: BackerList
        draw: DrawLine | null
        leaderboard: PredictorRow[]
    }

export function coins(value: number): string {
    return Math.round(value).toLocaleString('en-US')
}

export function signedCoins(value: number): string {
    if (value > 0) return `+${coins(value)}`
    if (value < 0) return `${MINUS}${coins(-value)}`
    return '0'
}

export function plural(count: number, one: string, many: string): string {
    return `${coins(count)} ${count === 1 ? one : many}`
}

function oddsText(odds: number): string {
    return odds.toFixed(2)
}

function teamName(side: BettingSide, fallback: string): string {
    return side.team?.name ?? fallback
}

function userName(displayName: string | null): string {
    return displayName ?? 'Unknown'
}

function stakeOf(backers: BettingBacker[]): number {
    return backers.reduce((sum, backer) => sum + backer.stake, 0)
}

function sideTotals(side: BettingSide): { backers: number; staked: number } {
    return { backers: side.count ?? side.backers.length, staked: side.stake ?? stakeOf(side.backers) }
}

function predictorRows(rows: BettingLeaderboardRow[]): PredictorRow[] {
    return rows.slice(0, LEADERBOARD_ROWS).map(row => ({
        rank: row.rank,
        userId: row.user_id,
        name: userName(row.display_name),
        title: row.title,
        profit: row.profit,
        correct: `${row.positions_won} / ${row.positions_won + row.positions_lost}`,
    }))
}

function isOfficial(result: BettingResult | null): result is BettingResult {
    return result?.status === 'official'
}

function payoutChipOf(backer: BettingBacker): BettingPayoutChip | null {
    if (backer.outcome === 'lost' || backer.outcome === null || backer.payout_state === null) return null
    if (backer.payout_state === 'pending') return 'Pending'
    return backer.outcome === 'refunded' ? 'Refunded' : 'Paid'
}

function backerRow(backer: BettingBacker, columns: BettingColumns): BackerRow {
    return {
        userId: backer.user_id,
        name: userName(backer.display_name),
        stake: backer.stake,
        payout: backer.payout,
        multiplier: `${backer.multiplier.toFixed(2)}x`,
        biggest: backer.biggest,
        profit: columns === 'result' ? backer.profit : null,
        payoutChip: columns === 'result' ? payoutChipOf(backer) : null,
    }
}

function shownBackers(backers: BettingBacker[], limit: number): BettingBacker[] {
    const shown = backers.slice(0, limit)
    const biggest = backers.find(backer => backer.biggest)
    if (!biggest || shown.includes(biggest)) return shown
    return [...shown.slice(0, limit - 1), biggest]
}

function sideVerdict(result: BettingResult | null, side: StreamSide | 'draw'): BettingVerdict | null {
    if (!isOfficial(result) || result.refunded || result.outcome === null || result.outcome === 'void') return null
    return result.outcome === side ? 'won' : 'lost'
}

function backerList(side: BettingSide, key: StreamSide, name: string, limit: number, columns: BettingColumns, result: BettingResult | null): BackerList {
    const shown = shownBackers(side.backers, limit)
    const { backers, staked } = sideTotals(side)
    const moreCount = backers - shown.length
    return {
        side: key,
        name,
        odds: oddsText(side.odds),
        backers,
        staked,
        verdict: sideVerdict(result, key),
        rows: shown.map(backer => backerRow(backer, columns)),
        more: moreCount > 0 ? { count: moreCount, stake: staked - stakeOf(shown) } : null,
    }
}

function drawLine(side: BettingSide, columns: BettingColumns, result: BettingResult | null): DrawLine {
    const biggest = side.backers.find(backer => backer.biggest)
    return {
        odds: oddsText(side.odds),
        ...sideTotals(side),
        verdict: sideVerdict(result, 'draw'),
        biggest: biggest ? backerRow(biggest, columns) : null,
    }
}

function oddsLabel(price: number, other: number): string {
    if (price === other) return 'Even'
    return price > other ? 'Favourite' : 'Underdog'
}

function oddsSide(side: BettingSide, key: OddsSide['side'], name: string, label: string | null): OddsSide {
    return { side: key, name, label, percent: Math.round(side.price * 100), odds: oddsText(side.odds), share: side.price }
}

function closesText(closesAt: string | null, now: number): { value: string; sub: string } {
    const at = parseApiInstant(closesAt)
    return { value: 'Pick/ban start', sub: at === null ? 'or when the match goes live' : `or ${utcTimeText(at, now)} at the latest` }
}

function resultHeadline(result: BettingResult, a: string, b: string): string {
    if (result.refunded) return result.reason ?? 'No winner'
    if (result.outcome === 'a') return `${a} won`
    if (result.outcome === 'b') return `${b} won`
    return 'Draw'
}

function positionsKind(read: BettingRead, liveDecided: boolean): BettingPositionsKind {
    if (read.state === 'voided') return 'voided'
    if ((read.state === 'resolved' || read.state === 'settled') && isOfficial(read.result)) {
        return read.state === 'resolved' ? 'paying-out' : 'settled'
    }
    return liveDecided || read.state !== 'closed' ? 'awaiting' : 'closed'
}

function positionsStatus(kind: BettingPositionsKind, read: BettingRead, a: string, b: string, now: number): BettingStatus {
    const versus = `${a} vs ${b}`
    const result = read.result
    if (kind === 'closed') return { chip: 'Market closed', tone: 'neutral', text: `${versus} · match underway` }
    if (kind === 'awaiting' || !result) return { chip: 'Awaiting result', tone: 'amber', text: `${versus} · waiting for the official result` }
    if (kind === 'voided') return { chip: 'Voided', tone: 'neutral', text: `${result.reason ?? 'Market voided'} · all stakes refunded` }
    const headline = resultHeadline(result, a, b)
    if (kind === 'settled') return { chip: 'Settled', tone: 'emerald', text: `${headline} · ${result.refunded ? 'all stakes refunded' : 'all payouts paid'}` }
    const settlesAt = parseApiInstant(read.market?.settles_at ?? null)
    const hold = settlesAt !== null && settlesAt > now ? `${utcTimeText(settlesAt, now)} · ${relativeTimeText(settlesAt, now)}` : null
    const pending = result.refunded ? 'refunds pending' : 'payouts pending'
    return { chip: 'Paying out', tone: 'sky', text: `${headline} · ${pending}${hold ? `, the settlement hold ends ${hold}` : ''}` }
}

export function bettingView(read: BettingRead, match: Pick<StreamMatch, 'scheduled_at' | 'score'>, now: number): BettingView {
    if (read.state === 'not_enabled') return { kind: 'not-enabled' }
    const leaderboard = predictorRows(read.leaderboard)
    const { market, sides } = read
    if (read.state === 'no_market' || !market || !sides) return { kind: 'no-market', leaderboard }

    const a = teamName(sides.a, 'Team A')
    const b = teamName(sides.b, 'Team B')
    const draw = market.draws_allowed ? sides.draw : null

    if (read.state === 'open' || !read.positions_visible) {
        return {
            kind: 'open',
            status: { chip: 'Market open', tone: 'emerald', text: `${a} vs ${b}` },
            kicker: sceneTimeText(match.scheduled_at, now),
            totals: `${plural(market.pool, 'coin', 'coins')} · ${plural(market.predictions, 'prediction', 'predictions')}`,
            odds: [
                oddsSide(sides.a, 'a', a, oddsLabel(sides.a.price, sides.b.price)),
                ...(draw ? [oddsSide(draw, 'draw', 'Draw', null)] : []),
                oddsSide(sides.b, 'b', b, oddsLabel(sides.b.price, sides.a.price)),
            ],
            pool: market.pool,
            predictions: market.predictions,
            closes: closesText(market.closes_at, now),
            leaderboard,
        }
    }

    const kind = positionsKind(read, match.score.live_decided)
    const columns: BettingColumns = kind === 'closed' || kind === 'awaiting' ? 'locked' : 'result'
    const limit = draw ? BACKER_ROWS_WITH_DRAW : BACKER_ROWS
    const result = columns === 'result' ? read.result : null
    return {
        kind,
        status: positionsStatus(kind, read, a, b, now),
        columns,
        a: backerList(sides.a, 'a', a, limit, columns, result),
        b: backerList(sides.b, 'b', b, limit, columns, result),
        draw: draw ? drawLine(draw, columns, result) : null,
        leaderboard,
    }
}
