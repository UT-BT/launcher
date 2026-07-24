import { useMemo, useRef, useState } from 'react'
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip,
    ResponsiveContainer, Brush,
} from 'recharts'
import { ZoomOut } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { Tooltip } from '@/app/components/ui/tooltip'
import { Button } from '@/app/components/ui/button'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { TeamHolders } from '@/app/components/shared/TeamHolders'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import { cn } from '@/lib/utils'
import { formatCapTime, formatAddedDate, formatDelta, displayMapName } from '@/app/utils/format'
import type { ActiveTitle, WorldRecordProgressionEntry } from '@/app/utils/api'

interface WorldRecordProgressionModalProps {
    isOpen: boolean
    onClose: () => void
    mapName: string
    entries: WorldRecordProgressionEntry[]
    currentUserId?: string | number
}

function exactTimestamp(iso: string | null): string {
    if (!iso) return ''
    const d = new Date(iso)
    return isNaN(d.getTime()) ? iso : d.toLocaleString()
}

function relativeTimeAgo(iso: string | null): string {
    if (!iso) return '—'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '—'
    const now = Date.now()
    const diff = Math.max(0, now - d.getTime())
    const days = Math.floor(diff / (24 * 3600 * 1000))
    if (days < 1) return 'today'
    if (days < 7) return `${days}d ago`
    if (days < 30) return `${Math.floor(days / 7)}w ago`
    if (days < 365) return `${Math.floor(days / 30)}mo ago`
    const years = (days / 365).toFixed(1).replace(/\.0$/, '')
    return `${years}y ago`
}

interface ChartPoint {
    timestamp: number
    label: string
    seconds: number
    alias: string
    delta: number | null
    userId: string | null
    title: ActiveTitle | null
}

