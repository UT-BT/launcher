import { useCallback, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
    DataTableCell,
    DataTableHeaderCell,
    DataTableHeaderRow,
    DataTableRow,
    DataTableShell,
    type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { useNavState } from '@/app/components/navigation/useNavState'
import { TONE_TEXT } from '@/app/components/pages/capDetail/runDelta/deltaStyles'
import type { AnalysisRun, MatrixCell, MatrixRow } from '../model/analysisModel'
import { runName, RunIdentity } from './RunIdentity'

const SECTOR_COLUMN = 'sector'
const SECTOR_WIDTH = '3.5rem'
const RUN_WIDTH = '5.5rem'

function rowAction(row: MatrixRow): string {
    return row.cue ? `Cue ${row.label}` : 'Seek to the cap'
}

function Cell({ cell }: { cell: MatrixCell | null }) {
    if (!cell) return null
    return (
        <span className="run-compare-matrix-value font-mono tabular-nums">
            <span className="text-foreground">{cell.value}</span>
            {cell.delta && <span className={TONE_TEXT[cell.delta.tone]}>{cell.delta.label}</span>}
            {cell.best && <span className="sr-only">best</span>}
        </span>
    )
}

interface SectorMatrixProps {
    runs: AnalysisRun[]
    rows: MatrixRow[]
    activeCue: string | null
    onRow: (row: MatrixRow) => void
}

export function SectorMatrix({ runs, rows, activeCue, onRow }: SectorMatrixProps) {
    const [storedPick, setPick] = useNavState<string | null>('compare.matrixRun', null)
    const picked = runs.find(run => run.capId === storedPick && !run.reference) ?? runs.find(run => !run.reference) ?? runs[0]
    const [visible, setVisible] = useState<ReadonlySet<string> | null>(null)
    const onResolve = useCallback((ids: Set<string>) => setVisible(ids), [])
    const columns = useMemo<ResponsiveColumn[]>(() => [
        { id: SECTOR_COLUMN, width: SECTOR_WIDTH, required: true, tier: 'essential', label: 'Sector' },
        ...runs.map((run, i): ResponsiveColumn => ({
            id: run.capId,
            width: RUN_WIDTH,
            priority: run.capId === picked?.capId ? 100 : 90 - i,
            tier: 'essential',
            label: runName(run.run),
        })),
    ], [runs, picked?.capId])
    const shown = runs.map(run => !visible || visible.has(run.capId))
    const narrowed = shown.some(isShown => !isShown)
    const zoneStart = rows.findIndex(row => row.kind === 'zone')

    return (
        <div className="run-compare-matrix">
            {narrowed && (
                <div role="group" aria-label="Matrix run" className="run-compare-matrix-pick">
                    {runs.filter(run => !run.reference).map(run => (
                        <button
                            key={run.capId}
                            type="button"
                            aria-pressed={run.capId === picked?.capId}
                            aria-label={`Show ${runName(run.run)}`}
                            className="run-compare-speed-run"
                            onClick={() => setPick(run.capId)}
                        >
                            <span className="run-compare-swatch" style={{ background: run.colour }} />
                            <RunIdentity run={run.run} />
                        </button>
                    ))}
                </div>
            )}
            <DataTableShell className="!bg-transparent !border-0 !rounded-none" responsive={{ columns, onResolve, tableOnly: true }}>
                <DataTableHeaderRow>
                    <DataTableHeaderCell width={SECTOR_WIDTH} align="center">Sector</DataTableHeaderCell>
                    {runs.map((run, i) => shown[i] && (
                        <DataTableHeaderCell key={run.capId} width={RUN_WIDTH} align="right">
                            <span className="run-compare-matrix-run">
                                <span className="run-compare-swatch" style={{ background: run.colour }} />
                                <RunIdentity run={run.run} />
                                {run.reference && <span className="run-compare-badge is-reference">REF</span>}
                            </span>
                        </DataTableHeaderCell>
                    ))}
                </DataTableHeaderRow>
                <tbody>
                    {rows.map((row, r) => (
                        <DataTableRow
                            key={row.key}
                            className={cn('run-compare-matrix-row', r === zoneStart && 'is-group-start', row.kind === 'cap' && 'is-group-start', row.cue && row.cue.key === activeCue && 'is-active')}
                            onClick={() => onRow(row)}
                        >
                            <DataTableCell align="center">
                                <button type="button" aria-label={rowAction(row)} className="run-compare-matrix-label font-mono">{row.label}</button>
                            </DataTableCell>
                            {row.cells.map((cell, i) => shown[i] && (
                                <DataTableCell key={runs[i].capId} align="right" className={cn(cell?.best && 'run-compare-matrix-best')}>
                                    <Cell cell={cell} />
                                </DataTableCell>
                            ))}
                        </DataTableRow>
                    ))}
                </tbody>
            </DataTableShell>
        </div>
    )
}
