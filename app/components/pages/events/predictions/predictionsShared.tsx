import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type {
    PredictionMarket, PredictionMarketStatus, PredictionOutcome, PredictionPositionStatus,
    PredictionSide,
} from '@/app/utils/api'

export const MARKET_STATUS_LABELS: Record<PredictionMarketStatus, string> = {
    open: 'Open',
    closed: 'Closed',
    resolved: 'Paying out',
    settled: 'Settled',
    voided: 'Refunded',
}

export const MARKET_STATUS_STYLES: Record<PredictionMarketStatus, string> = {
    open: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    closed: 'bg-white/5 text-muted-foreground border-white/10',
    resolved: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    settled: 'bg-accent-500/15 text-accent-300 border-accent-500/30',
    voided: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

export const POSITION_STATUS_LABELS: Record<PredictionPositionStatus, string> = {
    open: 'In play',
    won: 'Won',
    lost: 'Lost',
    refunded: 'Refunded',
}

export const POSITION_STATUS_STYLES: Record<PredictionPositionStatus, string> = {
    open: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    won: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    lost: 'bg-red-500/10 text-red-300/80 border-red-500/20',
    refunded: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
}

export function formatCoins(value: number | null | undefined): string {
    return Math.round(value ?? 0).toLocaleString()
}

export function formatSigned(value: number): string {
    return `${value > 0 ? '+' : ''}${formatCoins(value)}`
}

export function formatPercent(price: number | null | undefined): string {
    return `${Math.round((price ?? 0) * 100)}%`
}

/**
 * Decimal odds: what one staked coin comes back as in total if this side wins,
 * which is the inverse of its price.
 *
 * The primary number on every prediction surface. A price is what the market
 * believes; the odds are what the player is actually being offered, and only one
 * of those is a decision.
 *
 * `price_floor` bounds the opening prior, NOT a traded price, so a heavily backed
 * market can leave the other side at odds of several hundred. Long odds drop the
 * decimals and then cap, because the number stops being a decision long before it
 * stops growing and the column it sits in is fixed width.
 */
export function formatOdds(price: number | null | undefined): string {
    if (!price || price <= 0) return '—'

    const odds = 1 / price

    if (odds >= 1000) return '999+'
    if (odds >= 100) return String(Math.round(odds))

    return odds.toFixed(2)
}


export function formatMultiplier(stake: number, payout: number): string {
    if (!stake || !payout) return '—'
    return `${(payout / stake).toFixed(2)}x`
}

export function parseApiInstant(iso: string | null | undefined): number | null {
    if (!iso) return null
    const parsed = new Date(iso.includes('T') ? iso : `${iso.replace(' ', 'T')}Z`).getTime()
    return Number.isNaN(parsed) ? null : parsed
}

/**
 * One ticking clock for the whole tab, passed down as a value. A per-card timer
 * would run an interval for every market on the page.
 */
export function useNow(intervalMs = 1000): number {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), intervalMs)
        return () => clearInterval(timer)
    }, [intervalMs])

    return now
}

export function formatCountdown(target: string | null | undefined, now: number): string | null {
    const at = parseApiInstant(target)
    if (at === null) return null

    const remaining = Math.max(0, at - now)
    if (remaining === 0) return null

    const seconds = Math.floor(remaining / 1000)
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)

    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
}

/**
 * Which outcomes this market offers. A group match races to three maps of four
 * and can finish level, so the draw is a third thing to back; a knockout has to
 * produce a winner and offers two.
 */
export function sidesOf(market: PredictionMarket): PredictionSide[] {
    return market.draws_allowed ? ['a', 'draw', 'b'] : ['a', 'b']
}

export function priceOf(market: PredictionMarket, side: PredictionSide): number {
    if (side === 'a') return market.price_a
    if (side === 'b') return market.price_b
    return market.price_draw ?? 0
}

export function openingPriceOf(market: PredictionMarket, side: PredictionSide): number | null {
    if (side === 'a') return market.opening_price_a ?? null
    if (side === 'b') return market.opening_price_b ?? null
    return market.opening_price_draw ?? null
}

export function sideLabel(market: PredictionMarket, side: PredictionSide): string {
    if (side === 'draw') return 'Draw'
    if (side === 'a') return market.team_a?.name || 'Side A'
    return market.team_b?.name || 'Side B'
}

export const SIDE_TEXT_STYLES: Record<PredictionSide, string> = {
    a: 'text-accent-300',
    draw: 'text-sky-300',
    b: 'text-red-300/90',
}

