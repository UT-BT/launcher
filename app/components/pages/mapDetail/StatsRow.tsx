import { Trophy, ShieldCheck, Users, Clock, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCapTime } from '@/app/utils/format'
import type { LeaderboardEntry, Playtime } from '@/app/utils/api'

interface StatsRowProps {
    leaderboard: LeaderboardEntry[]
    playtime: Playtime[]
    loading: boolean
}

function formatHours(seconds: number): string {
    const hours = seconds / 3600
    if (hours >= 1000) return `${(hours / 1000).toFixed(1)}k h`
    if (hours >= 10) return `${Math.round(hours)} h`
    if (hours >= 1) return `${hours.toFixed(1)} h`
    const minutes = Math.round(seconds / 60)
    return `${minutes} m`
}

function median(values: number[]): number | null {
    if (values.length === 0) return null
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function StatsRow({ leaderboard, playtime, loading }: StatsRowProps) {
    const totalCaps = leaderboard.length
    const verifiedCaps = leaderboard.filter(e => e.verified).length
    const uniquePlayers = new Set(leaderboard.map(e => String(e.user))).size
    const totalPlaytimeSec = playtime
        .filter(p => !p.is_spectator)
        .reduce((sum, p) => sum + (p.time_played_seconds || 0), 0)
    const certifiedTimes = leaderboard
        .filter(e => e.cap_type === 2)
        .map(e => e.cap_time_seconds)
    const medianCertified = median(certifiedTimes)

    const tiles = [
        { label: 'Total Caps', value: loading ? null : totalCaps.toLocaleString(), icon: Activity, accent: 'text-blue-300' },
        { label: 'Verified', value: loading ? null : verifiedCaps.toLocaleString(), icon: ShieldCheck, accent: 'text-emerald-300' },
        { label: 'Unique Players', value: loading ? null : uniquePlayers.toLocaleString(), icon: Users, accent: 'text-white' },
        { label: 'Total Playtime', value: loading ? null : formatHours(totalPlaytimeSec), icon: Clock, accent: 'text-amber-300' },
        { label: 'Median Certified', value: loading ? null : (medianCertified != null ? formatCapTime(medianCertified) : '—'), icon: Trophy, accent: 'text-yellow-300' },
    ]

    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
            {tiles.map(t => (
                <div
                    key={t.label}
                    className="bg-card/30 border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3"
                >
                    <div className={cn('p-2 rounded-lg bg-white/5', t.accent)}>
                        <t.icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                            {t.label}
                        </div>
                        {t.value === null ? (
                            <div className="mt-1 h-5 w-16 bg-white/5 rounded animate-pulse" />
                        ) : (
                            <div className={cn('text-lg font-bold font-mono tabular-nums leading-tight', t.accent)}>
                                {t.value}
                            </div>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}
