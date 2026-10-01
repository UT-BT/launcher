import type { UserSummary } from '@/app/utils/api'
import type { CapItAllProgress } from './capItAllProgress'

function formatStat(value: number | null | undefined): string {
    return value == null ? '0' : value.toLocaleString()
}

function formatDurationCompact(seconds: number | null | undefined): string {
    const safeSeconds = Math.max(0, Number(seconds) || 0)
    const hours = Math.floor(safeSeconds / 3600)
    const minutes = Math.floor((safeSeconds % 3600) / 60)
    if (hours > 0) return `${hours.toLocaleString()}h ${minutes}m`
    return `${minutes}m`
}

interface PersonalProgressSnapshotProps {
    summary: UserSummary | null
    capItAll: CapItAllProgress | null
    capItAllLoading: boolean
}

export function PersonalProgressSnapshot({ summary, capItAll, capItAllLoading }: PersonalProgressSnapshotProps) {
    if (!summary) {
        return (
            <div className="grid flex-1 auto-rows-fr grid-cols-2 sm:grid-cols-3 gap-2">
                {Array.from({ length: 9 }).map((_, i) => (
                    <div key={i} className="min-h-16 bg-hairline/5 rounded-xl animate-pulse motion-reduce:animate-none" />
                ))}
            </div>
        )
    }

    const stats = [
        { label: 'Rank', value: (summary.medals?.rank ?? 0) > 0 ? `#${formatStat(summary.medals?.rank)}` : 'Unranked' },
        { label: 'Cap It All Rank', value: capItAll ? (capItAll.rank > 0 ? `#${formatStat(capItAll.rank)}` : 'Unranked') : '—', loading: capItAllLoading, unavailable: !capItAll },
        { label: 'Total Points', value: formatStat(summary.medals?.points) },
        { label: 'Certified Caps', value: formatStat(summary.counts?.certified_caps) },
        { label: 'Unique Maps', value: formatStat(summary.counts?.unique_maps) },
        { label: 'Uncapped Maps', value: formatStat(summary.counts?.uncapped_maps) },
        { label: 'Team Maps Capped', value: capItAll ? formatStat(capItAll.team_caps) : '—', loading: capItAllLoading, unavailable: !capItAll },
        { label: 'World Records', value: formatStat(summary.medals?.world_records) },
        { label: 'Playtime', value: formatDurationCompact(summary.counts?.total_playtime_seconds) },
    ]

    return (
        <div className="grid flex-1 auto-rows-fr grid-cols-2 sm:grid-cols-3 gap-2">
            {stats.map(stat => (
                <div key={stat.label} className="bg-card/30 border border-hairline/5 rounded-xl px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</div>
                    <div className="mt-1 text-center text-lg font-bold font-mono tabular-nums text-foreground truncate" aria-busy={stat.loading || undefined}>
                        {stat.loading ? (
                            <span role="status" aria-label={`Loading ${stat.label}`} className="inline-block h-5 w-12 rounded bg-hairline/5 animate-pulse motion-reduce:animate-none" />
                        ) : (
                            <span title={stat.unavailable ? 'Currently unavailable. Refresh Home to try again.' : undefined} aria-label={stat.unavailable ? 'Currently unavailable' : undefined}>{stat.value}</span>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
