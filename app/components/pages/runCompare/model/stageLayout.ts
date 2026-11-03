export const TILE_ASPECT = 16 / 9
export const STAGE_GAP = 4

export interface StageSlot {
    kind: string
    id: string
}

export interface StageBox {
    width: number
    height: number
}

export interface SlotRect {
    x: number
    y: number
    width: number
    height: number
}

export interface PlacedSlot<S extends StageSlot> {
    slot: S
    rect: SlotRect
}

export interface StageLayout<S extends StageSlot> {
    columns: number
    rows: number
    tileWidth: number
    tileHeight: number
    placed: PlacedSlot<S>[]
}

function tileWidthFor(count: number, columns: number, box: StageBox, gap: number): number {
    const rows = Math.ceil(count / columns)
    const byWidth = (box.width - (columns - 1) * gap) / columns
    const byHeight = ((box.height - (rows - 1) * gap) / rows) * TILE_ASPECT
    return Math.min(byWidth, byHeight)
}

export function packStage<S extends StageSlot>(slots: readonly S[], box: StageBox, gap = STAGE_GAP): StageLayout<S> {
    const count = slots.length
    let columns = 0
    let tileWidth = 0
    for (let candidate = 1; candidate <= count; candidate += 1) {
        const width = tileWidthFor(count, candidate, box, gap)
        if (width > tileWidth) {
            columns = candidate
            tileWidth = width
        }
    }
    if (columns === 0) return { columns: 0, rows: 0, tileWidth: 0, tileHeight: 0, placed: [] }

    const rows = Math.ceil(count / columns)
    const tileHeight = tileWidth / TILE_ASPECT
    const top = (box.height - (rows * tileHeight + (rows - 1) * gap)) / 2
    const placed = slots.map((slot, i) => {
        const row = Math.floor(i / columns)
        const inRow = Math.min(columns, count - row * columns)
        const left = (box.width - (inRow * tileWidth + (inRow - 1) * gap)) / 2
        return {
            slot,
            rect: {
                x: left + (i % columns) * (tileWidth + gap),
                y: top + row * (tileHeight + gap),
                width: tileWidth,
                height: tileHeight,
            },
        }
    })
    return { columns, rows, tileWidth, tileHeight, placed }
}
