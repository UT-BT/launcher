import { useMemo, useRef, useState } from 'react'
import { Area, AreaChart, Brush, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { cn } from '@/lib/utils'
import { Activity, ZoomOut } from 'lucide-react'
import type { LeaderboardEntry, Playtime } from '@/app/utils/api'
import { DAY_MS, bucketByDay, bucketByWeek } from '@/app/utils/chartBuckets'

type Mode = 'caps' | 'playtime'

interface ActivityChartProps {
    leaderboard: LeaderboardEntry[]
    playtime: Playtime[]
}

const DAILY_THRESHOLD_MS = 90 * DAY_MS

export default function ActivityChart({ leaderboard, playtime }: ActivityChartProps) {
    const [mode, setMode] = useState<Mode>('caps')
    const [zoom, setZoom] = useState<{ startMs: number; endMs: number } | null>(null)
    const zoomRef = useRef(zoom)
    zoomRef.current = zoom

    const rawEntries = useMemo(() => {
        if (mode === 'caps') {
            return leaderboard
                .map(e => ({ ts: new Date(e.added).getTime(), v: 1 }))
                .filter(r => !isNaN(r.ts))
        }
        return playtime
            .filter(p => !p.is_spectator)
            .map(p => ({ ts: new Date(p.added).getTime(), v: (p.time_played_seconds || 0) / 3600 }))
            .filter(r => !isNaN(r.ts))
    }, [leaderboard, playtime, mode])

    const data = useMemo(() => {
        const filtered = zoom
            ? rawEntries.filter(r => r.ts >= zoom.startMs && r.ts <= zoom.endMs)
            : rawEntries
        const useDaily = !!zoom && (zoom.endMs - zoom.startMs) < DAILY_THRESHOLD_MS
        const bucket = useDaily ? bucketByDay : bucketByWeek
        return bucket(filtered, r => new Date(r.ts).toISOString(), r => r.v)
    }, [rawEntries, zoom])

    const handleBrushChange = (range: { startIndex?: number; endIndex?: number }) => {
        const { startIndex, endIndex } = range
        if (startIndex == null || endIndex == null) return
        if (startIndex === 0 && endIndex === data.length - 1) return
        const startMs = data[startIndex].week
        const endMs = data[endIndex].weekEnd
        const current = zoomRef.current
        if (current && current.startMs === startMs && current.endMs === endMs) return
        setZoom({ startMs, endMs })
    }

    const yLabel = mode === 'caps' ? 'Caps' : 'Hours'
    const accent = mode === 'caps' ? '#60a5fa' : '#fbbf24'

    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2 flex flex-col gap-1.5 h-full min-h-0 [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none">
            <div className="flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-1.5">
                    <Activity className="size-3 text-muted-foreground" />
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Activity
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {zoom && (
                        <button
                            type="button"
                            onClick={() => setZoom(null)}
                            className="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20 transition-colors cursor-pointer"
                            title="Reset zoom"
                        >
                            <ZoomOut className="size-2.5" />
                            Reset
                        </button>
                    )}
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
                                labelFormatter={(_label, payload) => payload?.[0]?.payload?.rangeLabel ?? _label}
                                formatter={(v: number) => [mode === 'playtime' ? `${v.toFixed(1)} h` : v, yLabel]}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke={accent}
                                strokeWidth={2}
                                fill="url(#activityFill)"
                            />
                            {data.length > 8 && (
                                <Brush
                                    dataKey="label"
                                    height={18}
                                    travellerWidth={8}
                                    stroke="rgba(255,255,255,0.2)"
                                    fill="rgba(255,255,255,0.03)"
                                    tickFormatter={() => ''}
                                    onChange={handleBrushChange}
                                />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    )
}
