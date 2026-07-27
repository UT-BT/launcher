import type { UserSummary } from '@/app/utils/api'

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

export function PersonalProgressSnapshot({ summary }: { summary: UserSummary | null }) {
    if (!summary) {
        return (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-16 bg-hairline/5 rounded-xl animate-pulse" />
                ))}
            </div>
        )
    }

    const stats = [
        { label: 'Rank', value: (summary.medals?.rank ?? 0) > 0 ? `#${formatStat(summary.medals?.rank)}` : 'Unranked' },
        { label: 'Points', value: formatStat(summary.medals?.points) },
        { label: 'Certified', value: formatStat(summary.counts?.certified_caps) },
        { label: 'Unique Maps', value: formatStat(summary.counts?.unique_maps) },
        { label: 'Uncapped', value: formatStat(summary.counts?.uncapped_maps) },
        { label: 'Playtime', value: formatDurationCompact(summary.counts?.total_playtime_seconds) },
    ]

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {stats.map(stat => (
                <div key={stat.label} className="bg-card/30 border border-hairline/5 rounded-xl px-3 py-2.5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</div>
                    <div className="mt-1 text-lg font-bold font-mono tabular-nums text-foreground truncate">{stat.value}</div>
                </div>
            ))}
        </div>
    )
}
