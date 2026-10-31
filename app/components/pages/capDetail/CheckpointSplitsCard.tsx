import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatCapTime } from '@/app/utils/format'
import {
    DataTableShell,
    DataTableHeaderRow,
    DataTableHeaderCell,
    DataTableRow,
    DataTableCell,
    type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { buildDeltaPoints, buildSyncAnchors, formatSignedDelta, deltaClass } from './capStats'
import type { CapCheckpoint, CapCompareCandidate } from '@/app/utils/api'
import { checkpointCardView, type ComparisonResult } from './runDelta/checkpointCardView'
import type { ReplayCard } from './runDelta/runDeltaCard'
import { RunDeltaChip } from './runDelta/RunDeltaChip'
import { ComparePicker } from './runDelta/ComparePicker'
import { SectorTable } from './runDelta/SectorTable'
import { SpeedTable } from './runDelta/SpeedTable'
import { RoutesDifferView } from './runDelta/RoutesDifferView'
import type { ChartView } from './runDelta/ChartViewToggle'
import { differentLineNote } from './runDelta/runDeltaCopy'
import { sectorZoom, zoomPair, type SpeedZoom } from './runDelta/speedZoom'
import { useRunMotion } from './runDelta/useRunMotion'
import { useNavState } from '@/app/components/navigation/useNavState'

const CheckpointDeltaChart = lazy(() => import('./CheckpointDeltaChart'))
const RunDeltaChart = lazy(() => import('./runDelta/RunDeltaChart'))

interface CheckpointSplitsCardProps {
    capId: string
    capHasReplay: boolean | undefined
    hasCheckpoints: boolean
    checkpoints: CapCheckpoint[]
    capTime: number
    baseline: CapCheckpoint[]
    baselineTime: number | null
    baselineLabel: string
    candidates: CapCompareCandidate[]
    selectedCompareId: string | null
    onSelectCompare: (id: string | null) => void
    comparing: boolean
    comparison: ComparisonResult | null
}

interface ZonetimeViewProps {
    hasCheckpoints: boolean
    hasCandidates: boolean
    checkpoints: CapCheckpoint[]
    capTime: number
    baseline: CapCheckpoint[]
    baselineTime: number | null
    baselineLabel: string
    chartKey: string
}

type SplitsColumnId = 'cp' | 'split' | 'cumulative' | 'splitDelta' | 'cumDelta'

const COLUMN_WIDTH: Record<SplitsColumnId, string> = {
    cp: '4rem',
    split: '5.5rem',
    cumulative: '7rem',
    splitDelta: '6rem',
    cumDelta: '6rem',
}

const COLUMN_PRIORITY: Partial<Record<SplitsColumnId, number>> = {
    split: 20,
    cumulative: 30,
    splitDelta: 50,
    cumDelta: 60,
}

const REQUIRED_COLUMNS = new Set<SplitsColumnId>(['cp'])

function NoSplits({ message }: { message: string }) {
    return (
        <div className="flex items-center justify-center text-sm text-muted-foreground text-center px-4 py-12 h-full">
            {message}
        </div>
    )
}

function ZonesNote({ note }: { note: string }) {
    return (
        <div className="mx-3 mt-3 px-2.5 py-2 rounded-md bg-hairline/[0.03] border border-hairline/[0.08] text-xs text-foreground/80">
            {note}
        </div>
    )
}

interface ReplayViewProps {
    card: ReplayCard
    runnerLabel: string
    referenceLabel: string
    runnerCapId: string
    referenceCapId: string
}

function ReplayView({ card, runnerLabel, referenceLabel, runnerCapId, referenceCapId }: ReplayViewProps) {
    const [chartView, setChartView] = useNavState<ChartView>('checkpointDeltas.chartView', 'cumulative')
    const [storedZoom, setZoom] = useNavState<SpeedZoom | null>('checkpointDeltas.speedZoom', null)
    const pair = zoomPair(runnerCapId, referenceCapId)
    const zoom = storedZoom?.pair === pair ? storedZoom : null
    const { motion, loading } = useRunMotion(runnerCapId, referenceCapId, chartView === 'speed')
    const selectSector = (index: number) => setZoom(zoom?.sector === index ? null : sectorZoom(pair, card.chart.sectors, index))
    return (
        <div
            className="flex flex-col xl:flex-row xl:h-[460px]"
            onKeyDown={event => {
                if (event.key === 'Escape' && zoom && chartView === 'speed') setZoom(null)
            }}
        >
            <div className="xl:w-1/2 xl:h-full xl:border-r border-hairline/5 min-h-0 flex flex-col">
                {chartView === 'speed' ? (
                    <SpeedTable
                        speed={card.speed}
                        differentLineNote={card.flagged ? differentLineNote(runnerLabel, referenceLabel) : null}
                        selectedSector={zoom?.sector ?? null}
                        onSelectSector={selectSector}
                    />
                ) : (
                    <SectorTable
                        rows={card.rows}
                        differentLineNote={card.flagged ? differentLineNote(runnerLabel, referenceLabel) : null}
                    />
                )}
            </div>
            <div className="xl:w-1/2 h-[320px] lg:h-[360px] xl:h-full p-3 min-h-0">
                <Suspense fallback={<div className="h-full bg-hairline/[0.02] border border-hairline/5 rounded-lg animate-pulse" />}>
                    <RunDeltaChart
                        card={card}
                        view={chartView}
                        onViewChange={setChartView}
                        referenceLabel={referenceLabel}
                        speedDetail={{ pair, zoom, motion, loading, onZoom: setZoom }}
                    />
                </Suspense>
            </div>
        </div>
    )
}

function LoadingView() {
    return (
        <div className="flex flex-col xl:flex-row xl:h-[460px] gap-3 p-3" aria-busy="true">
            <div className="xl:w-1/2 h-[320px] xl:h-full bg-hairline/[0.02] border border-hairline/5 rounded-lg animate-pulse" />
            <div className="xl:w-1/2 h-[280px] xl:h-full bg-hairline/[0.02] border border-hairline/5 rounded-lg animate-pulse" />
        </div>
    )
}

export function CheckpointSplitsCard({
    capId, capHasReplay, hasCheckpoints, checkpoints = [], capTime, baseline, baselineTime, baselineLabel,
    candidates, selectedCompareId, onSelectCompare, comparing, comparison,
}: CheckpointSplitsCardProps) {
    const target = useMemo(
        () => candidates.find(c => c.id === selectedCompareId) ?? null,
        [candidates, selectedCompareId],
    )
    const view = useMemo(
        () => checkpointCardView({ capId, capHasReplay, target, result: comparison, zonetimesLoading: comparing }),
        [capId, capHasReplay, target, comparison, comparing],
    )
    const hasCandidates = candidates.length > 0
    const referenceLabel = target ? (target.alias ?? target.user) : ''
    const runner = comparison?.comparison?.runner
    const runnerLabel = runner ? (runner.alias ?? runner.user) : ''

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col overflow-hidden">
            <div className="relative flex flex-col lg:flex-row items-center gap-2 px-4 py-3 border-b border-hairline/5 shrink-0">
                <div className="flex-1 flex items-center justify-center gap-2 min-h-7">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                        Checkpoint Deltas
                    </span>
                    {view.kind !== 'none' && <RunDeltaChip chip={view.chip} />}
                </div>
                {hasCandidates && (
                    <div className="w-full lg:w-auto xl:absolute xl:right-4">
                        <ComparePicker
                            candidates={candidates}
                            capHasReplay={capHasReplay}
                            selectedId={selectedCompareId}
                            onSelect={onSelectCompare}
                            busy={comparing || view.kind === 'loading'}
                        />
                    </div>
                )}
            </div>

            {view.kind === 'replay' ? (
                <ReplayView
                    card={view}
                    runnerLabel={runnerLabel}
                    referenceLabel={referenceLabel}
                    runnerCapId={comparison?.runnerId ?? capId}
                    referenceCapId={comparison?.referenceId ?? selectedCompareId ?? ''}
                />
            ) : view.kind === 'routes_differ' ? (
                <RoutesDifferView card={view} referenceLabel={referenceLabel} />
            ) : view.kind === 'loading' ? (
                <LoadingView />
            ) : (
                <>
                    {view.kind === 'zones' && <ZonesNote note={view.note} />}
                    <ZonetimeView
                        hasCheckpoints={hasCheckpoints}
                        hasCandidates={hasCandidates}
                        checkpoints={checkpoints}
                        capTime={capTime}
                        baseline={baseline}
                        baselineTime={baselineTime}
                        baselineLabel={baselineLabel}
                        chartKey={selectedCompareId ?? 'cmp'}
                    />
                </>
            )}
        </div>
    )
}

