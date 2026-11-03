import { describe, expect, it } from 'vitest'
import { packStage, type StageBox, type StageLayout } from './stageLayout'

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
