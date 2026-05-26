import { useMemo } from 'react'
import { Trophy, Hash, Repeat, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCapTime } from '@/app/utils/format'
import type { LeaderboardEntry, Playtime } from '@/app/utils/api'

interface YourStatsCardProps {
    currentUserId: string | number | null | undefined
    leaderboard: LeaderboardEntry[]
    playtime: Playtime[]
    totalCaps: number | null
    loading: boolean
    onShowPlaytimeBreakdown?: () => void
}

function formatHours(seconds: number): string {
    const hours = seconds / 3600
    if (hours >= 100) return `${Math.round(hours)} h`
    if (hours >= 1) return `${hours.toFixed(1)} h`
    const minutes = Math.round(seconds / 60)
    return `${minutes} m`
}

export function YourStatsCard({
    currentUserId, leaderboard, playtime, totalCaps, loading, onShowPlaytimeBreakdown,
}: YourStatsCardProps) {
    const userIdStr = currentUserId != null ? String(currentUserId) : null

    const computed = useMemo(() => {
        if (!userIdStr) return null

        // Only verified caps qualify for the leaderboard, so rank should mirror that.
        const verifiedSorted = leaderboard
            .filter(e => e.verified)
            .sort((a, b) => a.cap_time_seconds - b.cap_time_seconds)
        const verifiedIndex = verifiedSorted.findIndex(e => String(e.user) === userIdStr)
        const pbEntry = verifiedIndex >= 0 ? verifiedSorted[verifiedIndex] : null
        const rank = verifiedIndex >= 0 ? verifiedIndex + 1 : null

        const userPlaytime = playtime
            .filter(p => String(p.user) === userIdStr && !p.is_spectator)
            .reduce((sum, p) => sum + (p.time_played_seconds || 0), 0)

        return {
            pbTime: pbEntry?.cap_time_seconds ?? null,
            rank,
            totalRanks: verifiedSorted.length,
            playtimeSeconds: userPlaytime,
        }
    }, [userIdStr, leaderboard, playtime])

    if (!userIdStr) return null

    const isLoading = loading && totalCaps === null
    const hasAnyData =
        computed != null &&
        (computed.pbTime != null || (totalCaps != null && totalCaps > 0) || computed.playtimeSeconds > 0)

    if (!isLoading && !hasAnyData) return null

    const tiles = [
        {
            key: 'pb',
            label: 'Personal Best',
            value: computed?.pbTime != null ? formatCapTime(computed.pbTime) : '—',
            icon: Trophy,
            onClick: undefined as (() => void) | undefined,
            hint: undefined as string | undefined,
        },
        {
            key: 'rank',
            label: 'Your Rank',
            value: computed?.rank != null
                ? `#${computed.rank}${computed.totalRanks ? ` / ${computed.totalRanks}` : ''}`
                : '—',
            icon: Hash,
            onClick: undefined,
            hint: undefined,
        },
        {
            key: 'caps',
            label: 'Total Caps',
            value: totalCaps != null ? totalCaps.toLocaleString() : '—',
            icon: Repeat,
            onClick: undefined,
            hint: undefined,
        },
        {
            key: 'playtime',
            label: 'Your Playtime',
            value: computed?.playtimeSeconds && computed.playtimeSeconds > 0
                ? formatHours(computed.playtimeSeconds)
                : '—',
            icon: Clock,
            onClick: onShowPlaytimeBreakdown,
            hint: onShowPlaytimeBreakdown ? 'View all players →' : undefined,
        },
    ]

    return (
        <div className="bg-emerald-500/[0.04] border border-emerald-500/20 rounded-xl px-3 py-3 shrink-0">
            <div className="text-[10px] uppercase tracking-wider text-emerald-300/80 font-medium mb-2">
                Your Stats
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {tiles.map(t => {
                    const Wrapper: any = t.onClick ? 'button' : 'div'
                    return (
                        <Wrapper
                            key={t.key}
                            type={t.onClick ? 'button' : undefined}
                            onClick={t.onClick}
                            title={t.hint}
                            className={cn(
                                'bg-white/[0.02] border border-white/5 rounded-lg px-3 py-2 flex items-center gap-2.5 text-left w-full',
                                t.onClick && 'cursor-pointer hover:bg-white/[0.05] hover:border-emerald-500/30 transition-colors',
                            )}
                        >
                            <div className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-300">
                                <t.icon className="size-3.5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <div className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center justify-between gap-1">
                                    <span>{t.label}</span>
                                    {t.hint && <span className="text-emerald-300/60 normal-case tracking-normal text-[9px]">↗</span>}
                                </div>
                                {isLoading ? (
                                    <div className="mt-0.5 h-4 w-14 bg-white/5 rounded animate-pulse" />
                                ) : (
                                    <div className={cn('text-sm font-bold font-mono tabular-nums leading-tight text-emerald-300')}>
                                        {t.value}
                                    </div>
                                )}
                            </div>
                        </Wrapper>
                    )
                })}
            </div>
        </div>
    )
}
