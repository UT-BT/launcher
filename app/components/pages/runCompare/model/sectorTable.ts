import { SECTOR_COUNT } from '@/app/components/pages/capDetail/runDelta/deltaCurve'
import type { AnalysisRun, MatrixCell, MatrixRow } from './analysisModel'
import { CHECKPOINTS_ONLY, FINAL_TIME_ONLY, mixedSides, sideTagOf } from './laneModel'

export type SectorView = 'sectors' | 'zones'

export const SECTOR_VIEW_LABELS: Record<SectorView, string> = { sectors: 'Sectors', zones: 'Checkpoints' }
export const SECTORS_ONLY = 'Sector times only'

export interface SectorRunRow {
    run: AnalysisRun
    sideLabel: string | null
    cells: (MatrixCell | null)[]
    total: MatrixCell | null
    note: string | null
    sectorMs: number | null
}

export interface SectorTable {
    view: SectorView
    views: SectorView[]
    columns: MatrixRow[]
    cap: MatrixRow | null
    rows: SectorRunRow[]
    scaleMs: number
    ranked: boolean
}

function measured(rows: readonly MatrixRow[], runs: readonly AnalysisRun[]): boolean {
    return rows.some(row => row.cells.some((cell, i) => cell !== null && !runs[i].reference))
}

function sideKey(run: AnalysisRun): string {
    return run.run.side === 0 || run.run.side === 1 ? String(run.run.side) : 'none'
}

function rankedOf(rows: readonly SectorRunRow[]): boolean {
    const counts = new Map<string, number>()
    for (const row of rows) {
        if (row.run.reference || !row.cells.some(cell => cell?.delta)) continue
        counts.set(sideKey(row.run), (counts.get(sideKey(row.run)) ?? 0) + 1)
    }
    return [...counts.values()].some(count => count > 1)
}

function unranked(row: SectorRunRow): SectorRunRow {
    return { ...row, cells: row.cells.map(cell => (cell?.best ? { ...cell, best: false } : cell)) }
}

function noteOf(run: AnalysisRun, view: SectorView, cells: readonly (MatrixCell | null)[]): string | null {
    if (run.reference || cells.some(cell => cell !== null)) return null
    if (run.rung === 'time') return FINAL_TIME_ONLY
    if (run.rung === 'zones') return CHECKPOINTS_ONLY
    if (run.rung === 'replay' && view === 'zones') return SECTORS_ONLY
    return null
}

export function sectorTable(runs: readonly AnalysisRun[], matrix: readonly MatrixRow[], requested: SectorView | null): SectorTable {
    const byKind: Record<SectorView, MatrixRow[]> = {
        sectors: matrix.filter(row => row.kind === 'sector'),
        zones: matrix.filter(row => row.kind === 'zone'),
    }
    const found = (['sectors', 'zones'] as const).filter(view => measured(byKind[view], runs))
    const views: SectorView[] = found.length > 0 ? found : ['sectors']
    const view = requested !== null && views.includes(requested) ? requested : views[0]
    const columns = byKind[view]
    const cap = matrix.find(row => row.kind === 'cap') ?? null
    const mixed = mixedSides(runs.map(run => run.run))
    const rows = runs.map((run, i): SectorRunRow => {
        const cells = columns.map(column => column.cells[i])
        const total = cap?.cells[i] ?? null
        return {
            run,
            sideLabel: sideTagOf(run.run.side, mixed),
            cells,
            total,
            note: noteOf(run, view, cells),
            sectorMs: run.reference && view === 'sectors' && total ? total.valueMs / SECTOR_COUNT : null,
        }
    })
    const gaps = rows.flatMap(row => (row.run.reference ? [] : row.cells.flatMap(cell => (cell?.delta ? [Math.abs(cell.delta.ms)] : []))))
    const ranked = view === 'sectors' && rankedOf(rows)
    return { view, views, columns, cap, rows: ranked ? rows : rows.map(unranked), scaleMs: Math.max(1, ...gaps), ranked }
}

export function gapShade(ms: number, scaleMs: number): number {
    return Math.min(1, Math.abs(ms) / Math.max(1, scaleMs))
}

