import { toActiveTitle, type ActiveTitle } from '@/app/utils/api'
import { coins, signedCoins } from '../betting/bettingView'
import type { PredictorStandings, PredictorStandingsRow } from './predictorStandingsRead'
import { standingsDensity, standingsFit, type StandingsBox, type StandingsDensity, type StandingsFit } from './predictorStandingsFit'

export type StandingsMove =
    | { kind: 'up' | 'down'; text: string }
    | { kind: 'same'; text: '–' }
    | { kind: 'new'; text: 'New' }

export interface StandingsRowView {
    userId: string
    name: string | null
    title: ActiveTitle | null
    rank: number
    first: boolean
    move: StandingsMove | null
    profit: number
    profitText: string
    pending: boolean
    record: string
}

export interface StandingsWidths {
    rank: number
    move: number
    profit: number
    chip: number
    record: number
}

export interface PredictorStandingsView {
    kicker: 'Projected' | null
    empty: boolean
    fit: StandingsFit
    density: StandingsDensity
    widths: StandingsWidths
    columns: StandingsRowView[][]
    more: string | null
}

const GLYPH_EM = 0.5
const RANK_GLYPH_EM = 0.55
const CHIP_PAD = 16
const PENDING_CHIP_EM = 3.5
const NEW_CHIP_EM = 1.8
const NEW_CHIP_INSET = 6

function moveOf(row: PredictorStandingsRow): StandingsMove | null {
    if (row.new) return { kind: 'new', text: 'New' }
    if (row.movement === null) return null
    if (row.movement > 0) return { kind: 'up', text: `▲${row.movement}` }
    if (row.movement < 0) return { kind: 'down', text: `▼${-row.movement}` }
    return { kind: 'same', text: '–' }
}

function rowView(row: PredictorStandingsRow): StandingsRowView {
    return {
        userId: row.user_id,
        name: row.display_name,
        title: toActiveTitle(row.title),
        rank: row.rank,
        first: row.rank === 1,
        move: moveOf(row),
        profit: row.profit,
        profitText: signedCoins(row.profit),
        pending: row.pending,
        record: `${row.positions_won}/${row.positions_won + row.positions_lost}`,
    }
}

function longest(values: string[]): number {
    return Math.max(1, ...values.map(value => value.length))
}

function glyphs(count: number, size: number, em = GLYPH_EM): number {
    return Math.ceil(count * em * size)
}

function moveWidth(rows: StandingsRowView[], density: StandingsDensity): number {
    const moves = rows.flatMap(row => (row.move ? [row.move] : []))
    const digits = Math.max(0, ...moves.map(move => (move.kind === 'up' || move.kind === 'down' ? move.text.length - 1 : 0)))
    const arrow = Math.ceil((1 + digits * GLYPH_EM) * density.move)
    const chip = moves.some(move => move.kind === 'new')
        ? Math.ceil(NEW_CHIP_EM * (density.chip - 2) + CHIP_PAD) - NEW_CHIP_INSET
        : 0
    return Math.max(arrow, chip)
}

function widthsOf(rows: StandingsRowView[], density: StandingsDensity): StandingsWidths {
    return {
        rank: glyphs(longest(rows.map(row => String(row.rank))), density.rank, RANK_GLYPH_EM),
        move: moveWidth(rows, density),
        profit: glyphs(longest(rows.map(row => row.profitText)), density.primary),
        chip: rows.some(row => row.pending) ? Math.ceil(PENDING_CHIP_EM * density.chip + CHIP_PAD) : 0,
        record: glyphs(longest(rows.map(row => row.record)), density.secondary),
    }
}

function columnMajor<T>(items: T[], columns: number, perColumn: number): T[][] {
    return Array.from({ length: columns }, (_, column) => items.slice(column * perColumn, (column + 1) * perColumn)).filter(column => column.length > 0)
}

export function predictorStandingsView(read: PredictorStandings, box: StandingsBox): PredictorStandingsView {
    const fit = standingsFit(read.items.length, box)
    const density = standingsDensity(fit)
    const rows = read.items.slice(0, fit.shown).map(rowView)
    return {
        kicker: read.any_pending ? 'Projected' : null,
        empty: read.items.length === 0,
        fit,
        density,
        widths: widthsOf(rows, density),
        columns: columnMajor(rows, fit.columns, fit.perColumn),
        more: fit.more > 0 ? `+ ${coins(fit.more)} more predictors` : null,
    }
}
