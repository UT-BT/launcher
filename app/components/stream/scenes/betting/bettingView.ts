import { parseApiInstant } from '@/app/utils/timezone'
import type { StreamMatch, StreamSide } from '../../data/streamHotState'
import { relativeTimeText, sceneTimeText, utcTimeText } from '../../sceneHelpers'
import type { BettingBacker, BettingRead, BettingResult, BettingSide } from './bettingRead'
import { bettingLayout, chipWidth, columnMajor, headWidth, numberWidth, type BettingChipLabel, type BettingLayout } from './bettingLayout'

const MINUS = '−'
const DASH = '—'

export type BettingTone = 'emerald' | 'amber' | 'sky' | 'neutral'
export type BettingVerdict = 'won' | 'lost'
export type BettingPayoutChip = BettingChipLabel
export type BettingColumns = 'locked' | 'result'
export type BettingGroupKey = StreamSide | 'draw'

export interface BettingStatus {
    chip: string
    tone: BettingTone
    text: string
}

export interface OddsSide {
    side: BettingGroupKey
    name: string
    label: string | null
    percent: number
    odds: string
    share: number
}

export interface BackerRow {
    userId: string
    name: string
    biggest: boolean
    tone: BettingVerdict | null
    stake: string
    payout: string
    multiplier: string
    profit: number | null
    payoutChip: BettingPayoutChip | null
}

export type BettingSlot =
    | { kind: 'backer'; row: BackerRow }
    | { kind: 'note'; text: string }

export interface BettingGroup {
    side: BettingGroupKey
    name: string
    meta: string
    verdict: BettingVerdict | null
    columns: BettingSlot[][]
}

export interface BettingFit {
    rowHeight: number
    columnWidth: number
    avatarZoom: boolean
    primary: number
    secondary: number
    chip: number
}

export interface BettingCells {
    stake: number
    payout: number
    multiplier: number | null
    profit: number
    chip: number
}

export type BettingPositionsKind = 'closed' | 'awaiting' | 'paying-out' | 'settled' | 'voided'

