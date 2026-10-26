export interface BettingBox {
    width: number
    height: number
}

export const BETTING_BOX: BettingBox = { width: 1792, height: 824 }

export const ROW_STEPS = [44, 40, 36, 33, 30] as const

export type BettingRowHeight = (typeof ROW_STEPS)[number]

export const BETTING_PARTS = {
    status: 52,
    statusGap: 12,
    plate: 64,
    plateGap: 8,
    heads: 20,
    headsGap: 4,
    maxColumns: 4,
    columnGutter: 16,
    groupGutter: 32,
    zoomMinColumn: 480,
} as const

export interface BettingDensity {
    zoomable: boolean
    primary: number
    secondary: number
    chip: number
    multiplier: boolean
}

const DENSITY: Record<BettingRowHeight, BettingDensity> = {
    44: { zoomable: true, primary: 22, secondary: 19, chip: 15, multiplier: true },
    40: { zoomable: true, primary: 22, secondary: 19, chip: 15, multiplier: true },
    36: { zoomable: false, primary: 21, secondary: 18, chip: 14, multiplier: true },
    33: { zoomable: false, primary: 20, secondary: 18, chip: 14, multiplier: false },
    30: { zoomable: false, primary: 20, secondary: 17, chip: 14, multiplier: false },
}

export interface BettingGroupFit {
    columns: number
    shown: number
    more: number
}

export interface BettingLayout {
    rowHeight: BettingRowHeight
    perColumn: number
    columnWidth: number
    avatarZoom: boolean
    density: BettingDensity
    groups: BettingGroupFit[]
}

function sum(values: number[]): number {
    return values.reduce((total, value) => total + value, 0)
}

function rowsHeight(box: BettingBox): number {
    const p = BETTING_PARTS
    return box.height - p.status - p.statusGap - p.plate - p.plateGap - p.heads - p.headsGap
}

function columnWidth(box: BettingBox, columns: number, groups: number): number {
    const p = BETTING_PARTS
    return (box.width - (columns - groups) * p.columnGutter - (groups - 1) * p.groupGutter) / columns
}

function fitted(box: BettingBox, rowHeight: BettingRowHeight, perColumn: number, counts: readonly number[], columns: number[]): BettingLayout {
    const width = columnWidth(box, sum(columns), counts.length)
    const density = DENSITY[rowHeight]
    return {
        rowHeight,
        perColumn,
        columnWidth: width,
        avatarZoom: density.zoomable && width >= BETTING_PARTS.zoomMinColumn,
        density,
        groups: counts.map((count, index) => {
            const capacity = columns[index] * perColumn
            const shown = count > capacity ? capacity - 1 : count
            return { columns: columns[index], shown, more: count - shown }
        }),
    }
}

function neededColumns(counts: readonly number[], perColumn: number): number[] {
    return counts.map(count => Math.max(1, Math.ceil(count / perColumn)))
}

export function bettingLayout(counts: readonly number[], box: BettingBox = BETTING_BOX): BettingLayout {
    const height = rowsHeight(box)
    for (const rowHeight of ROW_STEPS) {
        const perColumn = Math.floor(height / rowHeight)
        const columns = neededColumns(counts, perColumn)
        if (sum(columns) <= BETTING_PARTS.maxColumns) return fitted(box, rowHeight, perColumn, counts, columns)
    }
    const floor = ROW_STEPS[ROW_STEPS.length - 1]
    const perColumn = Math.floor(height / floor)
    const need = neededColumns(counts, perColumn)
    const columns = counts.map(() => 1)
    for (let spare = BETTING_PARTS.maxColumns - counts.length; spare > 0; spare -= 1) {
        let best = -1
        counts.forEach((count, index) => {
            if (columns[index] >= need[index]) return
            if (best === -1 || count / columns[index] > counts[best] / columns[best]) best = index
        })
        if (best === -1) break
        columns[best] += 1
    }
    return fitted(box, floor, perColumn, counts, columns)
}

export function columnMajor<T>(items: readonly T[], columns: number): T[][] {
    const perColumn = Math.ceil(items.length / columns)
    return Array.from({ length: columns }, (_, column) => items.slice(column * perColumn, (column + 1) * perColumn))
}

const CHIP_EM = { Pending: 3.5, Paid: 1.9, Refunded: 4.1 } as const

export type BettingChipLabel = keyof typeof CHIP_EM

export function numberWidth(text: readonly string[], size: number): number {
    const characters = Math.max(1, ...text.map(value => value.length))
    return Math.ceil(characters * 0.5 * size)
}

export function headWidth(label: string): number {
    return Math.ceil(label.length * 0.64 * 14)
}

export function chipWidth(labels: readonly BettingChipLabel[], size: number): number {
    const em = Math.max(...(labels.length ? labels : ['Paid' as const]).map(label => CHIP_EM[label]))
    return Math.ceil(em * size + 16)
}
