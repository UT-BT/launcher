import { cn } from '@/lib/utils'
import { formatCapTime } from '@/app/utils/format'
import { getMedalIcon } from '@/app/utils/medals'
import type { MapMetadata } from '@/app/utils/api'

interface MedalCardProps {
    map: MapMetadata | null
    loading: boolean
}

const ROWS: { key: keyof MapMetadata; label: string; medal: string; accent: string }[] = [
    { key: 'world_record', label: 'World Record', medal: 'world record', accent: 'text-red-300' },
    { key: 'champion_medal', label: 'Champion', medal: 'champion medal', accent: 'text-purple-300' },
    { key: 'gold_medal', label: 'Gold', medal: 'gold medal', accent: 'text-yellow-300' },
    { key: 'silver_medal', label: 'Silver', medal: 'silver medal', accent: 'text-slate-200' },
    { key: 'bronze_medal', label: 'Bronze', medal: 'bronze medal', accent: 'text-amber-500' },
]

export function MedalCard({ map, loading }: MedalCardProps) {
    return (
        <div className="bg-card/30 border border-white/5 rounded-xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-3 font-medium">
                Medal Thresholds
            </div>
            <div className="space-y-2">
                {ROWS.map(row => {
                    const value = map ? (map[row.key] as number | undefined) : undefined
                    const icon = getMedalIcon(row.medal)
                    return (
                        <div
                            key={row.key}
                            className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/5"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                {icon && <img src={icon} alt="" className="size-5 shrink-0" />}
                                <span className={cn('text-sm font-semibold truncate', row.accent)}>
                                    {row.label}
                                </span>
                            </div>
                            {loading ? (
                                <div className="h-4 w-20 bg-white/5 rounded animate-pulse" />
                            ) : value != null ? (
                                <span className="text-sm font-mono tabular-nums font-bold text-white">
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
