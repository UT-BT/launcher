import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import type {
    PredictionMarket, PredictionMarketStatus, PredictionOutcome, PredictionPositionStatus,
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

export function outcomeLabel(market: PredictionMarket): string | null {
    const outcome: PredictionOutcome | null = market.outcome
    if (!outcome) return null
    if (outcome === 'draw') return 'Draw — everyone refunded'
    if (outcome === 'void') return 'Void — everyone refunded'
    const winner = outcome === 'a' ? market.team_a?.name : market.team_b?.name
    return winner ? `${winner} won` : 'Settled'
}

// Deliberately not `Chip` from bracketShared: that module imports the odds chip
// below, and importing back would close the loop.
const CHIP_BASE =
    'shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border'

export function MarketStatusChip({ market }: { market: PredictionMarket }) {
    return (
        <span className={cn(CHIP_BASE, MARKET_STATUS_STYLES[market.status])}>
            {MARKET_STATUS_LABELS[market.status]}
        </span>
    )
}

export function PriceBar({ priceA, className }: { priceA: number; className?: string }) {
    const percent = Math.min(100, Math.max(0, Math.round(priceA * 100)))

    return (
        <div className={cn('h-1.5 w-full rounded-full overflow-hidden bg-red-500/25 flex', className)}>
            <div className="h-full bg-accent-400/80" style={{ width: `${percent}%` }} />
        </div>
    )
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

export function MatchOddsChip({ matchId }: { matchId: string | null | undefined }) {
    const market = useMatchOdds(matchId)

    if (!market || market.status !== 'open') return null

    return (
        <span className={cn(CHIP_BASE, 'bg-accent-500/10 text-accent-300 border-accent-500/25 tabular-nums')}>
            {formatPercent(market.price_a)} / {formatPercent(market.price_b)}
        </span>
    )
}
