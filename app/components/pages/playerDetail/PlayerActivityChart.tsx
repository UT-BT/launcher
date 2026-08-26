import { useMemo, useState } from 'react'
import { Area, AreaChart, Brush, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import { Activity } from 'lucide-react'
import type { UserActivityBucket } from '@/app/utils/api'
import { WEEK_MS, formatWeekRange } from '@/app/utils/chartBuckets'

type Mode = 'playtime' | 'caps'

interface PlayerActivityChartProps {
    activity: UserActivityBucket[]
    loading: boolean
}

function formatWeekLabel(iso: string): string {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso
    return d.toLocaleDateString(undefined, { month: 'short', day: '2-digit', year: 'numeric' })
}

export default function PlayerActivityChart({ activity, loading }: PlayerActivityChartProps) {
    const [mode, setMode] = useState<Mode>('playtime')

    const data = useMemo(() => {
        return activity.map(b => {
            const start = new Date(b.week).getTime()
            return {
                label: formatWeekLabel(b.week),
                rangeLabel: isNaN(start) ? b.week : formatWeekRange(start, start + WEEK_MS - 1),
                value: mode === 'caps' ? b.caps : b.hours,
            }
        })
    }, [activity, mode])

    const yLabel = mode === 'caps' ? 'Caps' : 'Hours'
    const accent = mode === 'caps' ? '#60a5fa' : '#fbbf24'

    return (
        <div className="bg-hairline/[0.02] border border-hairline/5 rounded-lg p-2 flex flex-col gap-1.5 h-full min-h-[160px] [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none">
            <div className="flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-1.5">
                    <Activity className="size-3 text-muted-foreground" />
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Activity (lifetime)
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {(['playtime', 'caps'] as Mode[]).map(m => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => setMode(m)}
                            className={cn(
                                'h-5 px-1.5 rounded text-[9px] font-bold uppercase tracking-wider border transition-colors cursor-pointer',
                                mode === m
                                    ? 'bg-accent-500/20 border-accent-500/50 text-accent-200'
                                    : 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20',
                            )}
                        >
                            {m}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 min-h-0 w-full">
                {loading ? (
                    <div className="h-full bg-hairline/5 rounded animate-pulse" />
                ) : data.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                        No activity recorded yet.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="playerActivityFill" x1="0" y1="0" x2="0" y2="1">
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
                                allowDecimals={mode === 'playtime'}
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
                                labelFormatter={(_label, payload) => payload?.[0]?.payload?.rangeLabel ?? _label}
                                formatter={(v) => {
                                    const n = Number(v ?? 0)
                                    return [mode === 'playtime' ? `${n.toFixed(1)} h` : String(n), yLabel] as [string, string]
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={accent}
                                strokeWidth={2}
                                fill="url(#playerActivityFill)"
                            />
                            {data.length > 8 && (
                                <Brush
                                    dataKey="label"
                                    height={18}
                                    travellerWidth={8}
                                    stroke="rgba(255,255,255,0.2)"
                                    fill="rgba(255,255,255,0.03)"
                                    tickFormatter={() => ''}
                                />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    )
}
