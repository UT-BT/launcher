import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import { Tooltip } from '@/app/components/ui/tooltip'
import {
    eventErrorMessage, fetchEventPredictionAdminMarkets, syncEventPredictions,
    updateEventPredictionConfig, updateEventPredictionMarket,
    type PredictionAdminMarkets, type PredictionConfig, type PredictionMarket,
} from '@/app/utils/api'
import { formatMatchTime } from '../bracket/bracketShared'
import { PredictionLedgerPanel } from './PredictionLedgerPanel'
import {
    MarketStatusChip, evenMarketPriceAfter, formatCoins, formatPercent, liquidityForPriceAfter,
    priceOf, sidesOf,
} from '../predictions/predictionsShared'

const PER_MATCH_HINT =
    'Prevents users from betting significant portions of their wealth on one match. Share of what a '
    + 'player is worth right now, so it stays fair as they win or lose'

const EMPTY: PredictionAdminMarkets = { items: [], unscheduled_open_count: 0, config: { enabled: false } }

/** Named by what a big prediction visibly does, because "b = 1000" tells nobody anything. */
const LIQUIDITY_PRESETS: Array<{ id: string; label: string; targetPrice: number; blurb: string }> = [
    { id: 'steady', label: 'Steady', targetPrice: 0.56, blurb: 'Odds barely budge. Best when a lot of people will predict.' },
    { id: 'balanced', label: 'Balanced', targetPrice: 0.62, blurb: 'A big prediction nudges the odds. Start here.' },
    { id: 'volatile', label: 'Volatile', targetPrice: 0.72, blurb: 'Odds swing hard. Best for a small crowd, or for drama.' },
]

