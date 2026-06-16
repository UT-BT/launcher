import { useState } from 'react'
import {
    LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { cn } from '@/lib/utils'
import { formatSignedDelta, segmentColor, DELTA_COLORS } from './capStats'
import type { DeltaPoint } from './capStats'

const { gained: GREEN, lost: RED, neutral: SLATE } = DELTA_COLORS

interface CheckpointDeltaChartProps {
    points: DeltaPoint[]
    baselineLabel: string
}

function ColoredDot(props: any) {
    const { cx, cy, payload } = props
    if (cx == null || cy == null) return null
    const d = payload?.delta ?? 0
    const fill = d < -1e-6 ? GREEN : d > 1e-6 ? RED : SLATE
    return <circle cx={cx} cy={cy} r={3} fill={fill} stroke="#0a0a0b" strokeWidth={1} />
}

function DeltaTooltip({ active, payload, valueKey, aheadWord, behindWord }: any) {
    if (!active || !payload?.length) return null
    const point = payload.find((p: any) => p.dataKey === valueKey) ?? payload[0]
    const delta: number = point?.payload?.[valueKey] ?? 0
    const label: string = point?.payload?.label ?? ''
    const status = delta < -1e-6 ? aheadWord : delta > 1e-6 ? behindWord : 'even'
    const statusColor = delta < -1e-6 ? GREEN : delta > 1e-6 ? RED : SLATE
    return (
        <div
            style={{
                backgroundColor: 'rgba(10,10,11,0.95)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                fontSize: 11,
                color: 'white',
                padding: '6px 8px',
            }}
        >
            <div style={{ fontWeight: 700 }}>{label}</div>
            <div style={{ color: statusColor, fontFamily: 'monospace' }}>
                {formatSignedDelta(delta)} ({status})
            </div>
        </div>
    )
}

const AXIS_TICK = { fontSize: 10, fill: 'rgba(255,255,255,0.5)' }
const AXIS_STROKE = 'rgba(255,255,255,0.15)'

export default function CheckpointDeltaChart({ points, baselineLabel }: CheckpointDeltaChartProps) {
    const [mode, setMode] = useState<'cumulative' | 'split'>('cumulative')

    if (points.length < 2) {
        return (
            <div className="h-full min-h-[200px] flex items-center justify-center text-xs text-muted-foreground">
                Not enough shared checkpoints to compare.
            </div>
        )
    }

    const segCount = points.length - 1
    const cumData = points.map(p => {
        const row: Record<string, number | string | null> = { label: p.label, delta: p.delta }
        for (let i = 0; i < segCount; i++) row[`s${i}`] = null
        return row
    })
    const segColors: string[] = []
    for (let i = 0; i < segCount; i++) {
        cumData[i][`s${i}`] = points[i].delta
        cumData[i + 1][`s${i}`] = points[i + 1].delta
        segColors.push(segmentColor(points[i + 1].delta - points[i].delta))
    }

    const splitData = points.slice(1).map((p, i) => ({
        label: p.label,
        seg: Math.round((p.delta - points[i].delta) * 1000) / 1000,
    }))

    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2 h-full flex flex-col min-h-0 [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none">
            <div className="flex items-center justify-between gap-2 px-1 pb-1.5 shrink-0">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">
                    {mode === 'cumulative' ? 'Cumulative' : 'Per split'} · vs {baselineLabel}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                    {(['cumulative', 'split'] as const).map(m => (
                        <button
                            key={m}
                            type="button"
                            onClick={() => setMode(m)}
                            className={cn(
                                'h-6 px-2 rounded text-[10px] font-medium border transition-colors cursor-pointer',
                                mode === m
                                    ? 'bg-accent-500/20 border-accent-500/50 text-accent-200'
                                    : 'bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20',
                            )}
                        >
                            {m === 'cumulative' ? 'Cumulative' : 'Per split'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                    {mode === 'cumulative' ? (
                        <LineChart data={cumData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                            <XAxis dataKey="label" tick={AXIS_TICK} stroke={AXIS_STROKE} />
                            <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} tickFormatter={(v: number) => formatSignedDelta(v)} width={64} />
                            <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" />
                            <Tooltip content={<DeltaTooltip valueKey="delta" aheadWord="ahead" behindWord="behind" />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
                            {segColors.map((c, i) => (
                                <Line
                                    key={i}
                                    dataKey={`s${i}`}
                                    stroke={c}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={false}
                                    isAnimationActive={false}
                                    connectNulls={false}
                                />
                            ))}
                            <Line
                                dataKey="delta"
                                stroke="transparent"
                                strokeWidth={0}
                                dot={<ColoredDot />}
                                activeDot={false}
                                isAnimationActive={false}
                            />
                        </LineChart>
                    ) : (
                        <BarChart data={splitData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                            <XAxis dataKey="label" tick={AXIS_TICK} stroke={AXIS_STROKE} />
                            <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} tickFormatter={(v: number) => formatSignedDelta(v)} width={64} />
                            <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" />
                            <Tooltip content={<DeltaTooltip valueKey="seg" aheadWord="gained" behindWord="lost" />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                            <Bar dataKey="seg" isAnimationActive={false} radius={[2, 2, 0, 0]}>
                                {splitData.map((d, i) => (
                                    <Cell key={i} fill={segmentColor(d.seg)} />
                                ))}
                            </Bar>
                        </BarChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    )
}
