import { useMemo, useState, type CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import {
    DataTableCell,
    DataTableHeaderCell,
    DataTableHeaderRow,
    DataTableRow,
    DataTableShell,
    type DataTableCards,
    type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { useNavState } from '@/app/components/navigation/useNavState'
import { TONE_STROKE, TONE_TEXT } from '@/app/components/pages/capDetail/runDelta/deltaStyles'
import type { AnalysisRun, MatrixCell, MatrixRow } from '../model/analysisModel'
import { gapShade, SECTOR_VIEW_LABELS, sectorTable, type SectorRunRow, type SectorTable, type SectorView } from '../model/sectorTable'
import { SideTag } from '../stage/Tags'
import { BASELINE, TOTAL, zoneLabel } from './analysisLabels'
import { RunIdentity } from './RunIdentity'

const RUN_COLUMN = 'run'
const TOTAL_COLUMN = 'total'
const RUN_WIDTH = '12rem'
const CELL_WIDTH = '3.5rem'
const ZONE_WIDTH = '4.5rem'
const TOTAL_WIDTH = '10rem'
const SHADE_MIN = 6
const SHADE_RANGE = 26

const LEGENDS: Record<SectorView, string> = {
    sectors: 'Time gained or lost in each tenth of the baseline’s run',
    zones: 'Gap to the baseline at each checkpoint',
}

function shadeOf(cell: MatrixCell | null, scaleMs: number): CSSProperties | undefined {
    if (!cell?.delta || cell.delta.tone === 'even') return undefined
    const percent = Math.round(SHADE_MIN + SHADE_RANGE * gapShade(cell.delta.ms, scaleMs))
    return { background: `color-mix(in srgb, ${TONE_STROKE[cell.delta.tone]} ${percent}%, transparent)` }
}

function columnName(column: MatrixRow): string {
    return column.kind === 'zone' ? zoneLabel(column.label) : column.label
}

function GapValue({ cell, column }: { cell: MatrixCell | null; column: MatrixRow }) {
    if (!cell) return <span aria-hidden="true" className="run-compare-sector-none">–</span>
    if (!cell.delta) return <span className="run-compare-sector-time font-mono tabular-nums">{cell.value}</span>
    return (
        <span className={cn('run-compare-sector-gap font-mono tabular-nums', TONE_TEXT[cell.delta.tone])} title={`${columnName(column)} in ${cell.value}`}>
            {cell.best && <span aria-hidden="true" className="run-compare-best-dot" />}
            {cell.delta.label}
            <span className="sr-only">{`, ${cell.value}${cell.best ? ', fastest' : ''}`}</span>
        </span>
    )
}

function TotalValue({ cell }: { cell: MatrixCell | null }) {
    if (!cell) return null
    return (
        <span className="run-compare-sector-total font-mono tabular-nums">
            <span className="text-foreground">{cell.value}</span>
            {cell.delta && <span className={cn('run-compare-sector-total-gap', TONE_TEXT[cell.delta.tone])}>{cell.delta.label}</span>}
        </span>
    )
}

function RunHead({ row }: { row: SectorRunRow }) {
    const { run } = row
    return (
        <span className="run-compare-sector-run">
            <span className="run-compare-swatch" style={{ background: run.colour }} />
            <RunIdentity run={run.run} withTitle={false} />
            <SideTag side={run.run.side} label={row.sideLabel} />
            {run.reference && <span className="run-compare-baseline-chip">{BASELINE}</span>}
        </span>
    )
}

function Strip({ row, scaleMs }: { row: SectorRunRow; scaleMs: number }) {
    if (row.sectorMs !== null) return null
    if (row.note) return <p className="run-compare-sector-card-note">{row.note}</p>
    return (
        <span aria-hidden="true" className="run-compare-sector-strip">
            {row.cells.map((cell, i) => <span key={i} style={shadeOf(cell, scaleMs)} />)}
        </span>
    )
}

interface SectorTimesProps {
    runs: AnalysisRun[]
    rows: MatrixRow[]
    activeCue: string | null
    onRow: (row: MatrixRow) => void
    heading: 'h2' | 'h3'
}

export function SectorTimes({ runs, rows, activeCue, onRow, heading: Heading }: SectorTimesProps) {
    const [storedView, setView] = useNavState<SectorView | null>('compare.sectorView', null)
    const [compact, setCompact] = useState(false)
    const table: SectorTable = useMemo(() => sectorTable(runs, rows, storedView), [runs, rows, storedView])
    const { columns, cap, scaleMs, view } = table
    const cellWidth = view === 'zones' ? ZONE_WIDTH : CELL_WIDTH
    const responsiveColumns = useMemo<ResponsiveColumn<SectorRunRow>[]>(() => [
        { id: RUN_COLUMN, width: RUN_WIDTH, required: true, tier: 'essential', label: 'Run' },
        ...columns.map((column, i): ResponsiveColumn<SectorRunRow> => ({
            id: column.key,
            width: cellWidth,
            required: true,
            tier: 'detail',
            label: columnName(column),
            cell: row => (row.sectorMs !== null ? null : <GapValue cell={row.cells[i]} column={column} />),
        })),
        { id: TOTAL_COLUMN, width: TOTAL_WIDTH, required: true, tier: 'essential', label: TOTAL },
    ], [columns, cellWidth])
    const cards = useMemo<DataTableCards<SectorRunRow>>(() => ({
        rows: table.rows,
        rowKey: row => row.run.capId,
        face: row => (
            <div className="run-compare-sector-card">
                <div className="run-compare-sector-card-head">
                    <RunHead row={row} />
                    <TotalValue cell={row.total} />
                </div>
                <Strip row={row} scaleMs={scaleMs} />
            </div>
        ),
    }), [table.rows, scaleMs])

    return (
        <section aria-label="Sector Times" className="run-compare-panel">
            <div className="run-compare-panel-head">
                <Heading>Sector Times</Heading>
                {table.views.length > 1 && (
                    <div role="group" aria-label="Sector view" className="run-compare-segmented">
                        {table.views.map(option => (
                            <button key={option} type="button" aria-pressed={option === view} className="run-compare-segment" onClick={() => setView(option)}>
                                {SECTOR_VIEW_LABELS[option]}
                            </button>
                        ))}
                    </div>
                )}
                <ul className="run-compare-legend">
                    <li>{LEGENDS[view]}</li>
                    {table.ranked && <li><span className="run-compare-best-dot" />Fastest in the sector</li>}
                </ul>
            </div>
            <div className="run-compare-matrix">
            {compact && (
                <div role="group" aria-label="Jump to a sector" className="run-compare-sector-jumps">
                    {columns.map(column => (
                        <button
                            key={column.key}
                            type="button"
                            aria-label={column.cue ? `Cue ${column.label}` : `Seek to ${columnName(column)}`}
                            aria-pressed={column.cue !== null && column.cue.key === activeCue}
                            className="run-compare-segment"
                            onClick={() => onRow(column)}
                        >
                            {column.label}
                        </button>
                    ))}
                    {cap && <button type="button" aria-label="Seek to the cap" className="run-compare-segment" onClick={() => onRow(cap)}>{TOTAL}</button>}
                </div>
            )}
            <DataTableShell className="!bg-transparent !border-0 !rounded-none" responsive={{ columns: responsiveColumns, cards, compactAriaLabel: 'Sector times', onCompactChange: setCompact }}>
                <DataTableHeaderRow>
                    <DataTableHeaderCell width={RUN_WIDTH}>Run</DataTableHeaderCell>
                    {columns.map(column => (
                        <DataTableHeaderCell key={column.key} align="center" className="run-compare-sector-headcell px-1">
                            <button
                                type="button"
                                aria-label={column.cue ? `Cue ${column.label}` : `Seek to ${columnName(column)}`}
                                title={columnName(column)}
                                className={cn('run-compare-sector-head', column.cue && column.cue.key === activeCue && 'is-active')}
                                onClick={() => onRow(column)}
                            >
                                {columnName(column)}
                            </button>
                        </DataTableHeaderCell>
                    ))}
                    <DataTableHeaderCell width={TOTAL_WIDTH} align="right" className="run-compare-sector-headcell">
                        {cap && <button type="button" aria-label="Seek to the cap" className="run-compare-sector-head is-total" onClick={() => onRow(cap)}>{TOTAL}</button>}
                    </DataTableHeaderCell>
                </DataTableHeaderRow>
                <tbody>
                    {table.rows.map(row => {
                        const note = row.sectorMs !== null ? null : row.note
                        const blank = row.sectorMs !== null || note !== null
                        return (
                            <DataTableRow key={row.run.capId} className={cn('run-compare-sector-row', row.run.reference && 'is-baseline')}>
                                <DataTableCell className="run-compare-sector-who py-1.5">
                                    <RunHead row={row} />
                                    {note && <span className="run-compare-sector-run-note">{note}</span>}
                                </DataTableCell>
                                {columns.map((column, i) => (
                                    <DataTableCell
                                        key={column.key}
                                        align="center"
                                        className={cn('run-compare-sector-cell px-1 py-1.5', column.cue && column.cue.key === activeCue && 'is-active')}
                                        style={blank ? undefined : shadeOf(row.cells[i], scaleMs)}
                                        onClick={() => onRow(column)}
                                    >
                                        {!blank && <GapValue cell={row.cells[i]} column={column} />}
                                    </DataTableCell>
                                ))}
                                <DataTableCell align="right" className="run-compare-sector-who py-1.5">
                                    <TotalValue cell={row.total} />
                                </DataTableCell>
                            </DataTableRow>
                        )
                    })}
                </tbody>
            </DataTableShell>
            </div>
        </section>
    )
}
