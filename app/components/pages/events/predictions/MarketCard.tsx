import { useState } from 'react'
import { ChevronDown, ChevronRight, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import type { PredictionMarket, PredictionSide } from '@/app/utils/api'
import { TeamName } from '../TeamRoster'
import { formatMatchTime } from '../bracket/bracketShared'
import { MatchupInsights } from './MatchupInsights'
import {
    CoinAmount, MarketStatusChip, SIDE_BAR_STYLES, SIDE_TEXT_STYLES, formatCoins, formatCountdown,
    formatMultiplier, formatOdds, formatPercent, openingPriceOf, outcomeLabel, priceDrift, priceOf,
    sideLabel,
} from './predictionsShared'

interface MarketCardProps {
    slug: string
    accessToken: string
    market: PredictionMarket
    now: number
    canPredict: boolean
    onPredict: (market: PredictionMarket) => void
    onShowBackers: (market: PredictionMarket) => void
    onMapSelect?: (mapName: string) => void
}

export function MarketCard({
    slug, accessToken, market, now, canPredict, onPredict, onShowBackers, onMapSelect,
}: MarketCardProps) {
    const [showInsights, setShowInsights] = useState(false)
    const held = market.your_position
    const countdown = market.status === 'open' ? formatCountdown(market.closes_at, now) : null
    const payoutIn = market.status === 'resolved' ? formatCountdown(market.settles_at, now) : null
    const settled = outcomeLabel(market)
    const label = market.match?.round_label || (market.match?.round_no ? `Round ${market.match.round_no}` : null)
    const urgent = market.status === 'open' && !!market.closes_at
        && new Date(market.closes_at).getTime() - now < 60 * 60 * 1000

    return (
        <div className={cn(
            'rounded-lg border bg-card/40 flex flex-col',
            urgent ? 'border-amber-500/30' : 'border-white/10',
        )}>
            <div className="p-3 flex flex-col gap-2.5">
                <div className="flex items-center justify-between gap-2 min-w-0">
                    <div className="flex items-center gap-2 min-w-0 text-xs text-muted-foreground">
                        {label && <span className="truncate">{label}</span>}
                        {market.match?.scheduled_at && (
                            <span className="truncate">{formatMatchTime(market.match.scheduled_at)}</span>
                        )}
                    </div>
                    <MarketStatusChip market={market} />
                </div>

                <div className="flex flex-col gap-0.5">
                    <SideRow market={market} side="a" />
                    {market.draws_allowed && <SideRow market={market} side="draw" />}
                    <SideRow market={market} side="b" />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                        <span className="tabular-nums">{formatCoins(market.pool_stake)} staked</span>
                        <span className="tabular-nums">
                            {market.position_count} {market.position_count === 1 ? 'prediction' : 'predictions'}
                        </span>
                        {countdown && (
                            <span className={cn('tabular-nums', urgent ? 'text-amber-300 font-medium' : 'text-white/70')}>
                                Closes in {countdown}
                            </span>
                        )}
                        {payoutIn && <span className="text-sky-300 tabular-nums">Pays out in {payoutIn}</span>}
                        {settled && <span className="text-white/70">{settled}</span>}
                    </div>

                    <div className="flex items-center gap-1.5">
                        {market.position_count > 0 && market.status !== 'open' && (
                            <Button
                                size="sm"
                                variant="ghost"
                                title="See who has predicted on this match"
                                onClick={() => onShowBackers(market)}
                            >
                                <Users className="size-3.5 mr-1.5" />
                                {market.position_count}
                            </Button>
                        )}
                        {market.status === 'open' && canPredict && (
                            <Button size="sm" variant="secondary" onClick={() => onPredict(market)}>
                                {held ? 'Add to prediction' : 'Predict'}
                            </Button>
                        )}
                    </div>
                </div>

                {market.outcome_reason && (
                    <p className="text-[11px] text-amber-200/90 leading-relaxed">
                        {market.outcome_reason}
                    </p>
                )}

                {held && (
                    <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="text-muted-foreground">
                            You backed{' '}
                            <span className="text-white/90 font-medium">
                                {sideLabel(market, held.side)}
                            </span>
                        </span>
                        <span className="text-muted-foreground tabular-nums">
                            <CoinAmount value={held.stake} /> staked
                        </span>
                        {held.status === 'open' ? (
                            <span className="text-white/80 tabular-nums">
                                to win <CoinAmount value={Math.floor(held.shares)} className="font-semibold" />
                                {' '}({formatMultiplier(held.stake, Math.floor(held.shares))})
                            </span>
                        ) : (
                            <span className={cn(
                                'tabular-nums font-semibold',
                                held.status === 'won' ? 'text-emerald-300'
                                    : held.status === 'lost' ? 'text-red-300' : 'text-amber-300',
                            )}>
                                {held.status === 'lost' ? `−${formatCoins(held.stake)}` : `+${formatCoins(held.payout)}`}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {market.match_id && (
                <>
                    <button
                        type="button"
                        onClick={() => setShowInsights(open => !open)}
                        aria-expanded={showInsights}
                        className="px-3 py-1.5 border-t border-white/10 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-white/80 transition-colors"
                    >
                        {showInsights
                            ? <ChevronDown className="size-3 shrink-0" />
                            : <ChevronRight className="size-3 shrink-0" />}
                        Form and Head-to-Head
                    </button>

                    {showInsights && (
                        <div className="px-3 pb-3 pt-1">
                            <MatchupInsights
                                accessToken={accessToken}
                                slug={slug}
                                matchId={market.match_id}
                                onMapSelect={onMapSelect}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    )
}

function SideRow({ market, side }: { market: PredictionMarket; side: PredictionSide }) {
    const team = side === 'a' ? market.team_a : side === 'b' ? market.team_b : null
    const price = priceOf(market, side)
    const backed = market.your_position?.side === side
    const won = market.outcome === side
    const drift = market.status === 'open' ? priceDrift(market, side) : null
    const opened = market.status === 'open' ? openingPriceOf(market, side) : null
    const share = Math.min(100, Math.max(0, price * 100))
    const nameClass = cn(
        'truncate text-sm',
        won ? 'text-emerald-300 font-semibold' : backed ? 'text-white font-medium' : 'text-white/80',
    )

    return (
        <div className={cn(
            'relative flex items-center gap-2 min-w-0 rounded pl-2 pr-2.5 py-1 overflow-hidden',
            backed && 'ring-1 ring-inset ring-white/20',
        )}>
            <span
                aria-hidden
                className={cn('absolute inset-y-0 left-0', SIDE_BAR_STYLES[side], won ? 'opacity-45' : 'opacity-20')}
                style={{ width: `${share}%` }}
            />

            <span className="relative min-w-0 flex-1">
                {side === 'draw'
                    ? <span className={nameClass}>Draw</span>
                    : <TeamName teamId={team?.id} className={nameClass}>{team?.name || 'TBD'}</TeamName>}
            </span>

            <span className="relative shrink-0 flex items-baseline gap-1.5 tabular-nums">
                <span className={cn(
                    'w-7 text-right text-[10px]',
                    drift ? (drift > 0 ? 'text-emerald-300/70' : 'text-red-300/60') : 'text-transparent',
                )}>
                    {drift ? `${drift > 0 ? '+' : ''}${drift}` : '0'}
                </span>
                <span
                    className={cn('w-12 text-right text-sm font-semibold', SIDE_TEXT_STYLES[side])}
                    title={opened !== null ? `Opened at ${formatOdds(opened)}` : undefined}
                >
                    {formatOdds(price)}
                </span>
                <span className="w-10 text-right text-[11px] text-muted-foreground">
                    ({formatPercent(price)})
                </span>
            </span>
        </div>
    )
}
