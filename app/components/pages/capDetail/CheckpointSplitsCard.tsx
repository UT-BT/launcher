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
import { buildDeltaPoints, buildSyncAnchors, formatSignedDelta, deltaClass } from './capStats'
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
    compareOptions: CompareOption[]
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
    const round3 = (n: number) => Math.round(n * 1000) / 1000
    const rows = useMemo(() => {
        if (canCompare) {
            const anchors = buildSyncAnchors(checkpoints, baseline, capTime, baselineTime)
            return anchors.slice(1).map((anc, i) => {
                const prev = anchors[i]
                const cumDelta = anc.aTime - anc.bTime
                const prevDelta = prev.aTime - prev.bTime
                return {
                    key: `${anc.label}-${i}`,
                    n: i + 1,
                    segment: round3(anc.aTime - prev.aTime),
                    cumulative: anc.aTime,
                    cumDelta: round3(cumDelta),
                    splitDelta: round3(cumDelta - prevDelta),
                }
            })
        }
        const out = checkpoints.map((cp, i) => ({
            key: `${cp.zone}-${i}`, n: i + 1, segment: cp.segment, cumulative: cp.cumulative,
            cumDelta: null as number | null, splitDelta: null as number | null,
        }))
        if (checkpoints.length > 0) {
            const lastCum = checkpoints[checkpoints.length - 1].cumulative
            out.push({
                key: 'cap', n: checkpoints.length + 1,
                segment: round3(capTime - lastCum), cumulative: capTime,
                cumDelta: null, splitDelta: null,
            })
        }
        return out
    }, [canCompare, checkpoints, baseline, capTime, baselineTime])

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
                            className="h-7 rounded-md bg-card/60 border border-white/10 text-xs text-white px-2 hover:border-white/20 focus:outline-none focus:border-accent-500/50 cursor-pointer max-w-[16rem]"
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

                    <div className="lg:w-1/2 h-[280px] lg:h-full p-3 min-h-0">
                        {canCompare && deltaPoints.length >= 2 ? (
                            <Suspense fallback={<div className="h-full bg-white/[0.02] border border-white/5 rounded-lg animate-pulse" />}>
                                <CheckpointDeltaChart
                                    key={selectedCompareId ?? 'cmp'}
                                    points={deltaPoints}
                                    baselineLabel={baselineLabel}
                                />
                            </Suspense>
                        ) : (
                            <NoSplits message={
                                hasCandidates
                                    ? "No shared checkpoints with this run."
                                    : 'No same-team run with checkpoints to compare against.'
                            } />
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
