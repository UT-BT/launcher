import { useCallback, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import { requestLogin } from '@/app/components/shared/AuthRequiredModal'
import { useNavState } from '@/app/components/navigation/useNavState'
import {
    claimEventPredictionWallet, eventErrorMessage,
    type PredictionMarket, type PredictionsOverview, type UserProfile,
} from '@/app/utils/api'
import { BetModal } from './BetModal'
import { MarketCard } from './MarketCard'
import { PredictionsLeaderboard } from './PredictionsLeaderboard'
import { CoinAmount, formatCoins, useNow } from './predictionsShared'

type PredictionsView = 'markets' | 'mine' | 'leaderboard'

const VIEWS: { id: PredictionsView; label: string }[] = [
    { id: 'markets', label: 'Markets' },
    { id: 'mine', label: 'My Predictions' },
    { id: 'leaderboard', label: 'Leaderboard' },
]

const EMPTY: PredictionsOverview = {
    enabled: false,
    config: { enabled: false },
    stages: [],
    markets: [],
    wallet: null,
}

const OPEN_FIRST: Record<string, number> = { open: 0, resolved: 1, closed: 2, settled: 3, voided: 4 }

interface PredictionsTabProps {
    slug: string
    userProfile?: UserProfile
    /** Owned by EventDetailPage so the bracket's odds chips read the same fetch. */
    data: PredictionsOverview | null
    loaded: boolean
    onRefresh: () => void
}

export function PredictionsTab({ slug, userProfile, data: incoming, loaded, onRefresh }: PredictionsTabProps) {
    const accessToken = userProfile?.accessToken
    const browseToken = accessToken ?? ''
    const data = incoming ?? EMPTY
    const [error, setError] = useState<string | null>(null)
    const [claiming, setClaiming] = useState(false)
    const [betting, setBetting] = useState<PredictionMarket | null>(null)
    const [view, setView] = useNavState<PredictionsView>('event.predictionsView', 'markets')
    const now = useNow()

    const claim = useCallback(async () => {
        if (!accessToken) {
            requestLogin({ feature: 'make predictions', description: 'Sign in to claim your coins for this event.' })
            return
        }
        setClaiming(true)
        setError(null)
        try {
            await claimEventPredictionWallet(accessToken, slug)
            onRefresh()
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setClaiming(false)
        }
    }, [accessToken, slug, onRefresh])

    const openBet = useCallback((market: PredictionMarket) => {
        if (!accessToken) {
            requestLogin({ feature: 'make predictions', description: 'Sign in to predict on this match.' })
            return
        }
        if (!data.wallet) {
            void claim()
            return
        }
        setBetting(market)
    }, [accessToken, data.wallet, claim])

    const grouped = useMemo(() => {
        const byStage = new Map<string, PredictionMarket[]>()

        for (const market of data.markets) {
            const key = market.stage_id ?? 'other'
            const bucket = byStage.get(key)
            if (bucket) bucket.push(market)
            else byStage.set(key, [market])
        }

        for (const bucket of byStage.values()) {
            bucket.sort((left, right) =>
                (OPEN_FIRST[left.status] ?? 9) - (OPEN_FIRST[right.status] ?? 9))
        }

        return data.stages
            .map(stage => ({ stage, markets: byStage.get(stage.id) ?? [] }))
            .filter(entry => entry.markets.length > 0)
    }, [data.markets, data.stages])

    if (!loaded) {
        return <div className="p-6 text-center text-sm text-muted-foreground">Loading predictions…</div>
    }

    // Loaded with nothing is a failed fetch, not an event without predictions:
    // the tab only renders when the event says predictions are on.
    if (incoming === null) {
        return (
            <div className="p-6 flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">Predictions could not be loaded.</p>
                <Button variant="secondary" onClick={onRefresh}>Try again</Button>
            </div>
        )
    }

    if (!data.enabled) {
        return (
            <div className="p-6 text-center text-sm text-muted-foreground">
                Predictions are not running for this event.
            </div>
        )
    }

    const wallet = data.wallet
    const grant = data.config.initial_grant ?? 0

    return (
        <div className="flex flex-col gap-4">
            <ErrorBanner message={error} />

            {wallet ? (
                <div className="p-3 rounded-lg border border-white/10 bg-card/40 flex flex-wrap items-center gap-x-6 gap-y-2">
                    <Stat label="Coins" value={formatCoins(wallet.balance)} emphasis />
                    <Stat label="In play" value={formatCoins(wallet.staked)} />
                    <Stat label="Profit" value={<CoinAmount value={wallet.profit} signed />} />
                    {wallet.rank !== null && <Stat label="Rank" value={`#${wallet.rank}`} />}
                    <Stat label="Record" value={`${wallet.positions_won}–${wallet.positions_lost}`} />
                </div>
            ) : (
                <div className="p-4 rounded-lg border border-accent-500/30 bg-accent-500/10 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                        <div className="text-sm font-semibold text-white">
                            Claim {formatCoins(grant)} coins for this event
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Back a team on any upcoming match. One grant per player, no top-ups.
                        </p>
                    </div>
                    <Button onClick={claim} disabled={claiming}>
                        {claiming ? 'Claiming…' : 'Claim coins'}
                    </Button>
                </div>
            )}

            <div className="flex items-center gap-1 border-b border-white/10">
                {VIEWS.map(entry => (
                    <button
                        key={entry.id}
                        type="button"
                        onClick={() => setView(entry.id)}
                        className={cn(
                            'px-3 py-2 text-sm border-b-2 -mb-px transition-colors',
                            view === entry.id
                                ? 'border-accent-400 text-white'
                                : 'border-transparent text-muted-foreground hover:text-white/80',
                        )}
                    >
                        {entry.label}
                    </button>
                ))}
            </div>

            {view === 'leaderboard' ? (
                <PredictionsLeaderboard slug={slug} accessToken={browseToken} viewerId={userProfile?.id ?? undefined} />
            ) : (
                <MarketSections
                    groups={view === 'mine'
                        ? grouped
                            .map(entry => ({ ...entry, markets: entry.markets.filter(market => market.your_position) }))
                            .filter(entry => entry.markets.length > 0)
                        : grouped}
                    now={now}
                    canPredict={!!wallet}
                    onPredict={openBet}
                    emptyMessage={view === 'mine'
                        ? 'You have not made any predictions in this event yet.'
                        : 'No matches are open for predictions yet.'}
                />
            )}

            {betting && accessToken && wallet && (
                <BetModal
                    slug={slug}
                    accessToken={accessToken}
                    market={betting}
                    config={data.config}
                    wallet={wallet}
                    onClose={() => setBetting(null)}
                    onPlaced={onRefresh}
                />
            )}
        </div>
    )
}

function MarketSections({ groups, now, canPredict, onPredict, emptyMessage }: {
    groups: Array<{ stage: { id: string; name: string }; markets: PredictionMarket[] }>
    now: number
    canPredict: boolean
    onPredict: (market: PredictionMarket) => void
    emptyMessage: string
}) {
    if (groups.length === 0) {
        return <div className="p-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
    }

    return (
        <div className="flex flex-col gap-5">
            {groups.map(({ stage, markets }) => (
                <div key={stage.id} className="flex flex-col gap-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{stage.name}</h3>
                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {markets.map(market => (
                            <MarketCard
                                key={market.id}
                                market={market}
                                now={now}
                                canPredict={canPredict}
                                onPredict={onPredict}
                            />
                        ))}
                    </div>
                </div>
            ))}
        </div>
    )
}

function Stat({ label, value, emphasis }: { label: string; value: React.ReactNode; emphasis?: boolean }) {
    return (
        <div className="min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className={cn('tabular-nums', emphasis ? 'text-lg font-semibold text-white' : 'text-sm text-white/80')}>
                {value}
            </div>
        </div>
    )
}
