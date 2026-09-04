import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { fetchUpcomingPredictions, type UpcomingPredictionMarket } from '@/app/utils/api'
import {
    formatCountdown, formatPercent, priceOf, sidesOf, useNow,
} from '@/app/components/pages/events/predictions/predictionsShared'

const WITHIN_HOURS = 3
const URGENT_MS = 30 * 60 * 1000

/**
 * One line at the top of the homepage for markets about to shut, and nothing
 * else. Deliberately not a section: most days there is nothing closing, and the
 * banner has to be able to disappear without leaving a hole.
 *
 * The API only returns markets with a real close time inside the window, so an
 * unscheduled match never appears here — it is not closing soon in any sense.
 */
export function ClosingSoonBanner({ accessToken }: { accessToken: string }) {
    const [items, setItems] = useState<UpcomingPredictionMarket[]>([])
    const { navigate } = useNavigation()
    const now = useNow(1000)

    useEffect(() => {
        const controller = new AbortController()
        fetchUpcomingPredictions(accessToken, { limit: 4, withinHours: WITHIN_HOURS }, controller.signal)
            .then(setItems)
            .catch(() => { if (!controller.signal.aborted) setItems([]) })

        return () => controller.abort()
    }, [accessToken])

    const live = items.filter(market => {
        const closes = market.closes_at ? new Date(market.closes_at).getTime() : 0
        return closes > now
    })

    if (live.length === 0) return null

    return (
        <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.07] px-3 py-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="flex items-center gap-1.5 shrink-0 text-[10px] font-bold uppercase tracking-widest text-amber-300">
                <Timer className="size-3.5" />
                Predictions closing
            </span>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 min-w-0">
                {live.map(market => {
                    const countdown = formatCountdown(market.closes_at, now)
                    const urgent = !!market.closes_at
                        && new Date(market.closes_at).getTime() - now < URGENT_MS

                    return (
                        <NavLink
                            key={market.id}
                            view="event-detail"
                            params={{ eventSlug: market.tournament_slug, eventTab: 'predictions' }}
                            onActivate={() => navigate('event-detail', {
                                eventSlug: market.tournament_slug, eventTab: 'predictions',
                            })}
                            className="group flex items-center gap-2 min-w-0 text-xs hover:text-white transition-colors"
                        >
                            <span className="truncate text-white/85 group-hover:text-white">
                                {market.team_a?.name || 'TBD'}
                                <span className="text-muted-foreground"> v </span>
                                {market.team_b?.name || 'TBD'}
                            </span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">
                                {sidesOf(market).map(side => formatPercent(priceOf(market, side))).join('/')}
                            </span>
                            <span className={cn(
                                'shrink-0 tabular-nums font-medium',
                                urgent ? 'text-amber-300' : 'text-white/70',
                            )}>
                                {countdown}
                            </span>
                            {market.your_position && (
                                <span className="shrink-0 text-[10px] uppercase tracking-wider text-sky-300">In</span>
                            )}
                        </NavLink>
                    )
                })}
            </div>
        </div>
    )
}