export type BettingView =
    | { kind: 'not-enabled' }
    | { kind: 'no-market' }
    | {
        kind: 'open'
        status: BettingStatus
        kicker: string | null
        totals: string
        odds: OddsSide[]
        pool: number
        predictions: number
        closes: { value: string; sub: string }
    }
    | {
        kind: BettingPositionsKind
        status: BettingStatus
        columns: BettingColumns
        legend: boolean
        fit: BettingFit
        cells: BettingCells
        groups: BettingGroup[]
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

function oddsText(odds: number | null): string {
    return odds === null ? DASH : odds.toFixed(2)
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

function sideMeta(side: BettingSide): string {
    const backers = side.count ?? side.backers.length
    const staked = side.stake ?? stakeOf(side.backers)
    return `Odds ${oddsText(side.odds)} · ${plural(backers, 'bettor', 'bettors')} · ${coins(staked)} staked`
}

function isOfficial(result: BettingResult | null): result is BettingResult {
    return result?.status === 'official'
}

function payoutChipOf(backer: BettingBacker): BettingPayoutChip | null {
    if (backer.outcome === 'lost' || backer.outcome === null || backer.payout_state === null) return null
    if (backer.payout_state === 'pending') return 'Pending'
    return backer.outcome === 'refunded' ? 'Refunded' : 'Paid'
}

function resultPayout(backer: BettingBacker): string {
    if (backer.outcome === 'won') return coins(backer.payout)
    if (backer.outcome === 'refunded') return coins(backer.stake)
    return DASH
}

function backerRow(backer: BettingBacker, columns: BettingColumns, tone: BettingVerdict | null): BackerRow {
    const result = columns === 'result'
    return {
        userId: backer.user_id,
        name: userName(backer.display_name),
        biggest: backer.biggest,
        tone,
        stake: coins(backer.stake),
        payout: result ? resultPayout(backer) : coins(backer.payout),
        multiplier: backer.multiplier === null ? DASH : `${backer.multiplier.toFixed(2)}x`,
        profit: result ? backer.profit : null,
        payoutChip: result ? payoutChipOf(backer) : null,
    }
}

function shownBackers(backers: BettingBacker[], limit: number): BettingBacker[] {
    const shown = backers.slice(0, limit)
    const biggest = backers.find(backer => backer.biggest)
    if (!biggest || shown.includes(biggest)) return shown
    return [...shown.slice(0, limit - 1), biggest]
}

function sideVerdict(result: BettingResult | null, side: BettingGroupKey): BettingVerdict | null {
    if (!isOfficial(result) || result.refunded || result.outcome === null || result.outcome === 'void') return null
    return result.outcome === side ? 'won' : 'lost'
}

interface GroupSource {
    key: BettingGroupKey
    name: string
    side: BettingSide
}

function byStakeDescending(backers: BettingBacker[]): BettingBacker[] {
    return [...backers].sort((left, right) => right.stake - left.stake)
}

function bettingGroup(source: GroupSource, columnCount: number, limit: number, columns: BettingColumns, result: BettingResult | null): { group: BettingGroup; rows: BackerRow[] } {
    const verdict = sideVerdict(result, source.key)
    const backers = verdict === 'lost' ? byStakeDescending(source.side.backers) : source.side.backers
    const shown = shownBackers(backers, limit)
    const rows = shown.map(backer => backerRow(backer, columns, verdict))
    const slots: BettingSlot[] = rows.map(row => ({ kind: 'backer', row }))
    const hidden = backers.length - shown.length
    if (hidden > 0) slots.push({ kind: 'note', text: `+ ${coins(hidden)} more · ${coins(stakeOf(backers) - stakeOf(shown))} staked` })
    if (backers.length === 0) slots.push({ kind: 'note', text: 'No bettors on this outcome' })
    return {
        group: { side: source.key, name: source.name, meta: sideMeta(source.side), verdict, columns: columnMajor(slots, columnCount) },
        rows,
    }
}

function scenePayouts(backers: BettingBacker[], columns: BettingColumns): string[] {
    return backers.map(backer => (columns === 'result' ? resultPayout(backer) : coins(backer.payout)))
}

function bettingCells(backers: BettingBacker[], rows: BackerRow[], columns: BettingColumns, layout: BettingLayout): BettingCells {
    const { primary, secondary, chip, multiplier } = layout.density
    const all = backers.map(backer => backerRow(backer, columns, null))
    const stake = numberWidth(all.map(row => row.stake), secondary)
    const payout = numberWidth(scenePayouts(backers, columns), columns === 'result' ? secondary : primary)
    if (columns === 'locked') {
        return { stake, payout, multiplier: multiplier ? numberWidth(all.map(row => row.multiplier), secondary) : null, profit: 0, chip: 0 }
    }
    const chips = [...new Set(rows.flatMap(row => (row.payoutChip ? [row.payoutChip] : [])))]
    return { stake, payout, multiplier: null, profit: Math.max(numberWidth(backers.map(backer => signedCoins(backer.profit ?? 0)), primary), headWidth('Profit')), chip: chipWidth(chips, chip) }
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
    const { market, sides } = read
    if (read.state === 'no_market' || !market || !sides) return { kind: 'no-market' }

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
        }
    }

    const kind = positionsKind(read, match.score.live_decided)
    const columns: BettingColumns = kind === 'closed' || kind === 'awaiting' ? 'locked' : 'result'
    const result = columns === 'result' ? read.result : null
    const sources: GroupSource[] = [
        { key: 'a', name: a, side: sides.a },
        ...(draw ? [{ key: 'draw' as const, name: 'Draw', side: draw }] : []),
        { key: 'b', name: b, side: sides.b },
    ]
    const layout = bettingLayout(sources.map(source => source.side.backers.length))
    const built = sources.map((source, index) => bettingGroup(source, layout.groups[index].columns, layout.groups[index].shown, columns, result))
    const rows = built.flatMap(entry => entry.rows)
    const { rowHeight, columnWidth, avatarZoom, density } = layout
    return {
        kind,
        status: positionsStatus(kind, read, a, b, now),
        columns,
        legend: rows.some(row => row.biggest),
        fit: { rowHeight, columnWidth, avatarZoom, primary: density.primary, secondary: density.secondary, chip: density.chip },
        cells: bettingCells(sources.flatMap(source => source.side.backers), rows, columns, layout),
        groups: built.map(entry => entry.group),
    }
}
