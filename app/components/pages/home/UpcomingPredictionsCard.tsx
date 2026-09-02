import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { SpotlightSection, type SectionAccent } from './SpotlightSection'
import {
    fetchUpcomingPredictions, type UpcomingPredictionMarket,
} from '@/app/utils/api'
import {
    PriceBar, formatCoins, formatCountdown, formatPercent, useNow,
} from '@/app/components/pages/events/predictions/predictionsShared'

/**
 * The next few markets closing, across every event the viewer can see. Fetches
 * its own data rather than joining the homepage's bundle: the whole card is
 * absent for most people, and an event with predictions off costs one query that
 * returns nothing.
 */
export function UpcomingPredictionsCard({ accessToken, accent, className, onSeeAll }: {
    accessToken: string
    accent: SectionAccent
    className?: string
    onSeeAll?: () => void
}) {
    const [items, setItems] = useState<UpcomingPredictionMarket[]>([])
    const { navigate } = useNavigation()
    const now = useNow(1000)

    useEffect(() => {
        const controller = new AbortController()
        fetchUpcomingPredictions(accessToken, 4, controller.signal)
            .then(setItems)
            .catch(() => { if (!controller.signal.aborted) setItems([]) })

        return () => controller.abort()
    }, [accessToken])

    // Owns its own heading so it can disappear whole. Most people have no event
    // running, and an empty section with a title is worse than no section.
    if (items.length === 0) return null

    const first = items[0]

    return (
        <SpotlightSection
            title="Closing Soon"
            accent={accent}
            actionLabel="See All"
            onAction={onSeeAll ?? (() => navigate('event-detail', {
                eventSlug: first.tournament_slug, eventTab: 'predictions',
            }))}
            actionView="event-detail"
            actionParams={{ eventSlug: first.tournament_slug, eventTab: 'predictions' }}
            className={className}
        >
        <div className="flex flex-col gap-2">
            {items.map(market => {
                const countdown = formatCountdown(market.closes_at, now)
                const urgent = !!market.closes_at
                    && new Date(market.closes_at).getTime() - now < 60 * 60 * 1000

                return (
                    <NavLink
                        key={market.id}
                        view="event-detail"
                        params={{ eventSlug: market.tournament_slug, eventTab: 'predictions' }}
                        onActivate={() => navigate('event-detail', {
                            eventSlug: market.tournament_slug, eventTab: 'predictions',
                        })}
                        className={cn(
                            'block p-2.5 rounded-lg border bg-card/40 transition-colors hover:border-white/20',
                            urgent ? 'border-amber-500/30' : 'border-white/10',
                        )}
                    >
                        <div className="flex items-center justify-between gap-2 min-w-0 mb-1.5">
                            <span className="text-sm text-white truncate min-w-0">
                                {market.team_a?.name || 'TBD'}
                                <span className="text-muted-foreground"> vs </span>
                                {market.team_b?.name || 'TBD'}
                            </span>
                            {countdown && (
                                <span className={cn(
                                    'shrink-0 text-[11px] tabular-nums',
                                    urgent ? 'text-amber-300 font-medium' : 'text-muted-foreground',
                                )}>
                                    {countdown}
                                </span>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="shrink-0 text-[11px] tabular-nums text-accent-300">
                                {formatPercent(market.price_a)}
                            </span>
                            <PriceBar priceA={market.price_a} className="flex-1" />
                            <span className="shrink-0 text-[11px] tabular-nums text-red-300/90">
                                {formatPercent(market.price_b)}
                            </span>
                        </div>

                        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-muted-foreground min-w-0">
                            <span className="truncate">{market.tournament_name}</span>
                            <span className="shrink-0 tabular-nums">
                                {market.your_position
                                    ? `You backed ${market.your_position.side === 'a'
                                        ? market.team_a?.name ?? 'A' : market.team_b?.name ?? 'B'}`
                                    : `${formatCoins(market.pool_stake)} staked`}
                            </span>
                        </div>
                    </NavLink>
                )
            })}
        </div>
        </SpotlightSection>
    )
}
