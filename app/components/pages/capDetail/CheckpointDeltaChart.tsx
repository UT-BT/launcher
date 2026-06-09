import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import { formatSignedDelta } from './capStats'
import type { DeltaPoint } from './capStats'

const GREEN = '#10B981'  // gained time this segment (segment delta decreased)
const RED = '#EF4444'    // lost time this segment
const SLATE = '#64748B'  // no change

interface CheckpointDeltaChartProps {
    points: DeltaPoint[]
    baselineLabel: string
}

function segmentColor(change: number): string {
    if (change < -1e-6) return GREEN
    if (change > 1e-6) return RED
    return SLATE
}

function ColoredDot(props: any) {
    const { cx, cy, payload } = props
    if (cx == null || cy == null) return null
    const d = payload?.delta ?? 0
    const fill = d < -1e-6 ? GREEN : d > 1e-6 ? RED : SLATE
    return <circle cx={cx} cy={cy} r={3} fill={fill} stroke="#0a0a0b" strokeWidth={1} />
}

function DeltaTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null
    const point = payload.find((p: any) => p.dataKey === 'delta') ?? payload[0]
    const delta: number = point?.payload?.delta ?? 0
    const label: string = point?.payload?.label ?? ''
    const status = delta < -1e-6 ? 'ahead' : delta > 1e-6 ? 'behind' : 'even'
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

export default function CheckpointDeltaChart({ points, baselineLabel }: CheckpointDeltaChartProps) {
    if (points.length < 2) {
        return (
            <div className="h-full min-h-[200px] flex items-center justify-center text-xs text-muted-foreground">
                Not enough shared checkpoints to compare.
            </div>
        )
    }

    const segCount = points.length - 1
    const data = points.map(p => {
        const row: Record<string, number | string | null> = { label: p.label, delta: p.delta }
        for (let i = 0; i < segCount; i++) row[`s${i}`] = null
        return row
    })
    const segColors: string[] = []
    for (let i = 0; i < segCount; i++) {
        data[i][`s${i}`] = points[i].delta
        data[i + 1][`s${i}`] = points[i + 1].delta
        segColors.push(segmentColor(points[i + 1].delta - points[i].delta))
    }

    return (
        <div className="bg-white/[0.02] border border-white/5 rounded-lg p-2 h-full flex flex-col min-h-0 [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 pb-1 shrink-0 text-center">
                Delta to {baselineLabel}
            </div>
            <div className="flex-1 min-h-0">
            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }}
                        stroke="rgba(255,255,255,0.15)"
                    />
                    <YAxis
                        tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }}
                        stroke="rgba(255,255,255,0.15)"
                        tickFormatter={(v: number) => formatSignedDelta(v)}
                        width={64}
                    />
                    <ReferenceLine y={0} stroke="rgba(255,255,255,0.3)" strokeDasharray="4 4" />
                    <Tooltip content={<DeltaTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)' }} />
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
            </ResponsiveContainer>
            </div>
        </div>
    )
}