export function PredictionsManagePanel({ accessToken, slug, onRefresh }: {
    accessToken: string
    slug: string
    /** Reloads the event page's own copy: enabling predictions adds a tab, and
     *  closing a market changes what the Predictions tab should show. */
    onRefresh?: () => void
}) {
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
            onRefresh?.()
            if (message) setNotice(message)
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }, [load, onRefresh])

    const grant = draft?.initial_grant ?? 0
    const pct = draft?.max_stake_pct ?? 0
    const liquidity = draft?.liquidity_b ?? 0

    const referenceStake = useMemo(
        () => Math.floor((grant * pct) / 100),
        [grant, pct],
    )
    const economySet = grant > 0 && pct > 0 && referenceStake > 0
    const priceAfter = evenMarketPriceAfter(referenceStake, liquidity)

    if (!draft) {
        return <div className="p-4 text-sm text-muted-foreground">Loading prediction settings…</div>
    }

    const set = (patch: Partial<PredictionConfig>) => setDraft({ ...draft, ...patch })

    return (
        <div className="space-y-4">
            <ErrorBanner message={error} />
            {notice && (
                <div className="p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 text-sm">
                    {notice}
                </div>
            )}

            <div className="p-4 rounded-lg border border-white/10 bg-card/40 space-y-5">
                <Toggle
                    label="Predictions Enabled"
                    hint="Switching this off refunds every open prediction rather than abandoning it."
                    checked={!!draft.enabled}
                    onChange={value => set({ enabled: value })}
                />

                <Toggle
                    label="Staff Visibility Only"
                    hint="Markets still open, close and settle exactly as they will for players. This hides the Predictions tab from everyone but staff that manage this event. Turn it off to go live."
                    checked={!!draft.staff_only}
                    onChange={value => set({ staff_only: value })}
                />

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <NumberField
                        label="Starting coins"
                        hint="Given the first time a player opens Predictions for this event."
                        value={draft.initial_grant}
                        onChange={value => set({ initial_grant: value })}
                    />
                    <NumberField
                        label="Max per match"
                        suffix="%"
                        hint={PER_MATCH_HINT + (economySet
                            ? ` (${pct}% is ${formatCoins(referenceStake)} coins at the starting balance.)`
                            : '.')}
                        value={draft.max_stake_pct}
                        onChange={value => set({ max_stake_pct: value })}
                    />
                    <NumberField
                        label="Minimum stake"
                        hint="The smallest prediction that can be made."
                        value={draft.min_stake}
                        onChange={value => set({ min_stake: value })}
                    />
                    <NumberField
                        label="Payout hold"
                        suffix="min"
                        hint="How long a finished match shows its result before coins actually move. Gives you a window to fix a mistyped score. Players see the outcome immediately either way."
                        value={draft.settlement_hold_minutes}
                        onChange={value => set({ settlement_hold_minutes: value })}
                    />
                    <NumberField
                        label="Close early"
                        suffix="sec"
                        hint="Stops predictions this many seconds BEFORE the scheduled kick-off, instead of exactly on it."
                        value={draft.close_buffer_seconds}
                        onChange={value => set({ close_buffer_seconds: value })}
                    />
                </div>

                <LiquidityField
                    liquidity={liquidity}
                    referenceStake={referenceStake}
                    priceAfter={priceAfter}
                    ready={economySet}
                    onChange={value => set({ liquidity_b: value })}
                />

                <div className="space-y-3 pt-1">
                    <Toggle
                        label="Players may back their own team"
                        hint="They can never back the team they are playing against, whichever way this is set."
                        checked={!!draft.roster_bets_allowed}
                        onChange={value => set({ roster_bets_allowed: value })}
                    />
                    <Toggle
                        label="Void a market if a result lands while it is still open"
                        hint="Stops anyone predicting a match they have already watched finish. Leave this on unless you are sure every match gets a kick-off time or a Live flag before it is scored."
                        checked={!!draft.void_on_result_while_open}
                        onChange={value => set({ void_on_result_while_open: value })}
                    />
                </div>

                <div className="flex items-center gap-2 pt-1">
                    <Button
                        onClick={() => run(
                            () => updateEventPredictionConfig(accessToken, slug, draft),
                            'Prediction settings saved.',
                        )}
                        disabled={busy}
                    >
                        Save settings
                    </Button>

                    <Tooltip
                        className="ml-auto"
                        content={
                            <span className="font-normal tracking-normal">
                                Re-reads every match and fixes any market that drifted — opens ones that should be
                                open, closes ones past their time, settles finished ones. Runs by itself every couple
                                of minutes; this is for when you would rather not wait.
                            </span>
                        }
                    >
                        <Button
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            onClick={() => run(() => syncEventPredictions(accessToken, slug), 'Markets re-checked.')}
                        >
                            <RefreshCw className="size-3.5 mr-1.5" />
                            Re-check markets
                        </Button>
                    </Tooltip>
                </div>
            </div>

            {draft.enabled && data.bracket_published === false && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm flex gap-2">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span>
                        The bracket is not published, so no markets exist yet. A market only opens on a match
                        players can see.
                    </span>
                </div>
            )}

            {data.unscheduled_open_count > 0 && (
                <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-200 text-sm flex gap-2">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span>
                        {data.unscheduled_open_count} open {data.unscheduled_open_count === 1 ? 'market has' : 'markets have'}
                        {' '}no scheduled close time. Give those matches a kick-off time, or close them by hand before
                        scoring, otherwise scoring them refunds every prediction on them.
                    </span>
                </div>
            )}

            <PredictionLedgerPanel accessToken={accessToken} slug={slug} />

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