function ZonetimeView({
    hasCheckpoints, hasCandidates, checkpoints, capTime, baseline, baselineTime, baselineLabel, chartKey,
}: ZonetimeViewProps) {
    const baseByZone = useMemo(
        () => new Map(baseline.map(c => [c.zone, c.cumulative])),
        [baseline],
    )
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

    const presentColumns = useMemo<SplitsColumnId[]>(
        () => canCompare
            ? ['cp', 'split', 'cumulative', 'splitDelta', 'cumDelta']
            : ['cp', 'split', 'cumulative'],
        [canCompare],
    )
    const responsiveColumns = useMemo<ResponsiveColumn[]>(
        () => presentColumns.map(id => ({
            id,
            width: COLUMN_WIDTH[id],
            priority: COLUMN_PRIORITY[id],
            required: REQUIRED_COLUMNS.has(id),
        })),
        [presentColumns],
    )
    const [resolved, setResolved] = useState<Set<SplitsColumnId> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => {
        setResolved(ids as Set<SplitsColumnId>)
    }, [])
    const isVisible = (id: SplitsColumnId) =>
        presentColumns.includes(id) && (!resolved || resolved.has(id))

    if (!hasCheckpoints) return <NoSplits message="No checkpoint splits available for this run." />

    return (
        <div className="flex flex-col lg:flex-row lg:h-[460px]">
            <div className="lg:w-1/2 h-[320px] lg:h-full lg:border-r border-hairline/5 min-h-0 flex flex-col">
                <DataTableShell
                    className="!bg-transparent !border-0 !rounded-none"
                    responsive={{ columns: responsiveColumns, onResolve: handleResolve }}
                >
                    <DataTableHeaderRow>
                        {isVisible('cp') && <DataTableHeaderCell width="4rem" align="center">CP</DataTableHeaderCell>}
                        {isVisible('split') && <DataTableHeaderCell align="right">Split</DataTableHeaderCell>}
                        {isVisible('cumulative') && <DataTableHeaderCell align="right">Cumulative</DataTableHeaderCell>}
                        {isVisible('splitDelta') && <DataTableHeaderCell align="right">Δ Split</DataTableHeaderCell>}
                        {isVisible('cumDelta') && <DataTableHeaderCell align="right">Δ Total</DataTableHeaderCell>}
                    </DataTableHeaderRow>
                    <tbody>
                        {rows.map(({ key, n, segment, cumulative, cumDelta, splitDelta }) => (
                            <DataTableRow key={key}>
                                {isVisible('cp') && (
                                    <DataTableCell align="center">
                                        <span className="text-xs font-mono text-muted-foreground tabular-nums">{n}</span>
                                    </DataTableCell>
                                )}
                                {isVisible('split') && (
                                    <DataTableCell align="right">
                                        <span className="text-xs font-mono tabular-nums text-muted-foreground">
                                            {segment != null ? segment.toFixed(3) : '—'}
                                        </span>
                                    </DataTableCell>
                                )}
                                {isVisible('cumulative') && (
                                    <DataTableCell align="right">
                                        <span className="text-sm font-mono tabular-nums text-foreground">
                                            {formatCapTime(cumulative)}
                                        </span>
                                    </DataTableCell>
                                )}
                                {isVisible('splitDelta') && (
                                    <DataTableCell align="right">
                                        <span className={cn('text-xs font-mono tabular-nums', deltaClass(splitDelta))}>
                                            {splitDelta != null ? formatSignedDelta(splitDelta) : '—'}
                                        </span>
                                    </DataTableCell>
                                )}
                                {isVisible('cumDelta') && (
                                    <DataTableCell align="right">
                                        <span className={cn('text-xs font-mono tabular-nums', deltaClass(cumDelta))}>
                                            {cumDelta != null ? formatSignedDelta(cumDelta) : '—'}
                                        </span>
                                    </DataTableCell>
                                )}
                            </DataTableRow>
                        ))}
                    </tbody>
                </DataTableShell>
            </div>

            <div className="lg:w-1/2 h-[280px] lg:h-full p-3 min-h-0">
                {canCompare && deltaPoints.length >= 2 ? (
                    <Suspense fallback={<div className="h-full bg-hairline/[0.02] border border-hairline/5 rounded-lg animate-pulse" />}>
                        <CheckpointDeltaChart
                            key={chartKey}
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
    )
}
