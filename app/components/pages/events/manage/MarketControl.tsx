import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import {
    eventErrorMessage, fetchEventPredictionMarket, updateEventPredictionMarket,
    type PredictionMarket, type PredictionOverride,
} from '@/app/utils/api'
import { MarketStatusChip, formatCoins } from '../predictions/predictionsShared'

/**
 * Opening and closing a match's market from the place a manager already is.
 *
 * Match status alone is not enough to run this: flipping a match to Live closes
 * the market, but putting it back to Scheduled does NOT reopen it, because a
 * market that has closed once must never reopen on its own — otherwise clearing
 * a result would put the match everybody just watched back on sale. Reopening is
 * therefore always a deliberate act, and this is where it lives.
 *
 * Every change here goes through the admin route, which writes both the global
 * audit log and the event's own.
 */
export function MarketControl({ accessToken, slug, matchId, disabled }: {
    accessToken: string
    slug: string
    matchId: string
    disabled?: boolean
}) {
    const [market, setMarket] = useState<PredictionMarket | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async (signal?: AbortSignal) => {
        try {
            const data = await fetchEventPredictionMarket(accessToken, slug, matchId, signal)
            setMarket(data.market)
        } catch {
            setMarket(null)
        }
    }, [accessToken, slug, matchId])

    useEffect(() => {
        const controller = new AbortController()
        void load(controller.signal)
        return () => controller.abort()
    }, [load])

    const apply = useCallback(async (override: PredictionOverride | null) => {
        setBusy(true)
        setError(null)
        try {
            setMarket(await updateEventPredictionMarket(accessToken, slug, matchId, { override }))
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }, [accessToken, slug, matchId])

    if (!market) return null

    const open = market.status === 'open'
    const settled = market.status === 'settled' || market.status === 'voided'
    const locked = busy || disabled

    return (
        <div className={cn(
            'p-3 rounded-lg border flex flex-col gap-2',
            open ? 'border-amber-500/30 bg-amber-500/10' : 'border-white/10 bg-card/40',
        )}>
            <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-white/90">Predictions</span>
                <MarketStatusChip market={market} />
                <span className="text-[11px] text-muted-foreground tabular-nums">
                    {formatCoins(market.pool_stake)} staked across {market.position_count}
                </span>

                <div className="ml-auto flex items-center gap-1.5">
                    {market.manual_override && (
                        <Button
                            size="sm"
                            variant="ghost"
                            disabled={locked}
                            title="Go back to opening and closing automatically"
                            onClick={() => apply(null)}
                        >
                            <RotateCcw className="size-3.5 mr-1.5" />
                            Automatic
                        </Button>
                    )}
                    {!settled && (
                        <Button
                            size="sm"
                            variant={open ? 'secondary' : 'ghost'}
                            disabled={locked}
                            onClick={() => apply(open ? 'closed' : 'open')}
                        >
                            {open ? 'Close predictions' : 'Reopen predictions'}
                        </Button>
                    )}
                </div>
            </div>

            {open && (
                <p className="text-xs text-amber-200 flex gap-1.5">
                    <AlertTriangle className="size-3.5 shrink-0 mt-0.5" />
                    <span>
                        Still open. Scoring this match now voids the market and refunds all{' '}
                        <span className="tabular-nums">{market.position_count}</span> predictions.
                    </span>
                </p>
            )}

            {market.manual_override && (
                <p className="text-[11px] text-muted-foreground">
                    Held {market.manual_override === 'open' ? 'open' : market.manual_override} by hand — the
                    scheduled time and the match status will not change it until you set it back to automatic.
                </p>
            )}

            {error && <p className="text-xs text-red-300">{error}</p>}
        </div>
    )
}
