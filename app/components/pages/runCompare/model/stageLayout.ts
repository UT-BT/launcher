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

export const FOCUS_STRIP_SHARE = 0.2

function rect(x: number, y: number, width: number): SlotRect {
    return { x, y, width, height: width / TILE_ASPECT }
}

export function packFocus<S extends StageSlot>(slots: readonly S[], focus: string | null, box: StageBox, gap = STAGE_GAP): StageLayout<S> {
    const focused = slots.find(slot => slot.id === focus)
    if (!focused || slots.length < 2 || box.width <= 0 || box.height <= 0) return packStage(slots, box, gap)

    const others = slots.length - 1
    const wide = box.width >= box.height
    const rects = new Map<string, SlotRect>()
    let big: SlotRect
    if (wide) {
        const fitted = ((box.height - (others - 1) * gap) / others) * TILE_ASPECT
        const thumb = Math.min(fitted, box.width * FOCUS_STRIP_SHARE)
        const width = Math.min(box.width - thumb - gap, box.height * TILE_ASPECT)
        const left = (box.width - (width + gap + thumb)) / 2
        big = rect(left, (box.height - width / TILE_ASPECT) / 2, width)
        const thumbHeight = thumb / TILE_ASPECT
        const top = (box.height - (others * thumbHeight + (others - 1) * gap)) / 2
        slots.filter(slot => slot !== focused).forEach((slot, i) => {
            rects.set(slot.id, rect(left + width + gap, top + i * (thumbHeight + gap), thumb))
        })
    } else {
        const fitted = (box.width - (others - 1) * gap) / others
        const thumb = Math.min(fitted, box.height * FOCUS_STRIP_SHARE * TILE_ASPECT)
        const width = Math.min(box.width, (box.height - thumb / TILE_ASPECT - gap) * TILE_ASPECT)
        const top = (box.height - (width / TILE_ASPECT + gap + thumb / TILE_ASPECT)) / 2
        big = rect((box.width - width) / 2, top, width)
        const left = (box.width - (others * thumb + (others - 1) * gap)) / 2
        slots.filter(slot => slot !== focused).forEach((slot, i) => {
            rects.set(slot.id, rect(left + i * (thumb + gap), top + big.height + gap, thumb))
        })
    }
    rects.set(focused.id, big)

    return {
        columns: wide ? 2 : others,
        rows: wide ? others : 2,
        tileWidth: big.width,
        tileHeight: big.height,
        placed: slots.map(slot => ({ slot, rect: rects.get(slot.id)! })),
    }
}
