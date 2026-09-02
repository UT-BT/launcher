import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import {
    eventErrorMessage, fetchEventPredictionAdminMarkets, syncEventPredictions,
    updateEventPredictionConfig, updateEventPredictionMarket,
    type PredictionAdminMarkets, type PredictionConfig, type PredictionMarket,
} from '@/app/utils/api'
import { formatMatchTime } from '../bracket/bracketShared'
import { MarketStatusChip, formatCoins, formatPercent } from '../predictions/predictionsShared'

const NUMBER_FIELDS: Array<{ key: keyof PredictionConfig; label: string; hint: string }> = [
    { key: 'initial_grant', label: 'Starting coins', hint: 'Granted once per player, no top-ups.' },
    { key: 'max_stake_per_market', label: 'Max per match', hint: 'Keeps one big call from deciding the leaderboard.' },
    { key: 'min_stake', label: 'Minimum stake', hint: '' },
    { key: 'liquidity_b', label: 'Liquidity', hint: 'Higher moves the price less per prediction.' },
    { key: 'settlement_hold_minutes', label: 'Payout hold (min)', hint: 'Results show first, coins move after this.' },
    { key: 'close_buffer_seconds', label: 'Close early (sec)', hint: 'Shuts predictions before kick-off.' },
]

const EMPTY: PredictionAdminMarkets = { items: [], unscheduled_open_count: 0, config: { enabled: false } }

export function PredictionsManagePanel({ accessToken, slug }: { accessToken: string; slug: string }) {
    const [data, setData] = useState<PredictionAdminMarkets>(EMPTY)
    const [draft, setDraft] = useState<PredictionConfig | null>(null)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const load = useCallback(async () => {
        try {
            const next = await fetchEventPredictionAdminMarkets(accessToken, slug)
            setData(next)
            setDraft(next.config)
            setError(null)
        } catch (e) {
            setError(eventErrorMessage(e))
        }
    }, [accessToken, slug])

    useEffect(() => { void load() }, [load])

    const run = useCallback(async (action: () => Promise<unknown>, message?: string) => {
        setBusy(true)
        setError(null)
        setNotice(null)
        try {
            await action()
            await load()
            if (message) setNotice(message)
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }, [load])

    if (!draft) {
        return <div className="p-4 text-sm text-muted-foreground">Loading prediction settings…</div>
    }

    const save = () => run(
        () => updateEventPredictionConfig(accessToken, slug, draft),
        'Prediction settings saved.',
    )

    return (
        <div className="space-y-4">
            <ErrorBanner message={error} />
            {notice && (
                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-sm">
                    {notice}
                </div>
            )}

            <div className="p-4 rounded-lg border border-white/10 bg-card/40 space-y-4">
                <label className="flex items-start gap-3 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={!!draft.enabled}
                        onChange={event => setDraft({ ...draft, enabled: event.target.checked })}
                        className="mt-1"
                    />
                    <span>
                        <span className="text-sm font-semibold text-white">Predictions are running</span>
                        <span className="block text-xs text-muted-foreground">
                            Switching this off refunds every open prediction rather than abandoning it.
                        </span>
                    </span>
                </label>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {NUMBER_FIELDS.map(field => (
                        <label key={String(field.key)} className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-white/80">{field.label}</span>
                            <input
                                type="number"
                                min={0}
                                value={String(draft[field.key] ?? '')}
                                onChange={event => setDraft({
                                    ...draft,
                                    [field.key]: Number(event.target.value),
                                })}
                                className="px-3 py-2 bg-card/50 border border-white/10 rounded-lg text-sm text-white tabular-nums focus:outline-none focus:border-accent-500/50"
                            />
                            {field.hint && <span className="text-[11px] text-muted-foreground">{field.hint}</span>}
                        </label>
                    ))}
                </div>

                <div className="flex flex-col gap-2">
                    <Toggle
                        label="Players may back their own team"
                        hint="They can never back the team they are playing against."
                        checked={!!draft.roster_bets_allowed}
                        onChange={value => setDraft({ ...draft, roster_bets_allowed: value })}
                    />
                    <Toggle
                        label="Void a market if a result lands while it is still open"
                        hint="Stops anyone predicting a match they have already watched finish. Turning this off settles those matches normally."
                        checked={!!draft.void_on_result_while_open}
                        onChange={value => setDraft({ ...draft, void_on_result_while_open: value })}
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Button onClick={save} disabled={busy}>Save settings</Button>
                    <Button
                        variant="ghost"
                        disabled={busy}
                        onClick={() => run(() => syncEventPredictions(accessToken, slug), 'Markets reconciled.')}
                    >
                        Reconcile markets
                    </Button>
                </div>
            </div>

            {data.unscheduled_open_count > 0 && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm flex gap-2">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span>
                        {data.unscheduled_open_count} open {data.unscheduled_open_count === 1 ? 'market has' : 'markets have'}
                        {' '}no scheduled close time. Give those matches a kick-off time, or close them by hand before
                        scoring — otherwise scoring them refunds every prediction on them.
                    </span>
                </div>
            )}

            <div className="space-y-2">
                {data.items.length === 0 && (
                    <div className="p-4 text-sm text-muted-foreground text-center">No markets yet.</div>
                )}
                {data.items.map(market => (
                    <MarketRow
                        key={market.id}
                        market={market}
                        busy={busy}
                        onAction={input => run(
                            () => updateEventPredictionMarket(accessToken, slug, market.match_id as string, input),
                        )}
                    />
                ))}
            </div>
        </div>
    )
}