export const SIDE_BAR_STYLES: Record<PredictionSide, string> = {
    a: 'bg-accent-400/80',
    draw: 'bg-sky-400/70',
    b: 'bg-red-500/50',
}

export function outcomeLabel(market: PredictionMarket): string | null {
    const outcome: PredictionOutcome | null = market.outcome
    if (!outcome) return null
    if (outcome === 'void') return 'Void — everyone refunded'
    if (outcome === 'draw') {
        return market.draws_allowed ? 'Drawn — the draw paid out' : 'Draw — everyone refunded'
    }
    const winner = outcome === 'a' ? market.team_a?.name : market.team_b?.name
    return winner ? `${winner} won` : 'Settled'
}

// Not `Chip` from bracketShared: it imports the odds chip below, closing a loop.
const CHIP_BASE =
    'shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border'

export function MarketStatusChip({ market }: { market: PredictionMarket }) {
    return (
        <span className={cn(CHIP_BASE, MARKET_STATUS_STYLES[market.status])}>
            {MARKET_STATUS_LABELS[market.status]}
        </span>
    )
}

/**
 * How far this market has moved from the odds it opened at, in points of
 * probability. Null while the server has sent no opening price.
 */
export function priceDrift(market: PredictionMarket, side: PredictionSide): number | null {
    const opened = openingPriceOf(market, side)

    return opened === null ? null : Math.round((priceOf(market, side) - opened) * 100)
}

export function CoinAmount({ value, className, signed }: {
    value: number
    className?: string
    signed?: boolean
}) {
    const tone = !signed ? '' : value > 0 ? 'text-emerald-300' : value < 0 ? 'text-red-300' : ''

    return (
        <span className={cn('tabular-nums', tone, className)}>
            {signed ? formatSigned(value) : formatCoins(value)}
        </span>
    )
}


const OddsContext = createContext<Map<string, PredictionMarket>>(new Map())

/**
 * Live prices keyed by match id, so a match card anywhere under here can show the
 * odds without every bracket view threading the market list down to it. Mirrors
 * how `EventRosterProvider` supplies team rosters.
 */
export function PredictionOddsProvider({ markets, children }: {
    markets: PredictionMarket[]
    children: ReactNode
}) {
    const byMatch = useMemo(() => {
        const lookup = new Map<string, PredictionMarket>()

        for (const market of markets) {
            if (market.match_id) lookup.set(market.match_id, market)
        }

        return lookup
    }, [markets])

    return <OddsContext.Provider value={byMatch}>{children}</OddsContext.Provider>
}

export function useMatchOdds(matchId: string | null | undefined): PredictionMarket | null {
    const lookup = useContext(OddsContext)

    return matchId ? lookup.get(matchId) ?? null : null
}

/**
 * Three numbers on a bracket card is already tight, so the percent signs go and
 * the middle number is the draw when there is one.
 */
export function MatchOddsChip({ matchId }: { matchId: string | null | undefined }) {
    const market = useMatchOdds(matchId)

    if (!market || market.status !== 'open') return null

    const parts = sidesOf(market).map(side => Math.round(priceOf(market, side) * 100))

    return (
        <span
            className={cn(CHIP_BASE, 'bg-accent-500/10 text-accent-300 border-accent-500/25 tabular-nums')}
            title={sidesOf(market).map(side => (
                `${sideLabel(market, side)} ${formatPercent(priceOf(market, side))}`
            )).join(' · ')}
        >
            {parts.join(' · ')}
        </span>
    )
}


/**
 * Where a HYPOTHETICAL even two-way market lands after one prediction of `stake`,
 * given liquidity `b`.
 *
 * A real market opens on the odds the event has decided, not on a coin flip, so
 * this is a yardstick rather than a prediction about any particular match. It
 * exists so a manager can be shown what a liquidity number actually DOES —
 * comparing two settings needs a fixed reference, and 50/50 is the only one that
 * does not move as the cup is played.
 */
export function evenMarketPriceAfter(stake: number, liquidity: number): number {
    if (!(stake > 0) || !(liquidity > 0)) return 0.5

    const x = 2 * Math.exp(stake / liquidity) - 1

    return x / (x + 1)
}

/** The inverse: the liquidity that moves that reference market to `price`. */
export function liquidityForPriceAfter(stake: number, price: number): number {
    const clamped = Math.min(0.95, Math.max(0.51, price))
    const x = clamped / (1 - clamped)

    return Math.round(stake / Math.log((x + 1) / 2))
}
