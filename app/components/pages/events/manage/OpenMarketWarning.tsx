import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import {
    eventErrorMessage, fetchEventPredictionMarket, updateEventPredictionMarket,
    type PredictionMarket,
} from '@/app/utils/api'

/**
 * A market that is still taking predictions when a result is entered gets voided
 * and everyone refunded, because the match could have been watched to the end
 * first. That is the right call, and it is also the quietest way for a whole
 * round of predictions to evaporate — so a manager gets told before they score,
 * with the one-click fix next to the warning.
 */
export function OpenMarketWarning({ accessToken, slug, matchId, disabled }: {
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

    const close = useCallback(async () => {
        setBusy(true)
        setError(null)
        try {
            setMarket(await updateEventPredictionMarket(accessToken, slug, matchId, { override: 'closed' }))
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }, [accessToken, slug, matchId])

    if (!market || market.status !== 'open') return null

    return (
        <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm flex flex-wrap items-start gap-2">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
                <p>
                    Predictions are still open on this match. Scoring it now voids the market and refunds all{' '}
                    <span className="tabular-nums">{market.position_count}</span> of them.
                </p>
                {error && <p className="mt-1 text-red-300">{error}</p>}
            </div>
            <Button size="sm" variant="secondary" disabled={busy || disabled} onClick={close}>
                {busy ? 'Closing…' : 'Close predictions'}
            </Button>
        </div>
    )
}