function ProgressionTooltip({ active, payload }: {
    active?: boolean
    payload?: Array<{ payload: ChartPoint }>
}) {
    if (!active || !payload || payload.length === 0) return null
    const p = payload[0].payload
    return (
        <div className="rounded-lg border border-hairline/10 bg-[rgba(10,10,11,0.97)] px-3 py-2.5 shadow-xl space-y-2 min-w-44">
            <PlayerInfo
                userId={p.userId ?? undefined}
                alias={p.alias}
                title={p.title}
                size="sm"
                interactive={false}
            />
            <div className="flex items-baseline justify-between gap-3 border-t border-hairline/5 pt-1.5">
                <span className="font-mono font-bold tabular-nums text-foreground text-sm">{formatCapTime(p.seconds)}</span>
                {p.delta != null && p.delta > 0
                    ? <span className="font-mono tabular-nums text-emerald-300 text-xs">-{formatDelta(p.delta)}</span>
                    : <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">first</span>}
            </div>
            {p.timestamp > 0 && (
                <div className="text-[10px] text-muted-foreground tabular-nums">
                    {formatAddedDate(new Date(p.timestamp).toISOString())}
                </div>
            )}
        </div>
    )
}

export function WorldRecordProgressionModal({
    isOpen, onClose, mapName, entries, currentUserId,
}: WorldRecordProgressionModalProps) {
    const currentUserIdStr = currentUserId != null ? String(currentUserId) : null
    const [hoverIdx, setHoverIdx] = useState<number | null>(null)
    const [brushRange, setBrushRange] = useState<{ start: number; end: number } | null>(null)
    const brushRef = useRef(brushRange)
    brushRef.current = brushRange

    const sorted = useMemo(() => {
        return [...entries].sort((a, b) => {
            const ta = a.added ? new Date(a.added).getTime() : 0
            const tb = b.added ? new Date(b.added).getTime() : 0
            return ta - tb
        })
    }, [entries])

    const chartData: ChartPoint[] = useMemo(() => {
        return sorted.map((e, i) => {
            const ts = e.added ? new Date(e.added).getTime() : 0
            const prev = i > 0 ? sorted[i - 1] : null
            return {
                timestamp: ts,
                label: e.added ? new Date(e.added).toLocaleDateString(undefined, { year: 'numeric', month: 'short' }) : '',
                seconds: e.cap_time_seconds,
                alias: e.alias ?? 'Unknown',
                delta: prev ? prev.cap_time_seconds - e.cap_time_seconds : null,
                userId: e.user_id ?? null,
                title: e.active_title ?? null,
            }
        })
    }, [sorted])

    if (!isOpen) return null
    if (sorted.length === 0) {
        return (
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={`World Record Progression — ${displayMapName(mapName)}`}
                offsetSidebar
                maxWidth="min(90vw, 800px)"
                className="bg-card/98 border-hairline/5"
                footer={null}
            >
                <div className="py-8 text-center text-sm text-muted-foreground">
                    No world record history yet.
                </div>
            </Modal>
        )
    }

    const current = sorted[sorted.length - 1]
    const first = sorted[0]
    const totalImprovement = sorted.length >= 2 ? first.cap_time_seconds - current.cap_time_seconds : null
    const heldForDays = current.added
        ? Math.max(0, Math.floor((Date.now() - new Date(current.added).getTime()) / (24 * 3600 * 1000)))
        : null
    const currentIsOwn = currentUserId != null && current.user_id != null && String(current.user_id) === String(currentUserId)

    const visibleForScale = brushRange
        ? sorted.slice(brushRange.start, brushRange.end + 1)
        : sorted
    const scaleSource = visibleForScale.length > 0 ? visibleForScale : sorted
    const minSec = Math.min(...scaleSource.map(e => e.cap_time_seconds))
    const maxSec = Math.max(...scaleSource.map(e => e.cap_time_seconds))
    const padding = Math.max((maxSec - minSec) * 0.05, 0.05)

    const reversed = [...sorted].reverse()

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`World Record Progression — ${displayMapName(mapName)}`}
            offsetSidebar
            maxWidth="min(92vw, 880px)"
            className="bg-card/98 border-hairline/5"
            footer={
                <div className="p-3 border-t border-border bg-muted/50 flex justify-end shrink-0">
                    <Button onClick={onClose} variant="secondary">Close</Button>
                </div>
            }
        >
            <div className="space-y-4">
                <div className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg border',
                    currentIsOwn
                        ? 'bg-emerald-500/[0.08] border-emerald-500/30'
                        : 'bg-gradient-to-br from-blue-500/[0.10] via-blue-500/[0.04] to-transparent border-blue-500/30',
                )}>
                    <div className="flex-1 min-w-0 space-y-1">
                        <div className="text-[9px] uppercase tracking-widest text-blue-200/70 font-bold">
                            Current World Record
                        </div>
                        {current.members && current.members.length > 0 ? (
                            <TeamHolders
                                members={current.members}
                                size="sm"
                                currentUserId={currentUserIdStr}
                            />
                        ) : (
                            <PlayerInfo
                                userId={current.user_id ?? undefined}
                                alias={current.alias ?? undefined}
                                title={current.active_title ?? null}
                                size="sm"
                                highlight={currentIsOwn}
                                showYouBadge={currentIsOwn}
                            />
                        )}
                    </div>
                    <div className="text-right shrink-0">
                        <div className="text-2xl font-mono font-bold tabular-nums text-foreground leading-none">
                            {formatCapTime(current.cap_time_seconds)}
                        </div>
                        <Tooltip content={exactTimestamp(current.added)} side="top">
                            <div className="text-[10px] text-muted-foreground tabular-nums mt-1.5">
                                Set {formatAddedDate(current.added ?? '')}
                                {heldForDays != null && heldForDays > 0 && (
                                    <> · held {heldForDays}d</>
                                )}
                            </div>
                        </Tooltip>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-card/50 border border-hairline/5 rounded-lg px-3 py-2">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Records set</div>
                        <div className="text-base font-bold font-mono text-foreground">{sorted.length}</div>
                    </div>
                    <div className="bg-card/50 border border-hairline/5 rounded-lg px-3 py-2">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">Total improvement</div>
                        <div className="text-base font-bold font-mono text-emerald-300">
                            {totalImprovement != null && totalImprovement > 0 ? `-${formatDelta(totalImprovement)}` : '—'}
                        </div>
                    </div>
                    <div className="bg-card/50 border border-hairline/5 rounded-lg px-3 py-2">
                        <div className="text-[9px] uppercase tracking-wider text-muted-foreground">First record</div>
                        <div className="text-base font-bold font-mono text-foreground tabular-nums">
                            {first.added ? formatAddedDate(first.added) : '—'}
                        </div>
                    </div>
                </div>

                {sorted.length >= 2 && (
                    <div className="bg-hairline/[0.02] border border-hairline/5 rounded-lg p-2 h-64 relative [&_.recharts-surface]:outline-none [&_.recharts-wrapper]:outline-none">
                        {brushRange && (
                            <button
                                type="button"
                                onClick={() => setBrushRange(null)}
                                className="absolute top-2 right-2 z-10 inline-flex items-center gap-1 h-5 px-1.5 rounded text-[9px] font-bold uppercase tracking-wider border bg-card/80 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20 transition-colors cursor-pointer"
                                title="Reset zoom"
                            >
                                <ZoomOut className="size-2.5" />
                                Reset
                            </button>
                        )}
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                                data={chartData}
                                margin={{ top: 10, right: 16, bottom: 0, left: 4 }}
                                onMouseMove={(e) => {
                                    if (e && typeof e.activeTooltipIndex === 'number') setHoverIdx(e.activeTooltipIndex)
                                }}
                                onMouseLeave={() => setHoverIdx(null)}
                            >
                                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                                <XAxis
                                    dataKey="timestamp"
                                    type="number"
                                    domain={['dataMin', 'dataMax']}
                                    scale="time"
                                    tickFormatter={(t) => new Date(t).toLocaleDateString(undefined, { year: 'numeric', month: 'short' })}
                                    tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }}
                                    stroke="rgba(255,255,255,0.15)"
                                    minTickGap={48}
                                />
                                <YAxis
                                    dataKey="seconds"
                                    domain={[minSec - padding, maxSec + padding]}
                                    tickFormatter={(v) => formatCapTime(v)}
                                    tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.5)' }}
                                    stroke="rgba(255,255,255,0.15)"
                                    width={64}
                                />
                                <ChartTooltip
                                    cursor={{ stroke: 'rgba(96,165,250,0.4)', strokeDasharray: '3 3' }}
                                    content={<ProgressionTooltip />}
                                />
                                <Line
                                    type="stepAfter"
                                    dataKey="seconds"
                                    stroke="#60a5fa"
                                    strokeWidth={2}
                                    dot={{ r: 3, fill: '#60a5fa', stroke: '#60a5fa' }}
                                    activeDot={{ r: 5, fill: '#93c5fd', stroke: '#60a5fa', strokeWidth: 2 }}
                                    isAnimationActive={false}
                                />
                                {chartData.length > 4 && (
                                    <Brush
                                        dataKey="timestamp"
                                        height={18}
                                        travellerWidth={8}
                                        stroke="rgba(255,255,255,0.2)"
                                        fill="rgba(255,255,255,0.03)"
                                        tickFormatter={() => ''}
                                        startIndex={brushRange?.start}
                                        endIndex={brushRange?.end}
                                        onChange={(r) => {
                                            const { startIndex, endIndex } = r as { startIndex?: number; endIndex?: number }
                                            if (startIndex == null || endIndex == null) return
                                            if (startIndex === 0 && endIndex === chartData.length - 1) {
                                                if (brushRef.current) setBrushRange(null)
                                                return
                                            }
                                            const current = brushRef.current
                                            if (current && current.start === startIndex && current.end === endIndex) return
                                            setBrushRange({ start: startIndex, end: endIndex })
                                        }}
                                    />
                                )}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                <div className="space-y-1.5">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium pl-1">
                        All records ({sorted.length})
                    </div>
                    <ol className="space-y-1">
                        {reversed.map((entry) => {
                            const wrIdx = sorted.indexOf(entry)
                            const priorEntry = wrIdx > 0 ? sorted[wrIdx - 1] : null
                            const delta = priorEntry ? priorEntry.cap_time_seconds - entry.cap_time_seconds : null
                            const isOwn = currentUserId != null && entry.user_id != null && String(entry.user_id) === String(currentUserId)
                            const isCurrent = entry === current
                            const isHovered = hoverIdx === wrIdx
                            return (
                                <li
                                    key={`${entry.cap_id}-${entry.added ?? ''}`}
                                    className={cn(
                                        'flex items-center gap-2.5 px-2.5 py-1.5 rounded-md border transition-colors',
                                        isOwn ? 'bg-emerald-500/[0.07] border-emerald-500/30' :
                                            isCurrent ? 'bg-blue-500/[0.05] border-blue-500/25' :
                                                isHovered ? 'bg-hairline/[0.04] border-hairline/15' :
                                                    'bg-hairline/[0.02] border-hairline/5',
                                    )}
                                >
                                    <span className={cn(
                                        'inline-flex items-center justify-center min-w-8 h-5 px-1 rounded text-[10px] font-bold font-mono shrink-0',
                                        isCurrent ? 'bg-blue-500/20 text-blue-200 border border-blue-500/40' :
                                            'bg-hairline/[0.04] text-muted-foreground/70 border border-hairline/5',
                                    )}>
                                        {isCurrent ? 'WR' : `#${wrIdx + 1}`}
                                    </span>
                                    <span className="flex-1 min-w-0">
                                        {entry.members && entry.members.length > 0 ? (
                                            <TeamHolders
                                                members={entry.members}
                                                size="sm"
                                                currentUserId={currentUserIdStr}
                                            />
                                        ) : (
                                            <PlayerInfo
                                                userId={entry.user_id ?? undefined}
                                                alias={entry.alias ?? undefined}
                                                title={entry.active_title ?? null}
                                                size="sm"
                                                highlight={isOwn}
                                                showYouBadge={isOwn}
                                            />
                                        )}
                                    </span>
                                    <CapTimeLink
                                        capId={entry.members && entry.members.length > 0 ? undefined : entry.cap_id}
                                        teamCapId={entry.members && entry.members.length > 0 ? entry.cap_id : undefined}
                                        seconds={entry.cap_time_seconds}
                                        className="text-xs font-mono tabular-nums text-foreground/85 shrink-0"
                                    />
                                    <span className="text-[10px] font-mono tabular-nums shrink-0 w-16 text-right">
                                        {delta != null && delta > 0
                                            ? <span className="text-emerald-300">-{formatDelta(delta)}</span>
                                            : <span className="text-muted-foreground/60">first</span>}
                                    </span>
                                    <Tooltip content={exactTimestamp(entry.added)} side="top">
                                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 w-20 text-right">
                                            {relativeTimeAgo(entry.added)}
                                        </span>
                                    </Tooltip>
                                </li>
                            )
                        })}
                    </ol>
                </div>
            </div>
        </Modal>
    )
}
