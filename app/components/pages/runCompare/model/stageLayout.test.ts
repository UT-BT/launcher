import { describe, expect, it } from 'vitest'
import { packFocus, packStage, STAGE_GAP, usedBounds, type StageBox, type StageLayout } from './stageLayout'

interface Slot {
    kind: 'video' | 'map'
    id: string
}

function slots(count: number, kind: Slot['kind'] = 'video'): Slot[] {
    return Array.from({ length: count }, (_, i) => ({ kind, id: `slot-${i + 1}` }))
}

function expectSixteenByNine(layout: StageLayout<Slot>) {
    for (const { rect } of layout.placed) expect(rect.width / rect.height).toBeCloseTo(16 / 9, 6)
}

function expectInside(layout: StageLayout<Slot>, box: StageBox) {
    for (const { rect } of layout.placed) {
        expect(rect.x).toBeGreaterThanOrEqual(-1e-6)
        expect(rect.y).toBeGreaterThanOrEqual(-1e-6)
        expect(rect.x + rect.width).toBeLessThanOrEqual(box.width + 1e-6)
        expect(rect.y + rect.height).toBeLessThanOrEqual(box.height + 1e-6)
    }
}

function expectNoOverlap(layout: StageLayout<Slot>) {
    layout.placed.forEach(({ rect: a }, i) => {
        layout.placed.slice(i + 1).forEach(({ rect: b }) => {
            const apart = a.x + a.width <= b.x + 1e-6 || b.x + b.width <= a.x + 1e-6
                || a.y + a.height <= b.y + 1e-6 || b.y + b.height <= a.y + 1e-6
            expect(apart).toBe(true)
        })
    })
}

const SIZES: { box: StageBox; widths: number[] }[] = [
    { box: { width: 1280, height: 720 }, widths: [1280, 638, 636.444, 636.444, 424, 424, 421.926, 421.926] },
    { box: { width: 1920, height: 1080 }, widths: [1920, 958, 956.444, 956.444, 637.333, 637.333, 635.259, 635.259] },
    { box: { width: 3840, height: 2160 }, widths: [3840, 1918, 1916.444, 1916.444, 1277.333, 1277.333, 1275.259, 1275.259] },
]

const COLUMNS = [1, 2, 2, 2, 3, 3, 3, 3]
const ROWS = [1, 1, 2, 2, 2, 2, 3, 3]

describe('packing the stage for the largest 16:9 tile', () => {
    for (const { box, widths } of SIZES) {
        describe(`in a ${box.width}×${box.height} stage`, () => {
            widths.forEach((width, i) => {
                const count = i + 1
                it(`packs ${count} tile${count === 1 ? '' : 's'} into ${COLUMNS[i]} column${COLUMNS[i] === 1 ? '' : 's'}`, () => {
                    const layout = packStage(slots(count), box)

                    expect(layout.columns).toBe(COLUMNS[i])
                    expect(layout.rows).toBe(ROWS[i])
                    expect(layout.tileWidth).toBeCloseTo(width, 2)
                    expect(layout.placed.map(p => p.slot.id)).toEqual(slots(count).map(s => s.id))
                    expectSixteenByNine(layout)
                    expectInside(layout, box)
                    expectNoOverlap(layout)
                })
            })
        })
    }

    it('puts two tiles side by side on a wide stage and stacks them on a tall one', () => {
        const wide = packStage(slots(2), { width: 1800, height: 600 })
        const tall = packStage(slots(2), { width: 1000, height: 1200 })

        expect([wide.columns, wide.rows]).toEqual([2, 1])
        expect([tall.columns, tall.rows]).toEqual([1, 2])
        expect(tall.tileWidth).toBeCloseTo(1000, 6)
    })

    it('makes four tiles a 2×2 grid centred in the stage', () => {
        const layout = packStage(slots(4), { width: 1920, height: 1080 })

        expect([layout.columns, layout.rows]).toEqual([2, 2])
        const left = Math.min(...layout.placed.map(p => p.rect.x))
        const right = Math.max(...layout.placed.map(p => p.rect.x + p.rect.width))
        expect(left).toBeCloseTo(1920 - right, 6)
    })

    it('centres a short last row', () => {
        const layout = packStage(slots(3), { width: 1920, height: 1080 })
        const [first, second, third] = layout.placed.map(p => p.rect)

        expect(third.y).toBeGreaterThan(first.y)
        expect(third.x + third.width / 2).toBeCloseTo((first.x + second.x + second.width) / 2, 6)
    })

    it('packs any slot kind the same way', () => {
        const videos = packStage(slots(5), { width: 1920, height: 1080 })
        const mixed = packStage([...slots(4), { kind: 'map' as const, id: 'map' }], { width: 1920, height: 1080 })

        expect(mixed.placed.map(p => p.rect)).toEqual(videos.placed.map(p => p.rect))
        expect(mixed.placed[4].slot).toEqual({ kind: 'map', id: 'map' })
    })

    it('places nothing on an empty or unmeasured stage', () => {
        expect(packStage(slots(0), { width: 1920, height: 1080 }).placed).toEqual([])
        expect(packStage(slots(3), { width: 0, height: 0 }).placed).toEqual([])
    })
})

