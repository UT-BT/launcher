import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Modal } from '@/app/components/ui/modal'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import {
    fetchEventPredictionPositions,
    type PredictionBacker, type PredictionBoard, type PredictionMarket,
} from '@/app/utils/api'
import {
    CoinAmount, SIDE_BAR_STYLES, SIDE_TEXT_STYLES, formatCoins, formatMultiplier,
    formatPercent, priceOf, sideLabel, sidesOf,
} from './predictionsShared'

/**
 * Who is behind the price. A market's whole claim is that it aggregates what
 * people actually believe, and that is hard to trust while the money is
 * anonymous — so stakes and locked payouts are shown, on both sides.
 */
export function BackersModal({ slug, accessToken, market, viewerId, onClose }: {
    slug: string
    accessToken: string
    market: PredictionMarket
    viewerId?: string
    onClose: () => void
}) {
    const [backers, setBackers] = useState<PredictionBacker[]>([])
    const [totals, setTotals] = useState<PredictionBoard>({})
    const [hidden, setHidden] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!market.match_id) return

        const controller = new AbortController()
        fetchEventPredictionPositions(accessToken, slug, market.match_id, controller.signal)
            .then(data => {
                setBackers(data.items)
                setTotals(data.totals)
                setHidden(data.visible ? null : (data.reason ?? 'Not available yet.'))
            })
            .catch(() => setBackers([]))
            .finally(() => { if (!controller.signal.aborted) setLoading(false) })

        return () => controller.abort()
    }, [accessToken, slug, market.match_id])

    const sides = sidesOf(market)
    const teamA = market.team_a?.name || 'Side A'
    const teamB = market.team_b?.name || 'Side B'
    const pool = sides.reduce((sum, side) => sum + (totals[side] ?? 0), 0)

    return (
        <Modal
            isOpen
            onClose={onClose}
            offsetSidebar
            maxWidth="32rem"
            title={`${teamA} vs ${teamB}`}
        >
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <div className="h-1.5 w-full rounded-full overflow-hidden bg-white/5 flex">
                        {sides.map(side => (
                            <div
                                key={side}
                                className={cn('h-full', SIDE_BAR_STYLES[side])}
                                style={{ width: `${pool > 0 ? ((totals[side] ?? 0) / pool) * 100 : 100 / sides.length}%` }}
                            />
                        ))}
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs tabular-nums">
                        {sides.map(side => (
                            <span key={side} className={cn('truncate', SIDE_TEXT_STYLES[side])}>
                                {sideLabel(market, side)}{' '}
                                <span className="text-muted-foreground">{formatCoins(totals[side] ?? 0)}</span>
                            </span>
                        ))}
                    </div>
                </div>

                {hidden ? (
                    <p className="py-6 text-center text-sm text-muted-foreground max-w-sm mx-auto">
                        {hidden}
                    </p>
                ) : backers.length === 0 ? (
                    <p className="py-6 text-center text-sm text-muted-foreground">
                        {loading ? 'Loading…' : 'Nobody has predicted on this match yet.'}
                    </p>
                ) : (
                    <div className="flex flex-col">
                        {sides.map(side => {
                            const rows = backers.filter(row => row.side === side)
                            if (rows.length === 0) return null

                            return (
                                <div key={side} className="flex flex-col gap-1 py-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={cn(
                                            'text-xs font-bold uppercase tracking-wider',
                                            SIDE_TEXT_STYLES[side],
                                        )}>
                                            {sideLabel(market, side)}
                                        </span>
                                        <span className="text-[11px] text-muted-foreground tabular-nums">
                                            {rows.length} {rows.length === 1 ? 'backer' : 'backers'}
                                        </span>
                                    </div>

                                    {rows.map(row => (
                                        <div
                                            key={row.id}
                                            className={cn(
                                                'flex items-center gap-2 min-w-0 py-1 px-1.5 rounded',
                                                viewerId && row.user_id === viewerId && 'bg-accent-500/[0.08]',
                                            )}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <PlayerInfo
                                                    userId={row.user_id}
                                                    alias={row.alias}
                                                    title={row.title}
                                                    size="sm"
                                                />
                                            </div>
                                            <span className="shrink-0 text-xs tabular-nums text-white/85">
                                                <CoinAmount value={row.stake} />
                                            </span>
                                            <span className="shrink-0 w-16 text-right text-[11px] tabular-nums text-muted-foreground">
                                                {formatMultiplier(row.stake, Math.floor(row.shares))}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )
                        })}
                    </div>
                )}

                {!hidden && backers.length > 0 && (
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                    The multiplier is what each person locked in when they predicted, so earlier backers on a side
                    that has since become the favourite show a better return than the odds now offer. Current odds:{' '}
                    {sides.map(side => `${sideLabel(market, side)} ${formatPercent(priceOf(market, side))}`).join(', ')}.
                </p>
                )}
            </div>
        </Modal>
    )
}
