import { Trophy, ShieldCheck, Users, Clock, Activity } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCapTime } from '@/app/utils/format'
import type { LeaderboardEntry, Playtime } from '@/app/utils/api'

interface StatsRowProps {
    leaderboard: LeaderboardEntry[]
    playtime: Playtime[]
    loading: boolean
    onShowPlaytimeBreakdown?: () => void
    onShowCapDistribution?: () => void
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

const ENGAGED_PLAYTIME_SECONDS = 300

export function StatsRow({ leaderboard, playtime, loading, onShowPlaytimeBreakdown, onShowCapDistribution }: StatsRowProps) {
    const totalCaps = leaderboard.length
    const verifiedEntries = leaderboard.filter(e => e.verified)
    const verifiedCaps = verifiedEntries.length

    const playtimeByUser = new Map<string, number>()
    let totalPlaytimeSec = 0
    for (const p of playtime) {
        if (p.is_spectator) continue
        const secs = p.time_played_seconds || 0
        totalPlaytimeSec += secs
        const key = String(p.user)
        playtimeByUser.set(key, (playtimeByUser.get(key) ?? 0) + secs)
    }
    let engagedPlayers = 0
    for (const secs of playtimeByUser.values()) {
        if (secs > ENGAGED_PLAYTIME_SECONDS) engagedPlayers++
    }

    const certifiedTimes = leaderboard
        .filter(e => e.cap_type === 2)
        .map(e => e.cap_time_seconds)
    const medianCertified = median(certifiedTimes)

    const tiles: {
        key: string
        label: string
        value: string | null
        subtext?: string
        icon: typeof Activity
        accent: string
        onClick?: () => void
    }[] = [
        { key: 'caps', label: 'Total Caps', value: loading ? null : totalCaps.toLocaleString(), icon: Activity, accent: 'text-blue-300' },
        {
            key: 'verified',
            label: 'Verified Caps',
            value: loading ? null : verifiedCaps.toLocaleString(),
            icon: ShieldCheck,
            accent: 'text-emerald-300',
        },
        {
            key: 'players',
            label: 'Unique Players',
            value: loading ? null : engagedPlayers.toLocaleString(),
            icon: Users,
            accent: 'text-white',
        },
        { key: 'playtime', label: 'Total Playtime', value: loading ? null : formatHours(totalPlaytimeSec), icon: Clock, accent: 'text-amber-300', onClick: onShowPlaytimeBreakdown },
        {
            key: 'median',
            label: 'Median Certified Time',
            value: loading ? null : (medianCertified != null ? formatCapTime(medianCertified) : '—'),
            icon: Trophy,
            accent: 'text-yellow-300',
            onClick: medianCertified != null ? onShowCapDistribution : undefined,
        },
    ]

    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
            {tiles.map(t => {
                const Wrapper: any = t.onClick ? 'button' : 'div'
                return (
                    <Wrapper
                        key={t.key}
                        type={t.onClick ? 'button' : undefined}
                        onClick={t.onClick}
                        className={cn(
                            'bg-card/30 border border-white/5 rounded-xl px-4 py-3 flex items-center gap-3 text-left w-full',
                            t.onClick && 'cursor-pointer hover:bg-card/60 hover:border-white/20 transition-colors',
                        )}
                    >
                        <div className={cn('p-2 rounded-lg bg-white/5', t.accent)}>
                            <t.icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-between gap-1">
                                <span>{t.label}</span>
                                {t.onClick && <span className="text-white/40 normal-case tracking-normal">↗</span>}
                            </div>
                            {t.value === null ? (
                                <div className="mt-1 h-5 w-16 bg-white/5 rounded animate-pulse" />
                            ) : (
                                <div className="flex items-baseline gap-1.5">
                                    <span className={cn('text-lg font-bold font-mono tabular-nums leading-tight', t.accent)}>
                                        {t.value}
                                    </span>
                                    {t.subtext && (
                                        <span className="text-[10px] text-muted-foreground tabular-nums truncate">
                                            {t.subtext}
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </Wrapper>
                )
            })}
        </div>
    )
}
