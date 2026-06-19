import { useEffect, useState } from 'react'
import { Users, Map as MapIcon, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchMapsCount, fetchPlayersCount } from '@/app/utils/api'

interface CommunityStatsRowProps {
    accessToken?: string
    playersOnline: number | null
    newMaps: number
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
    secondaryValue: string | null
    secondaryLabel: string
    secondaryTone: string
    onSecondary?: () => void
}

function StatTile({ icon: Icon, label, primaryValue, onPrimary, secondaryValue, secondaryLabel, secondaryTone, onSecondary }: StatTileProps) {
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
                        <button
                            type="button"
                            onClick={onPrimary}
                            disabled={!onPrimary}
                            className="text-xl font-bold font-mono tabular-nums text-foreground leading-tight enabled:cursor-pointer enabled:hover:text-accent-300 transition-colors"
                        >
                            {primaryValue}
                        </button>
                        {secondaryValue !== null && (
                            <button
                                type="button"
                                onClick={onSecondary}
                                disabled={!onSecondary}
                                className={cn('text-xs font-semibold tabular-nums transition-colors enabled:cursor-pointer', secondaryTone)}
                            >
                                ({secondaryValue} {secondaryLabel})
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export function CommunityStatsRow({
    accessToken, playersOnline, newMaps, className, refreshKey,
    onViewPlayers, onViewServers, onViewMaps, onViewNewMaps,
}: CommunityStatsRowProps) {
    const [totalMaps, setTotalMaps] = useState<number | null>(null)
    const [totalPlayers, setTotalPlayers] = useState<number | null>(null)

    useEffect(() => {
        if (!accessToken) return
        let cancelled = false
        fetchMapsCount(accessToken, {}).then(n => { if (!cancelled) setTotalMaps(n) }).catch(() => {})
        fetchPlayersCount(accessToken).then(n => { if (!cancelled) setTotalPlayers(n) }).catch(() => {})
        return () => { cancelled = true }
    }, [accessToken, refreshKey])

    return (
        <div className={cn('flex gap-4', className)}>
            <StatTile
                icon={Users}
                label="Players"
                primaryValue={totalPlayers === null ? null : totalPlayers.toLocaleString()}
                onPrimary={onViewPlayers}
                secondaryValue={playersOnline === null ? null : playersOnline.toLocaleString()}
                secondaryLabel="online"
                secondaryTone="text-emerald-300 enabled:hover:text-emerald-200"
                onSecondary={onViewServers}
            />
            <StatTile
                icon={MapIcon}
                label="Maps"
                primaryValue={totalMaps === null ? null : totalMaps.toLocaleString()}
                onPrimary={onViewMaps}
                secondaryValue={newMaps > 0 ? newMaps.toLocaleString() : null}
                secondaryLabel="new"
                secondaryTone="text-accent-300 enabled:hover:text-accent-200"
                onSecondary={onViewNewMaps}
            />
        </div>
    )
}