function LiquidityField({ liquidity, referenceStake, priceAfter, ready, onChange }: {
    liquidity: number
    referenceStake: number
    priceAfter: number
    ready: boolean
    onChange: (value: number) => void
}) {
    const active = ready
        ? LIQUIDITY_PRESETS.find(
            preset => Math.abs(liquidityForPriceAfter(referenceStake, preset.targetPrice) - liquidity) < 60,
        )
        : undefined

    return (
        <div className="p-3 rounded-lg border border-white/10 bg-card/30 space-y-3">
            <div>
                <div className="text-xs font-medium text-white/90">How much one prediction moves the odds</div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                    A market opens at the odds the seeding and the results so far imply, and each prediction pushes it
                    from there. This sets how hard. Too sensitive and one player moves the odds on their own, too stiff
                    and the crowd can never disagree with the opening price.
                </p>
            </div>

            <div className={cn('grid gap-2 sm:grid-cols-3', !ready && 'opacity-40')}>
                {LIQUIDITY_PRESETS.map(preset => {
                    const value = ready ? liquidityForPriceAfter(referenceStake, preset.targetPrice) : 0

                    return (
                        <button
                            key={preset.id}
                            type="button"
                            disabled={!ready}
                            onClick={() => onChange(value)}
                            className={cn(
                                'p-2.5 rounded-lg border text-left transition-colors',
                                active?.id === preset.id
                                    ? 'border-accent-500/60 bg-accent-500/10'
                                    : 'border-white/10 bg-card/50',
                                ready ? 'hover:border-white/20' : 'cursor-not-allowed',
                            )}
                        >
                            <div className="text-sm font-semibold text-white">{preset.label}</div>
                            <div className="text-[11px] text-muted-foreground">{preset.blurb}</div>
                        </button>
                    )
                })}
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <label className="text-[11px] text-muted-foreground">Exact value</label>
                <input
                    type="number"
                    min={1}
                    value={String(liquidity ?? '')}
                    onChange={event => onChange(Number(event.target.value))}
                    className="w-28 px-2 py-1 bg-card/50 border border-white/10 rounded text-sm text-white tabular-nums focus:outline-none focus:border-accent-500/50"
                />
                {!active && <span className="text-[11px] text-muted-foreground">Custom</span>}
            </div>

            {ready ? (
                <p className="text-xs text-white/80">
                    Measured against an even two-way match, because that is the one yardstick that does not move as the
                    cup is played: one maximum prediction of{' '}
                    <span className="tabular-nums font-semibold">{formatCoins(referenceStake)}</span> coins would take
                    it from <span className="tabular-nums">50%</span> to{' '}
                    <span className="tabular-nums font-semibold text-accent-300">{formatPercent(priceAfter)}</span>. A
                    lopsided market moves less for the same coins.
                </p>
            ) : (
                <p className="text-xs text-amber-300/90">
                    Set starting coins and a max per match above, and this will show exactly what each option does.
                </p>
            )}
        </div>
    )
}

function MarketRow({ market, busy, onAction }: {
    market: PredictionMarket
    busy: boolean
    onAction: (input: {
        override?: 'open' | 'closed' | 'void' | null
        settle_now?: boolean
        unvoid?: boolean
    }) => void
}) {
    const disabled = busy || !market.match_id

    return (
        <div className="p-3 rounded-lg border border-white/10 bg-card/40 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
                <div className="text-sm text-white truncate">
                    {market.team_a?.name || 'TBD'} <span className="text-muted-foreground">vs</span> {market.team_b?.name || 'TBD'}
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                    {sidesOf(market).map(side => formatPercent(priceOf(market, side))).join(' / ')}
                    {' · '}{formatCoins(market.pool_stake)} staked
                    {' · '}{market.position_count} predictions
                    {market.closes_at ? ` · closes ${formatMatchTime(market.closes_at)}` : ' · no close time'}
                </div>
                {market.outcome_reason && (
                    <div className="text-[11px] text-amber-200/80 mt-0.5">{market.outcome_reason}</div>
                )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                <MarketStatusChip market={market} />
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
                        Pay Out
                    </Button>
                )}
                {market.status === 'voided' && (
                    <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onAction({ unvoid: true })}>
                        Undo Refund
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
                        Refund all
                    </Button>
                )}
            </div>
        </div>
    )
}

function NumberField({ label, hint, value, suffix, onChange }: {
    label: string
    hint: string
    value: number | undefined
    suffix?: string
    onChange: (value: number) => void
}) {
    return (
        <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-white/90">{label}</span>
            <div className="flex items-center gap-1.5">
                <input
                    type="number"
                    min={0}
                    value={String(value ?? '')}
                    onChange={event => onChange(Number(event.target.value))}
                    className="w-full px-3 py-2 bg-card/50 border border-white/10 rounded-lg text-sm text-white tabular-nums focus:outline-none focus:border-accent-500/50"
                />
                {suffix && <span className="text-xs text-muted-foreground shrink-0">{suffix}</span>}
            </div>
            <span className="text-[11px] text-muted-foreground leading-relaxed">{hint}</span>
        </label>
    )
}

function Toggle({ label, hint, checked, onChange }: {
    label: string
    hint: string
    checked: boolean
    onChange: (value: boolean) => void
}) {
    return (
        <label className="flex items-start gap-3 cursor-pointer">
            <input
                type="checkbox"
                checked={checked}
                onChange={event => onChange(event.target.checked)}
                className="mt-1"
            />
            <span>
                <span className="text-sm text-white/90">{label}</span>
                <span className="block text-[11px] text-muted-foreground leading-relaxed">{hint}</span>
            </span>
        </label>
    )
}
