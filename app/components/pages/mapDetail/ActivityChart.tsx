import { useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import { Activity } from 'lucide-react'
import type { LeaderboardEntry, Playtime } from '@/app/utils/api'

type Mode = 'caps' | 'playtime'

interface ActivityChartProps {
    leaderboard: LeaderboardEntry[]
    playtime: Playtime[]
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

function bucketByWeek<T>(items: T[], getDate: (item: T) => string, getValue: (item: T) => number): { week: number; label: string; value: number }[] {
    const buckets = new Map<number, number>()
    for (const item of items) {
        const ts = new Date(getDate(item)).getTime()
        if (isNaN(ts)) continue
        const week = Math.floor(ts / WEEK_MS) * WEEK_MS
        buckets.set(week, (buckets.get(week) ?? 0) + getValue(item))
    }
    const sorted = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0])
    return sorted.map(([week, value]) => ({
        week,
        label: new Date(week).toLocaleDateString(undefined, { month: 'short', day: '2-digit' }),
        value,
    }))
}

export default function ActivityChart({ leaderboard, playtime }: ActivityChartProps) {
    const [mode, setMode] = useState<Mode>('caps')

    const data = useMemo(() => {
        if (mode === 'caps') {
            return bucketByWeek(leaderboard, e => e.added, () => 1)
        }
        return bucketByWeek(
            playtime.filter(p => !p.is_spectator),
            p => p.added,
            p => (p.time_played_seconds || 0) / 3600,
        )
    }, [leaderboard, playtime, mode])

    const yLabel = mode === 'caps' ? 'Caps' : 'Hours'
    const accent = mode === 'caps' ? '#60a5fa' : '#fbbf24'

    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2 flex flex-col gap-1.5 h-full min-h-0">
            <div className="flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-1.5">
                    <Activity className="size-3 text-muted-foreground" />
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Activity
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {(['caps', 'playtime'] as Mode[]).map(m => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => setMode(m)}
                            className={cn(
                                'h-5 px-1.5 rounded text-[9px] font-bold uppercase tracking-wider border transition-colors cursor-pointer',
                                mode === m
                                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-200'
                                    : 'bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20',
                            )}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 min-h-0 w-full">
                {data.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                        No activity recorded yet.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="activityFill" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={accent} stopOpacity={0.45} />
                                    <stop offset="100%" stopColor={accent} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                            <XAxis
                                dataKey="label"
                                tick={{ fill: '#9ca3af', fontSize: 10 }}
                                axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                                tickLine={false}
                                minTickGap={20}
                            />
                            <YAxis
                                tick={{ fill: '#9ca3af', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                width={32}
                                allowDecimals={false}
                            />
                            <Tooltip
                                contentStyle={{
                                    background: 'rgba(15,17,21,0.95)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    color: 'white',
                                }}
                                labelStyle={{ color: '#9ca3af', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                                formatter={(v: number) => [mode === 'playtime' ? `${v.toFixed(1)} h` : v, yLabel]}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={accent}
                                strokeWidth={2}
                                fill="url(#activityFill)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    )
}
