import { lazy, Suspense, useMemo } from 'react'
import { Loader2, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/app/components/ui/tooltip'
import { formatCapTime } from '@/app/utils/format'
import {
    DataTableShell,
    DataTableHeaderRow,
    DataTableHeaderCell,
    DataTableRow,
    DataTableCell,
} from '@/app/components/shared/DataTable'
import { buildDeltaPoints, formatSignedDelta, deltaClass } from './capStats'
import type { CapCheckpoint } from '@/app/utils/api'

const CheckpointDeltaChart = lazy(() => import('./CheckpointDeltaChart'))

export interface CompareOption {
    id: string
    label: string
}

interface CheckpointSplitsCardProps {
    hasCheckpoints: boolean
    checkpoints: CapCheckpoint[]
    capTime: number
    baseline: CapCheckpoint[]
    baselineTime: number | null
    baselineLabel: string
    compareOptions: CompareOption[]      // same-team caps with checkpoints
    selectedCompareId: string | null
    onSelectCompare: (id: string | null) => void
    comparing: boolean
}

function NoSplits({ message }: { message: string }) {
    return (
        <div className="flex items-center justify-center text-sm text-muted-foreground text-center px-4 py-12 h-full">
            {message}
        </div>
    )
}

export function CheckpointSplitsCard({
    hasCheckpoints, checkpoints, capTime, baseline, baselineTime, baselineLabel,
    compareOptions, selectedCompareId, onSelectCompare, comparing,
}: CheckpointSplitsCardProps) {
    const baseByZone = useMemo(
        () => new Map(baseline.map(c => [c.zone, c.cumulative])),
        [baseline],
    )
    const hasCandidates = compareOptions.length > 0
    const sharedCount = useMemo(
        () => checkpoints.reduce((n, c) => n + (baseByZone.has(c.zone) ? 1 : 0), 0),
        [checkpoints, baseByZone],
    )
    const canCompare = baseline.length > 0 && sharedCount > 0
    const deltaPoints = useMemo(
        () => buildDeltaPoints(checkpoints, baseline, capTime, baselineTime),
        [checkpoints, baseline, capTime, baselineTime],
    )
    const rows = useMemo(() => {
        let prevCum = 0
        const out = checkpoints.map((cp, i) => {
            const baseCum = baseByZone.get(cp.zone)
            const cumDelta = baseCum != null ? cp.cumulative - baseCum : null
            let splitDelta: number | null = null
            if (cumDelta != null) {
                splitDelta = cumDelta - prevCum
                prevCum = cumDelta
            }
            return { key: `${cp.zone}-${i}`, n: i + 1, segment: cp.segment, cumulative: cp.cumulative, cumDelta, splitDelta }
        })
        if (checkpoints.length > 0) {
            const lastCum = checkpoints[checkpoints.length - 1].cumulative
            const cumDelta = baselineTime != null ? capTime - baselineTime : null
            out.push({
                key: 'cap',
                n: checkpoints.length + 1,
                segment: Math.round((capTime - lastCum) * 1000) / 1000,
                cumulative: capTime,
                cumDelta,
                splitDelta: cumDelta != null ? cumDelta - prevCum : null,
            })
        }
        return out
    }, [checkpoints, baseByZone, capTime, baselineTime])

    return (
        <div className="bg-card/30 border border-white/5 rounded-xl flex flex-col overflow-hidden">
            <div className="relative flex items-center px-4 py-3 border-b border-white/5 shrink-0">
                <div className="flex-1 text-center text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Checkpoint Deltas
                </div>
                {hasCheckpoints && hasCandidates && (
                    <div className="absolute right-4 flex items-center gap-2">
                        {comparing && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground inline-flex items-center gap-1">
                            compare vs
                            <Tooltip content="You can only compare against runs done on the same team. Checkpoint zones are mirrored per team, so cross-team splits don't line up." side="top">
                                <Info className="size-3 text-muted-foreground/60" />
                            </Tooltip>
                        </span>
                        <select
                            value={selectedCompareId ?? ''}
                            onChange={(e) => onSelectCompare(e.target.value || null)}
                            style={{ colorScheme: 'dark' }}
                            className="h-7 rounded-md bg-card/60 border border-white/10 text-xs text-white px-2 hover:border-white/20 focus:outline-none focus:border-blue-500/50 cursor-pointer max-w-[16rem]"
                        >
                            {compareOptions.map(o => (
                                <option key={o.id} value={o.id}>{o.label}</option>
                            ))}
                        </select>
                    </div>
                )}
            </div>

            {!hasCheckpoints ? (
                <NoSplits message="No checkpoint splits available for this run." />
            ) : (
                <div className="flex flex-col lg:flex-row lg:h-[460px]">
                    {/* Splits table — scrolls internally so the card stays bounded on long maps */}
                    <div className="lg:w-1/2 h-[320px] lg:h-full lg:border-r border-white/5 min-h-0 flex flex-col">
                        <DataTableShell className="!bg-transparent !border-0 !rounded-none">
                            <DataTableHeaderRow>
                                <DataTableHeaderCell width="4rem" align="center">CP</DataTableHeaderCell>
                                <DataTableHeaderCell align="right">Split</DataTableHeaderCell>
                                <DataTableHeaderCell align="right">Cumulative</DataTableHeaderCell>
                                {canCompare && (
                                    <>
                                        <DataTableHeaderCell align="right">Δ Split</DataTableHeaderCell>
                                        <DataTableHeaderCell align="right">Δ Total</DataTableHeaderCell>
                                    </>
                                )}
                            </DataTableHeaderRow>
                            <tbody>
                                {rows.map(({ key, n, segment, cumulative, cumDelta, splitDelta }) => (
                                    <DataTableRow key={key}>
                                        <DataTableCell align="center">
                                            <span className="text-xs font-mono text-muted-foreground tabular-nums">{n}</span>
                                        </DataTableCell>
                                        <DataTableCell align="right">
                                            <span className="text-xs font-mono tabular-nums text-muted-foreground">
                                                {segment.toFixed(3)}
                                            </span>
                                        </DataTableCell>
                                        <DataTableCell align="right">
                                            <span className="text-sm font-mono tabular-nums text-white">
                                                {formatCapTime(cumulative)}
                                            </span>
                                        </DataTableCell>
                                        {canCompare && (
                                            <>
                                                <DataTableCell align="right">
                                                    <span className={cn('text-xs font-mono tabular-nums', deltaClass(splitDelta))}>
                                                        {splitDelta != null ? formatSignedDelta(splitDelta) : '—'}
                                                    </span>
                                                </DataTableCell>
                                                <DataTableCell align="right">
                                                    <span className={cn('text-xs font-mono tabular-nums', deltaClass(cumDelta))}>
                                                        {cumDelta != null ? formatSignedDelta(cumDelta) : '—'}
                                                    </span>
                                                </DataTableCell>
                                            </>
                                        )}
                                    </DataTableRow>
                                ))}
                            </tbody>
                        </DataTableShell>
                    </div>

                    {/* Delta chart — fills the column height */}
                    <div className="lg:w-1/2 h-[280px] lg:h-full p-3 min-h-0">
                        {canCompare && deltaPoints.length >= 2 ? (
                            <Suspense fallback={<div className="h-full bg-white/[0.02] border border-white/5 rounded-lg animate-pulse" />}>
                                {/* key forces a fresh mount per comparison — recharts keeps stale
                                    state when the number of <Line> segments changes between runs. */}
                                <CheckpointDeltaChart
                                    key={selectedCompareId ?? 'cmp'}
                                    points={deltaPoints}
                                    baselineLabel={baselineLabel}
                                />
                            </Suspense>
                        ) : (
                            <NoSplits message={
                                hasCandidates
                                    ? "No shared checkpoints with this run — likely the other team or a different route, so the splits don't line up."
                                    : 'No same-team run with checkpoints to compare against.'
                            } />
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
