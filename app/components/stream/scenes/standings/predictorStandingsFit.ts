export interface StandingsBox {
    width: number
    height: number
}

export type StandingsRowHeight = 44 | 40 | 36 | 33 | 30

export interface StandingsFit {
    rowHeight: StandingsRowHeight
    columns: number
    perColumn: number
    shown: number
    more: number
    columnWidth: number
}

export interface StandingsDensity {
    zoomed: boolean
    title: boolean
    primary: number
    secondary: number
    rank: number
    move: number
    chip: number
}

export const STANDINGS_BOX: StandingsBox = { width: 1792, height: 824 }
export const STANDINGS_HEAD_HEIGHT = 22
export const STANDINGS_HEAD_GAP = 6
export const STANDINGS_COLUMN_GUTTER = 24

const ROW_STEPS: readonly StandingsRowHeight[] = [44, 40, 36, 33, 30]
const COLUMN_CHOICES = [3, 4] as const
const ZOOM_MIN_COLUMN = 480

const DENSITY: Record<StandingsRowHeight, Omit<StandingsDensity, 'zoomed' | 'title'> & { zoom: boolean; title: boolean }> = {
    44: { zoom: true, title: true, primary: 22, secondary: 19, rank: 26, move: 18, chip: 15 },
    40: { zoom: true, title: false, primary: 22, secondary: 19, rank: 25, move: 17, chip: 15 },
    36: { zoom: false, title: false, primary: 21, secondary: 18, rank: 24, move: 17, chip: 14 },
    33: { zoom: false, title: false, primary: 20, secondary: 18, rank: 23, move: 16, chip: 14 },
    30: { zoom: false, title: false, primary: 20, secondary: 17, rank: 22, move: 16, chip: 14 },
}

function columnWidthOf(box: StandingsBox, columns: number): number {
    return (box.width - (columns - 1) * STANDINGS_COLUMN_GUTTER) / columns
}

export function standingsFit(count: number, box: StandingsBox): StandingsFit {
    const rowsHeight = box.height - STANDINGS_HEAD_HEIGHT - STANDINGS_HEAD_GAP
    for (const rowHeight of ROW_STEPS) {
        const capacity = Math.floor(rowsHeight / rowHeight)
        for (const columns of COLUMN_CHOICES) {
            if (columns * capacity >= count) {
                return { rowHeight, columns, perColumn: Math.max(1, Math.ceil(count / columns)), shown: count, more: 0, columnWidth: columnWidthOf(box, columns) }
            }
        }
    }
    const rowHeight = ROW_STEPS[ROW_STEPS.length - 1]
    const columns = COLUMN_CHOICES[COLUMN_CHOICES.length - 1]
    const perColumn = Math.floor(rowsHeight / rowHeight)
    const shown = columns * perColumn - 1
    return { rowHeight, columns, perColumn, shown, more: count - shown, columnWidth: columnWidthOf(box, columns) }
}

export function standingsDensity(fit: Pick<StandingsFit, 'rowHeight' | 'columnWidth'>): StandingsDensity {
    const { zoom, title, ...sizes } = DENSITY[fit.rowHeight]
    const zoomed = zoom && fit.columnWidth >= ZOOM_MIN_COLUMN
    return { ...sizes, zoomed, title: title && zoomed }
}
