import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import type { EventSide, PredictionMarket } from '@/app/utils/api'
import { TeamName } from '../TeamRoster'
import { formatMatchTime } from '../bracket/bracketShared'
import { MatchupInsights } from './MatchupInsights'
import {
    CoinAmount, MarketStatusChip, PriceBar, formatCoins, formatCountdown, formatMultiplier,
    formatPercent, outcomeLabel,
} from './predictionsShared'

interface MarketCardProps {
    slug: string
    accessToken: string
    market: PredictionMarket
    now: number
    canPredict: boolean
    onPredict: (market: PredictionMarket) => void
    onMapSelect?: (mapName: string) => void
}

export function MarketCard({
    slug, accessToken, market, now, canPredict, onPredict, onMapSelect,
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

                <div className="flex flex-col gap-1.5">
                    <SideRow market={market} side="a" />
                    <PriceBar priceA={market.price_a} />
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

                    {market.status === 'open' && canPredict && (
                        <Button size="sm" variant="secondary" onClick={() => onPredict(market)}>
                            {held ? 'Add to prediction' : 'Predict'}
                        </Button>
                    )}
                </div>

                {held && (
                    <div className="pt-2 border-t border-white/10 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="text-muted-foreground">
                            You backed{' '}
                            <span className="text-white/90 font-medium">
                                {held.side === 'a' ? market.team_a?.name || 'Side A' : market.team_b?.name || 'Side B'}
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
                        Form &amp; head-to-head
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

function SideRow({ market, side }: { market: PredictionMarket; side: EventSide }) {
    const team = side === 'a' ? market.team_a : market.team_b
    const price = side === 'a' ? market.price_a : market.price_b
    const backed = market.your_position?.side === side
    const won = market.outcome === side

    return (
        <div className="flex items-center justify-between gap-2 min-w-0">
            <TeamName
                teamId={team?.id}
                className={cn(
                    'truncate text-sm',
                    won ? 'text-emerald-300 font-semibold' : backed ? 'text-white font-medium' : 'text-white/80',
                )}
            >
                {team?.name || 'TBD'}
            </TeamName>
            <span className={cn(
                'shrink-0 text-sm tabular-nums',
                side === 'a' ? 'text-accent-300' : 'text-red-300/90',
            )}>
                {formatPercent(price)}
            </span>
        </div>
    )
}
