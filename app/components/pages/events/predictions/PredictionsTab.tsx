import { useCallback, useMemo, useState } from 'react'
import { EyeOff } from 'lucide-react'
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
import { CoinAmount, formatCoins, parseApiInstant, useNow } from './predictionsShared'

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

const CLOSING_SOON_MS = 2 * 60 * 60 * 1000

/** What a predictor is scanning for, in the order they care about it. */
const SECTIONS: Array<{ id: string; title: string; blurb?: string }> = [
    { id: 'closing', title: 'Closing soon' },
    { id: 'open', title: 'Open for predictions' },
    { id: 'awaiting', title: 'Under way', blurb: 'Closed to new predictions, waiting on a result.' },
    { id: 'paying', title: 'Paying out' },
    { id: 'done', title: 'Finished' },
]

/**
 * Markets sort by when they stop taking predictions, not by bracket position: the
 * only question on this page is what can still be predicted on and how long is
 * left. A market with no deadline sorts last — it is not "upcoming" in any useful
 * sense, and the manage panel flags those separately.
 */
function sortKey(market: PredictionMarket): number {
    return parseApiInstant(market.closes_at)
        ?? parseApiInstant(market.match?.scheduled_at)
        ?? Number.POSITIVE_INFINITY
}

function sectionFor(market: PredictionMarket, now: number): string {
    if (market.status === 'open') {
        const closes = parseApiInstant(market.closes_at)
        return closes !== null && closes - now < CLOSING_SOON_MS ? 'closing' : 'open'
    }
    if (market.status === 'closed') return 'awaiting'
    if (market.status === 'resolved') return 'paying'
    return 'done'
}

interface PredictionsTabProps {
    slug: string
    userProfile?: UserProfile
    /** Owned by EventDetailPage so the bracket's odds chips read the same fetch. */
    data: PredictionsOverview | null
    loaded: boolean
    onRefresh: () => void
    onMapSelect?: (mapName: string) => void
}

export function PredictionsTab({
    slug, userProfile, data: incoming, loaded, onRefresh, onMapSelect,
}: PredictionsTabProps) {
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

    const mine = view === 'mine'

    const sections = useMemo(() => {
        const source = mine ? data.markets.filter(market => market.your_position) : data.markets
        const buckets = new Map<string, PredictionMarket[]>()

        for (const market of source) {
            const id = sectionFor(market, now)
            const bucket = buckets.get(id)
            if (bucket) bucket.push(market)
            else buckets.set(id, [market])
        }

        for (const bucket of buckets.values()) {
            bucket.sort((left, right) => sortKey(left) - sortKey(right))
        }

        return SECTIONS
            .map(section => ({ ...section, markets: buckets.get(section.id) ?? [] }))
            .filter(section => section.markets.length > 0)
    }, [data.markets, mine, now])

    if (!loaded) {
        return <div className="p-6 text-center text-sm text-muted-foreground">Loading predictions…</div>
    }

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

    if (data.bracket_published === false) {
        return (
            <div className="p-6 flex flex-col items-center gap-2 text-center">
                <p className="text-sm text-white/90">Waiting on the bracket.</p>
                <p className="text-xs text-muted-foreground max-w-md">
                    Predictions are set up for this event, but markets only open on matches players can see.
                    Publish the bracket under Manage &rarr; Bracket and every drawn match gets a market.
                </p>
            </div>
        )
    }

    const wallet = data.wallet
    const grant = data.config.initial_grant ?? 0

    return (
        <div className="flex flex-col gap-4">
            <ErrorBanner message={error} />

            {data.config.staff_only && (
                <div className="p-2.5 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-200 text-xs flex items-center gap-2">
                    <EyeOff className="size-3.5 shrink-0" />
                    Staff preview. Markets are running for real, but players cannot see this tab until the
                    staff-only setting is switched off under Manage.
                </div>
            )}

            {wallet ? (
                <div className="p-3 rounded-lg border border-white/10 bg-card/40 flex flex-wrap items-center gap-x-6 gap-y-2">
                    <Stat label="Coins" value={formatCoins(wallet.balance)} emphasis />
                    <Stat label="In play" value={formatCoins(wallet.staked)} />
                    <Stat label="Profit" value={<CoinAmount value={wallet.profit} signed />} />
                    {wallet.rank !== null && <Stat label="Rank" value={`#${wallet.rank}`} />}
                    <Stat label="Record" value={`${wallet.positions_won}–${wallet.positions_lost}`} />
                    <Stat label="Max per match" value={formatCoins(wallet.max_stake)} />
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
            ) : sections.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                    {mine
                        ? 'You have not made any predictions in this event yet.'
                        : 'No matches are open for predictions yet.'}
                </div>
            ) : (
                <div className="flex flex-col gap-5">
                    {sections.map(section => (
                        <div key={section.id} className="flex flex-col gap-2">
                            <div className="flex items-baseline gap-2 flex-wrap">
                                <h3 className={cn(
                                    'text-xs font-bold uppercase tracking-wider',
                                    section.id === 'closing' ? 'text-amber-300' : 'text-muted-foreground',
                                )}>
                                    {section.title}
                                </h3>
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                    {section.markets.length}
                                </span>
                                {section.blurb && (
                                    <span className="text-[11px] text-muted-foreground">{section.blurb}</span>
                                )}
                            </div>
                            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                {section.markets.map(market => (
                                    <MarketCard
                                        key={market.id}
                                        slug={slug}
                                        accessToken={browseToken}
                                        market={market}
                                        now={now}
                                        canPredict={!!wallet}
                                        onPredict={openBet}
                                        onMapSelect={onMapSelect}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
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
