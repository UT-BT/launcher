import { useEffect, useState } from 'react'
import type { PredictionMarket, PredictionSide } from '@/app/utils/api'
import { parseApiInstant } from '@/app/utils/timezone'

export function formatPercent(price: number | null | undefined): string {
    return `${Math.round((price ?? 0) * 100)}%`
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

export function kickoffOf(market: Pick<PredictionMarket, 'match'>): number | null {
    return parseApiInstant(market.match?.scheduled_at)
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