function MarketRow({ market, busy, onAction }: {
    market: PredictionMarket
    busy: boolean
    onAction: (input: { override?: 'open' | 'closed' | 'void' | null; settle_now?: boolean }) => void
}) {
    const disabled = busy || !market.match_id

    return (
        <div className="p-3 rounded-lg border border-white/10 bg-card/40 flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
                <div className="text-sm text-white truncate">
                    {market.team_a?.name || 'TBD'} <span className="text-muted-foreground">vs</span> {market.team_b?.name || 'TBD'}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                    {formatPercent(market.price_a)} / {formatPercent(market.price_b)}
                    {' · '}{formatCoins(market.pool_stake)} staked
                    {' · '}{market.position_count} predictions
                    {market.closes_at ? ` · closes ${formatMatchTime(market.closes_at)}` : ' · no close time'}
                </div>
            </div>

            <MarketStatusChip market={market} />

            <div className="flex items-center gap-1.5">
                {market.status === 'open' && (
                    <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onAction({ override: 'closed' })}>
                        Close
                    </Button>
                )}
                {market.status === 'closed' && (
                    <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onAction({ override: 'open' })}>
                        Reopen
                    </Button>
                )}
                {market.status === 'resolved' && (
                    <Button size="sm" variant="secondary" disabled={disabled} onClick={() => onAction({ settle_now: true })}>
                        Pay out now
                    </Button>
                )}
                {market.status !== 'voided' && market.status !== 'settled' && (
                    <Button
                        size="sm"
                        variant="ghost"
                        disabled={disabled}
                        className="text-red-300 hover:text-red-200"
                        onClick={() => onAction({ override: 'void' })}
                    >
                        Void
                    </Button>
                )}
            </div>
        </div>
    )
}

function Toggle({ label, hint, checked, onChange }: {
    label: string
    hint: string
    checked: boolean
    onChange: (value: boolean) => void
}) {
    return (
        <label className={cn('flex items-start gap-3 cursor-pointer')}>
            <input
                type="checkbox"
                checked={checked}
                onChange={event => onChange(event.target.checked)}
                className="mt-1"
            />
            <span>
                <span className="text-sm text-white/90">{label}</span>
                <span className="block text-xs text-muted-foreground">{hint}</span>
            </span>
        </label>
    )
}
