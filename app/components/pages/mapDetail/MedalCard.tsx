import { useMemo } from 'react'
import { Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/app/components/ui/tooltip'
import { formatCapTime } from '@/app/utils/format'
import { getMedalIcon } from '@/app/utils/medals'
import type { MapMetadata, TeamLeaderboardEntry } from '@/app/utils/api'

interface MedalCardProps {
    map: MapMetadata | null
    loading: boolean
    requiredPlayers?: number
    teamLeaderboard?: TeamLeaderboardEntry[]
}

const ROWS: {
    key: keyof MapMetadata
    label: string
    medal: string
    accent: string
    multiplier: number | null
    multiplierLabel: string
}[] = [
    { key: 'world_record', label: 'World Record', medal: 'world record', accent: 'text-blue-300', multiplier: null, multiplierLabel: '' },
    { key: 'champion_medal', label: 'Champion', medal: 'champion medal', accent: 'text-red-300', multiplier: 1.025, multiplierLabel: 'WR + 2.5%' },
    { key: 'gold_medal', label: 'Gold', medal: 'gold medal', accent: 'text-yellow-300', multiplier: 1.125, multiplierLabel: 'WR + 12.5%' },
    { key: 'silver_medal', label: 'Silver', medal: 'silver medal', accent: 'text-slate-200', multiplier: 1.30, multiplierLabel: 'WR + 30%' },
    { key: 'bronze_medal', label: 'Bronze', medal: 'bronze medal', accent: 'text-amber-500', multiplier: 1.60, multiplierLabel: 'WR + 60%' },
]

const EXPLAINER = (
    <div className="space-y-2 max-w-[260px]">
        <div className="text-[10px] uppercase tracking-wider font-bold text-blue-200">
            How medals are calculated
        </div>
        <p className="text-xs text-foreground/85 leading-relaxed">
            The World Record is the fastest verified cap.
        </p>
        <p className="text-xs text-foreground/85 leading-relaxed">
            Champion, Gold, Silver, and Bronze medals are calculated by multiplying the World Record by the factors shown below.
        </p>
        <div className="space-y-1 mt-2">
            {ROWS.filter(r => r.key !== 'world_record').map(r => (
                <div key={r.key} className="flex items-center justify-between gap-3 text-xs">
                    <span className={cn('font-semibold', r.accent)}>{r.label}</span>
                    <span className="font-mono text-foreground/70">{r.multiplierLabel}</span>
                </div>
            ))}
        </div>
        <p className="text-[10px] text-muted-foreground leading-relaxed pt-1 border-t border-hairline/5">
            Only verified caps count toward WR.
        </p>
    </div>
)

export function MedalCard({ map, loading, requiredPlayers, teamLeaderboard }: MedalCardProps) {
    const isTeam = requiredPlayers != null && requiredPlayers > 1

    const teamWorldRecord = useMemo(() => {
        if (!isTeam || !teamLeaderboard?.length) return null
        const verifiedTimes = teamLeaderboard.filter(e => e.verified).map(e => e.cap_time_seconds)
        if (verifiedTimes.length === 0) return null
        return Math.min(...verifiedTimes)
    }, [isTeam, teamLeaderboard])

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Medal Thresholds
                </div>
                <Tooltip content={EXPLAINER} side="top">
                    <button
                        type="button"
                        aria-label="How medal thresholds are calculated"
                        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-hairline/5 transition-colors cursor-help"
                    >
                        <Info className="size-3.5" />
                    </button>
                </Tooltip>
            </div>
            <div className="space-y-2">
                {ROWS.map(row => {
                    const value = isTeam
                        ? (teamWorldRecord != null ? teamWorldRecord * (row.multiplier ?? 1) : undefined)
                        : (map ? (map[row.key] as number | undefined) : undefined)
                    const icon = getMedalIcon(row.medal)
                    return (
                        <div
                            key={row.key}
                            className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-hairline/[0.02] border border-hairline/5"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                {icon && <img src={icon} alt="" className="size-5 shrink-0 object-contain max-w-none" />}
                                <div className="min-w-0 flex flex-col leading-tight">
                                    <span className={cn('text-sm font-semibold truncate', row.accent)}>
                                        {row.label}
                                    </span>
                                </div>
                            </div>
                            {loading ? (
                                <div className="h-4 w-20 bg-hairline/5 rounded animate-pulse" />
                            ) : value != null ? (
                                <span className="text-sm font-mono tabular-nums font-bold text-foreground shrink-0">
                                    {formatCapTime(value)}
                                </span>
                            ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