const FOCUS_SIZES: { box: StageBox; widths: number[] }[] = [
    { box: { width: 1280, height: 720 }, widths: [1020, 1020, 1020, 1020, 1025.69, 1068.593, 1099.238] },
    { box: { width: 1920, height: 1080 }, widths: [1532, 1532, 1532, 1532, 1537.689, 1601.926, 1647.810] },
    { box: { width: 3840, height: 2160 }, widths: [3068, 3068, 3068, 3068, 3073.689, 3201.926, 3293.524] },
]

function focusedRect(layout: StageLayout<Slot>, id: string) {
    return layout.placed.find(p => p.slot.id === id)!.rect
}

function stripRects(layout: StageLayout<Slot>, id: string) {
    return layout.placed.filter(p => p.slot.id !== id).map(p => p.rect)
}

describe('packing the stage around a focused tile', () => {
    for (const { box, widths } of FOCUS_SIZES) {
        describe(`in a ${box.width}×${box.height} stage`, () => {
            widths.forEach((width, i) => {
                const count = i + 2
                it(`gives the focused tile most of the stage and stacks the other ${count - 1} along the right edge`, () => {
                    const focus = `slot-${Math.min(2, count)}`
                    const layout = packFocus(slots(count), focus, box)
                    const big = focusedRect(layout, focus)
                    const strip = stripRects(layout, focus)

                    expect(big.width).toBeCloseTo(width, 2)
                    expect([layout.tileWidth, layout.tileHeight]).toEqual([big.width, big.height])
                    expect(big.width * big.height).toBeGreaterThan(box.width * box.height / 2)
                    expect(layout.placed.map(p => p.slot.id)).toEqual(slots(count).map(s => s.id))
                    expect(strip).toHaveLength(count - 1)
                    for (const rect of strip) {
                        expect(rect.x).toBeCloseTo(big.x + big.width + STAGE_GAP, 6)
                        expect(rect.width).toBeCloseTo(strip[0].width, 6)
                        expect(rect.width).toBeLessThanOrEqual(box.width / 5 + 1e-6)
                    }
                    strip.slice(1).forEach((rect, j) => expect(rect.y).toBeGreaterThan(strip[j].y))
                    expectSixteenByNine(layout)
                    expectInside(layout, box)
                    expectNoOverlap(layout)
                })
            })
        })
    }

    it('centres the focused tile and the strip together when the height limits the tile', () => {
        const box = { width: 2560, height: 1080 }
        const layout = packFocus(slots(8), 'slot-1', box)
        const big = focusedRect(layout, 'slot-1')
        const strip = stripRects(layout, 'slot-1')
        const right = strip[0].x + strip[0].width

        expect(big.height).toBeCloseTo(1080, 6)
        expect(big.x).toBeCloseTo(box.width - right, 6)
        expect(strip[0].y).toBeCloseTo(box.height - (strip[6].y + strip[6].height), 6)
    })

    it('puts the strip along the bottom of a tall stage', () => {
        const box = { width: 800, height: 1200 }
        const layout = packFocus(slots(4), 'slot-3', box)
        const big = focusedRect(layout, 'slot-3')
        const strip = stripRects(layout, 'slot-3')

        expect(big.width).toBeCloseTo(800, 6)
        expect(strip.map(rect => rect.y)).toEqual([strip[0].y, strip[0].y, strip[0].y])
        expect(strip[0].y).toBeCloseTo(big.y + big.height + STAGE_GAP, 6)
        strip.slice(1).forEach((rect, j) => expect(rect.x).toBeGreaterThan(strip[j].x))
        expect(strip[0].height).toBeLessThanOrEqual(1200 / 5 + 1e-6)
        expectSixteenByNine(layout)
        expectInside(layout, box)
        expectNoOverlap(layout)
    })

    it('falls back to the grid for one tile or a focus that has no tile', () => {
        const box = { width: 1920, height: 1080 }

        expect(packFocus(slots(1), 'slot-1', box)).toEqual(packStage(slots(1), box))
        expect(packFocus(slots(3), 'gone', box)).toEqual(packStage(slots(3), box))
        expect(packFocus(slots(3), null, box)).toEqual(packStage(slots(3), box))
        expect(packFocus(slots(3), 'slot-1', { width: 0, height: 0 }).placed).toEqual([])
    })
})

describe('the height the packed tiles use', () => {
    it('spans the topmost to the lowest tile, so a stage can hug its tiles', () => {
        const layout = packStage(slots(2), { width: 1800, height: 900 }, STAGE_GAP)
        const bounds = usedBounds(layout.placed.map(placed => placed.rect))

        expect(bounds.top).toBeGreaterThan(0)
        expect(bounds.height).toBeCloseTo(layout.tileHeight, 6)
        expect(bounds.top + bounds.height).toBeLessThanOrEqual(900)
    })

    it('uses nothing when nothing is placed', () => {
        expect(usedBounds([])).toEqual({ top: 0, height: 0 })
    })
})
