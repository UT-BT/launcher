import { useEffect } from 'react'
import { Users, Map as MapIcon, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavLink } from '@/app/components/navigation/NavLink'
import type { NavParams } from '@/app/components/navigation/NavigationContext'
import { fetchMapsCount, fetchPlayersCount } from '@/app/utils/api'

interface CommunityStatsRowProps {
    accessToken?: string
    playersOnline: number | null
    newMaps: number
    totalMaps: number | null
    totalPlayers: number | null
    onCountsLoaded: (counts: { mapsCount: number | null; playersCount: number | null }) => void
    className?: string
    refreshKey?: number
    onViewPlayers?: () => void
    onViewServers?: () => void
    onViewMaps?: () => void
    onViewNewMaps?: () => void
}

interface StatTileProps {
    icon: LucideIcon
    label: string
    primaryValue: string | null
    onPrimary?: () => void
    primaryView: string
    secondaryValue: string | null
    secondaryLabel: string
    secondaryTone: string
    onSecondary?: () => void
    secondaryView: string
    secondaryParams?: NavParams
}

function StatTile({ icon: Icon, label, primaryValue, onPrimary, primaryView, secondaryValue, secondaryLabel, secondaryTone, onSecondary, secondaryView, secondaryParams }: StatTileProps) {
    return (
        <div className="flex-1 bg-card/30 border border-hairline/5 rounded-2xl px-4 py-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-hairline/5 text-foreground shrink-0">
                <Icon className="size-4" />
            </div>
            <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                {primaryValue === null ? (
                    <div className="mt-1 h-5 w-16 bg-hairline/5 rounded animate-pulse" />
                ) : (
                    <div className="flex items-baseline gap-2 flex-wrap">
                        <NavLink
                            view={primaryView}
                            onActivate={() => onPrimary?.()}
                            disabled={!onPrimary}
                            className={cn(
                                'text-xl font-bold font-mono tabular-nums text-foreground leading-tight transition-colors',
                                onPrimary && 'cursor-pointer hover:text-accent-300',
                            )}
                        >
                            {primaryValue}
                        </NavLink>
                        {secondaryValue !== null && (
                            <NavLink
                                view={secondaryView}
                                params={secondaryParams}
                                onActivate={() => onSecondary?.()}
                                disabled={!onSecondary}
                                className={cn('text-xs font-semibold tabular-nums transition-colors', onSecondary && 'cursor-pointer', secondaryTone)}
                            >
                                ({secondaryValue} {secondaryLabel})
                            </NavLink>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export function CommunityStatsRow({
    accessToken, playersOnline, newMaps, totalMaps, totalPlayers, onCountsLoaded,
    className, refreshKey,
    onViewPlayers, onViewServers, onViewMaps, onViewNewMaps,
}: CommunityStatsRowProps) {
    const hasCounts = typeof totalMaps === 'number' && typeof totalPlayers === 'number'

    useEffect(() => {
        if (hasCounts) return
        let cancelled = false
        Promise.all([
            fetchMapsCount(accessToken ?? '', {}).catch(() => null),
            fetchPlayersCount(accessToken ?? '').catch(() => null),
        ]).then(([mapsCount, playersCount]) => {
            if (!cancelled) onCountsLoaded({ mapsCount, playersCount })
        })
        return () => { cancelled = true }
    }, [accessToken, hasCounts, refreshKey, onCountsLoaded])

    return (
        <div className={cn('flex gap-4', className)}>
            <StatTile
                icon={Users}
                label="Players"
                primaryValue={typeof totalPlayers === 'number' ? totalPlayers.toLocaleString() : null}
                onPrimary={onViewPlayers}
                primaryView="players"
                secondaryValue={playersOnline === null ? null : playersOnline.toLocaleString()}
                secondaryLabel="online"
                secondaryTone={cn('text-emerald-300', onViewServers && 'hover:text-emerald-200')}
                onSecondary={onViewServers}
                secondaryView="servers"
            />
            <StatTile
                icon={MapIcon}
                label="Maps"
                primaryValue={typeof totalMaps === 'number' ? totalMaps.toLocaleString() : null}
                onPrimary={onViewMaps}
                primaryView="maps"
                secondaryValue={newMaps > 0 ? newMaps.toLocaleString() : null}
                secondaryLabel="new"
                secondaryTone={cn('text-accent-300', onViewNewMaps && 'hover:text-accent-200')}
                onSecondary={onViewNewMaps}
                secondaryView="maps"
                secondaryParams={{ mapsNewOnly: true }}
            />
        </div>
    )
}
