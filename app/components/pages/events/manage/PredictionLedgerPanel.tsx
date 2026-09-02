import { useCallback, useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { formatTimeAgo } from '@/app/utils/format'
import {
    fetchEventPredictionLedger, type PredictionLedgerRow,
} from '@/app/utils/api'
import { formatCoins, parseApiInstant } from '../predictions/predictionsShared'

const PAGE = 25

const KINDS: Array<{ id: string; label: string }> = [
    { id: '', label: 'Everything' },
    { id: 'stake', label: 'Predictions' },
    { id: 'payout', label: 'Payouts' },
    { id: 'refund', label: 'Refunds' },
    { id: 'reversal', label: 'Reversals' },
    { id: 'grant', label: 'Grants' },
]

const KIND_LABELS: Record<string, string> = {
    grant: 'claimed coins',
    stake: 'predicted',
    payout: 'won',
    refund: 'refunded',
    reversal: 'reversed',
}

const KIND_STYLES: Record<string, string> = {
    grant: 'text-muted-foreground',
    stake: 'text-sky-300',
    payout: 'text-emerald-300',
    refund: 'text-amber-300',
    reversal: 'text-red-300',
}

function when(iso: string | null): string {
    const at = parseApiInstant(iso)

    return at === null ? '' : formatTimeAgo(new Date(at).toISOString())
}

/**
 * Every coin that has moved in this event, newest first.
 *
 * Individual predictions are deliberately kept out of the global staff audit log
 * — a busy cup would drown it — so this append-only journal is their record. Each
 * row is one immutable ledger entry, and a settlement that was reversed and
 * re-run shows all three movements rather than hiding the correction.
 */
export function PredictionLedgerPanel({ accessToken, slug }: { accessToken: string; slug: string }) {
    const [rows, setRows] = useState<PredictionLedgerRow[]>([])
    const [total, setTotal] = useState(0)
    const [kind, setKind] = useState('')
    const [page, setPage] = useState(0)
    const [loading, setLoading] = useState(true)

    const load = useCallback(async (signal?: AbortSignal) => {
        setLoading(true)
        try {
            const data = await fetchEventPredictionLedger(
                accessToken, slug, { limit: PAGE, offset: page * PAGE, kind: kind || undefined }, signal,
            )
            setRows(data.items)
            setTotal(data.total)
        } catch {
            setRows([])
        } finally {
            if (!signal?.aborted) setLoading(false)
        }
    }, [accessToken, slug, kind, page])

    useEffect(() => {
        const controller = new AbortController()
        void load(controller.signal)
        return () => controller.abort()
    }, [load])

    const pages = Math.max(1, Math.ceil(total / PAGE))

    return (
        <div className="p-3 sm:p-4 rounded-lg border border-white/10 bg-card/40 space-y-3">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-white">Coin activity</div>
                    <p className="text-[11px] text-muted-foreground">
                        Append-only. Every grant, prediction, payout, refund and reversal in this event.
                    </p>
                </div>
                <span className="sm:ml-auto text-[11px] text-muted-foreground tabular-nums">
                    {total.toLocaleString()} entries
                </span>
            </div>

            <div className="flex flex-wrap gap-1.5">
                {KINDS.map(entry => (
                    <button
                        key={entry.id || 'all'}
                        type="button"
                        onClick={() => { setKind(entry.id); setPage(0) }}
                        className={cn(
                            'px-2 py-1 rounded border text-xs transition-colors',
                            kind === entry.id
                                ? 'border-accent-500/60 bg-accent-500/10 text-white'
                                : 'border-white/10 bg-card/50 text-muted-foreground hover:text-white hover:border-white/20',
                        )}
                    >
                        {entry.label}
                    </button>
                ))}
            </div>

            {rows.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                    {loading ? 'Loading…' : 'Nothing has moved yet.'}
                </p>
            ) : (
                <div className="divide-y divide-hairline/5">
                    {rows.map(row => (
                        <div key={row.id} className="py-2 flex flex-col gap-1">
                            <div className="flex items-center gap-2 min-w-0 text-xs">
                                <div className="min-w-0 flex-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                                    {row.user_id
                                        ? <PlayerInfo userId={row.user_id} alias={row.alias} size="sm" />
                                        : <span className="text-muted-foreground">Erased account</span>}
                                    <span className={cn('shrink-0', KIND_STYLES[row.kind])}>
                                        {KIND_LABELS[row.kind] ?? row.kind}
                                    </span>
                                </div>
                                <span className={cn(
                                    'shrink-0 tabular-nums font-medium',
                                    row.amount > 0 ? 'text-emerald-300' : 'text-red-300',
                                )}>
                                    {row.amount > 0 ? '+' : '−'}{formatCoins(Math.abs(row.amount))}
                                </span>
                                <span className="shrink-0 w-14 sm:w-16 text-right tabular-nums text-muted-foreground">
                                    {formatCoins(row.balance_after)}
                                </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground pl-0.5">
                                {row.market && (
                                    <span className="truncate max-w-full">
                                        {row.market.team_a || 'TBD'} v {row.market.team_b || 'TBD'}
                                        {row.market.round_label && ` · ${row.market.round_label}`}
                                    </span>
                                )}
                                {row.created_at && <span className="shrink-0">{when(row.created_at)}</span>}
                                <span className="shrink-0">
                                    {row.actor_alias
                                        ? `by ${row.actor_alias}`
                                        : row.kind === 'stake' || row.kind === 'grant' ? '' : 'automatic'}
                                </span>
                                {row.settlement_seq != null && row.settlement_seq > 1 && (
                                    <span className="shrink-0 text-amber-300/80">
                                        settlement #{row.settlement_seq}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {pages > 1 && (
                <div className="flex items-center justify-between gap-2">
                    <Button
                        size="sm" variant="ghost" disabled={page === 0 || loading}
                        onClick={() => setPage(current => Math.max(0, current - 1))}
                    >
                        Newer
                    </Button>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                        Page {page + 1} of {pages}
                    </span>
                    <Button
                        size="sm" variant="ghost" disabled={page + 1 >= pages || loading}
                        onClick={() => setPage(current => current + 1)}
                    >
                        Older
                    </Button>
                </div>
            )}
        </div>
    )
}
