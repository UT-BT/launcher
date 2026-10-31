import { describe, expect, it } from 'vitest'
import { chartRuleVectors, runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import type { CapComparison, CapComparisonPoint } from '@/app/utils/api'
import { buildRunDeltaCard, type ReplayCard, type RunDeltaCardInput } from './runDeltaCard'

const NETTLEZ = { alias: '[UTW]Nettlez', hasReplay: true }

function input(comparison: CapComparison | null, overrides: Partial<RunDeltaCardInput> = {}): RunDeltaCardInput {
    return { comparison, capHasReplay: true, reference: NETTLEZ, ...overrides }
}

function replayCard(comparison: CapComparison): ReplayCard {
    const card = buildRunDeltaCard(input(comparison))
    if (card.kind !== 'replay') throw new Error(`expected a replay card, got ${card.kind}`)
    return card
}

function withSegments(segments: CapComparisonPoint[][]): CapComparison {
    return { ...runCompareFixture('aligned'), segments }
}

describe('the replay chart axes', () => {
    it.each([
        ['short', '11.8 s run'],
        ['aligned', '1:22 run'],
        ['long', '9:37 run'],
        ['separated', 'separated pair'],
    ] as const)('labels the %s run as the chart rules say', (fixture, vectorName) => {
        const vectors = chartRuleVectors()
        const card = replayCard(runCompareFixture(fixture))
        const x = vectors.x.find(v => v.source === `compare_${fixture}.json`)
        const y = vectors.y.find(v => v.name === vectorName)!

        if (x) expect(card.chart.x.ticks.map(t => t.label)).toEqual(x.ticks.map(t => t.label))
        expect(card.chart.y.ticks.map(t => t.label)).toEqual(y.ticks.map(t => t.label))
        expect(card.chart.zeroLineMs).toBe(0)
    })
})

describe('the replay curve', () => {
    it('splits into behind and ahead runs at an interpolated zero crossing', () => {
        const card = replayCard(withSegments([[[0, 0], [1000, 200], [2000, -200], [3000, -100]]]))

        expect(card.chart.curves).toEqual([
            { tone: 'behind', points: [[0, 0], [1000, 200], [1500, 0]], area: [[0, 0], [1000, 200], [1500, 0]] },
            { tone: 'ahead', points: [[1500, 0], [2000, -200], [3000, -100]], area: [[1500, 0], [2000, -200], [3000, -100], [3000, 0]] },
        ])
    })

    it('cuts at a sample that sits exactly on zero', () => {
        const card = replayCard(withSegments([[[0, -50], [500, 0], [1000, 80]]]))

        expect(card.chart.curves.map(c => [c.tone, c.points])).toEqual([
            ['ahead', [[0, -50], [500, 0]]],
            ['behind', [[500, 0], [1000, 80]]],
        ])
    })

    it.each(['aligned', 'separated', 'neverRejoins', 'long', 'short'] as const)(
        'never lets a run of the %s curve change sign',
        (fixture) => {
            const comparison = runCompareFixture(fixture)
            const card = replayCard(comparison)

            for (const curve of card.chart.curves) {
                const sign = curve.tone === 'ahead' ? -1 : 1
                expect(curve.points.every(([, d]) => d === 0 || Math.sign(d) === sign)).toBe(true)
            }
            const drawn = new Set(card.chart.curves.flatMap(c => c.points.map(p => p.join(','))))
            const samples = comparison.segments.filter(s => s.length > 1).flat()
            expect(samples.every(p => drawn.has(p.join(',')))).toBe(true)
        },
    )

    it('closes each tinted area on the zero line', () => {
        const card = replayCard(runCompareFixture('aligned'))

        for (const curve of card.chart.curves) {
            expect(curve.area[0][1]).toBe(0)
            expect(curve.area[curve.area.length - 1][1]).toBe(0)
            expect(curve.area[0][0]).toBe(curve.points[0][0])
            expect(curve.area[curve.area.length - 1][0]).toBe(curve.points[curve.points.length - 1][0])
        }
    })

    it('starts the 1:22 run behind and turns ahead', () => {
        const card = replayCard(runCompareFixture('aligned'))

        expect(card.chart.curves[0].tone).toBe('behind')
        expect(card.chart.curves[0].points.slice(0, 2)).toEqual([[0, 0], [213, 125]])
        expect(card.chart.curves.at(-1)?.tone).toBe('ahead')
        expect(card.chart.curves.at(-1)?.points.at(-1)).toEqual([82421, -1077])
    })
})

describe('different-line bands', () => {
    it('shades each different line and joins its edges with a connector', () => {
        const card = replayCard(runCompareFixture('separated'))

        expect(card.chart.bands).toEqual([
            { startMs: 29800, endMs: 37071, connector: [[29800, -6802], [37071, -11925]], rejoined: true },
            { startMs: 41100, endMs: 44023, connector: [[41100, -12750], [44023, -13371]], rejoined: true },
            { startMs: 46178, endMs: 54300, connector: [[46178, -13412], [54300, -15526]], rejoined: true },
            { startMs: 75726, endMs: 84012, connector: [[75726, -17948], [84012, -23993]], rejoined: true },
        ])
        expect(card.chart.capPoint).toBeNull()
    })

    it('draws no curve inside a band', () => {
        const card = replayCard(runCompareFixture('separated'))

        for (const band of card.chart.bands) {
            const inside = card.chart.curves.flatMap(c => c.points).filter(([t]) => t > band.startMs && t < band.endMs)
            expect(inside).toEqual([])
        }
    })

    it('runs a band that never rejoins to the cap and shows the final gap as a lone point', () => {
        const card = replayCard(runCompareFixture('neverRejoins'))

        expect(card.chart.bands.at(-1)).toEqual({
            startMs: 33600, endMs: 39792, connector: [[33600, -9110], [39792, -14470]], rejoined: false,
        })
        expect(card.chart.capPoint).toEqual({ tMs: 39792, deltaMs: -14470, tone: 'ahead' })
        expect(card.chart.curves.flatMap(c => c.points).some(([t]) => t > 33600)).toBe(false)
    })

    it('has no bands on a clean pair', () => {
        expect(replayCard(runCompareFixture('aligned')).chart.bands).toEqual([])
    })
})

describe('sectors on the chart', () => {
    it('marks ten sectors with their boundaries and S1–S10 labels', () => {
        const card = replayCard(runCompareFixture('aligned'))

        expect(card.chart.sectors.map(s => s.label)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'])
        expect(card.chart.sectors[0]).toEqual({ index: 1, label: 'S1', startMs: 0, endMs: 8242 })
        expect(card.chart.sectors[9]).toEqual({ index: 10, label: 'S10', startMs: 74179, endMs: 82421 })
        expect(card.chart.boundariesMs).toEqual([8242, 16484, 24726, 32968, 41210, 49453, 57695, 65937, 74179])
    })

    it('puts a dot at each sector end on the running gap, coloured by the sector split', () => {
        const card = replayCard(runCompareFixture('aligned'))

        expect(card.chart.dots[0]).toEqual({ index: 1, tMs: 8242, deltaMs: -289, tone: 'ahead', hollow: false })
        expect(card.chart.dots[4]).toEqual({ index: 5, tMs: 41210, deltaMs: -1342, tone: 'behind', hollow: false })
        expect(card.chart.dots.map(d => d.tone)).toEqual([
            'ahead', 'ahead', 'ahead', 'ahead', 'behind', 'behind', 'ahead', 'ahead', 'behind', 'behind',
        ])
    })

    it('hollows the dots of exactly the sectors that left the line', () => {
        const separated = replayCard(runCompareFixture('separated'))
        const neverRejoins = replayCard(runCompareFixture('neverRejoins'))

        expect(separated.chart.dots.filter(d => d.hollow).map(d => d.index)).toEqual([3, 4, 5, 6, 8, 9])
        expect(neverRejoins.chart.dots.filter(d => d.hollow).map(d => d.index)).toEqual([4, 5, 9, 10])
    })
})

describe('sector rows', () => {
    it('lists S1–S10 with split, Δ split and Δ total as on the boards', () => {
        const card = replayCard(runCompareFixture('aligned'))

        expect(card.rows[0]).toEqual({
            index: 1,
            label: 'S1',
            split: { ms: 7953, label: '7.953' },
            deltaSplit: { ms: -289, label: '−0.289', tone: 'ahead' },
            deltaTotal: { ms: -289, label: '−0.289', tone: 'ahead' },
            flagged: false,
        })
        expect(card.rows[4].deltaSplit).toEqual({ ms: 84, label: '+0.084', tone: 'behind' })
        expect(card.rows.map(r => r.label)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'])
    })

    it('ends on the official gap', () => {
        const comparison = runCompareFixture('separated')
        const card = replayCard(comparison)

        expect(card.rows[9].deltaTotal).toEqual({ ms: -27894, label: '−27.894', tone: 'ahead' })
        expect(card.finalGap).toEqual({ ms: comparison.final_delta_ms, label: '−27.894', tone: 'ahead' })
    })

    it('flags the sectors that left the line', () => {
        const card = replayCard(runCompareFixture('separated'))

        expect(card.rows.filter(r => r.flagged).map(r => r.label)).toEqual(['S3', 'S4', 'S5', 'S6', 'S8', 'S9'])
        expect(card.flagged).toBe(true)
        expect(replayCard(runCompareFixture('aligned')).flagged).toBe(false)
    })

    it('writes minute-long splits as clock times', () => {
        const card = replayCard(runCompareFixture('long'))

        expect(card.rows[0].split).toEqual({ ms: 62958, label: '01:02.958' })
        expect(card.rows[5].split).toEqual({ ms: 56732, label: '56.732' })
        expect(card.rows[9].deltaTotal.label).toBe('+22.587')
    })

    it('shows an even gap with ±', () => {
        const comparison = runCompareFixture('aligned')
        comparison.sectors[0] = { ...comparison.sectors[0], delta_split_ms: 0 }
        const card = replayCard(comparison)

        expect(card.rows[0].deltaSplit).toEqual({ ms: 0, label: '±0.000', tone: 'even' })
        expect(card.chart.dots[0].tone).toBe('even')
    })
})

describe('per-sector bars', () => {
    it('draws one bar per sector by its split gap', () => {
        const card = replayCard(runCompareFixture('aligned'))

        expect(card.bars.bars.map(b => b.deltaMs)).toEqual([-289, -170, -645, -322, 84, 469, -84, -351, 79, 152])
        expect(card.bars.bars[5]).toEqual({ index: 6, label: 'S6', deltaMs: 469, tone: 'behind', flagged: false })
        expect(card.bars.y.ticks.map(t => t.label)).toEqual(['−0.5s', '0.0s', '+0.5s'])
    })

    it('flags the bars of sectors that left the line', () => {
        const card = replayCard(runCompareFixture('separated'))

        expect(card.bars.bars.filter(b => b.flagged).map(b => b.index)).toEqual([3, 4, 5, 6, 8, 9])
        expect(card.bars.y.ticks.map(t => t.label)).toEqual(['−4s', '−2s', '0s'])
    })
})

describe('routes differ', () => {
    it('keeps the replay chip with the coverage as a whole percentage and the final gap', () => {
        const card = buildRunDeltaCard(input(runCompareFixture('routesDiffer')))

        expect(card).toEqual({
            kind: 'routes_differ',
            chip: 'REPLAY',
            coveragePercent: 27,
            finalGap: { ms: -90, label: '−0.090', tone: 'ahead' },
        })
    })

    it('falls back instead of showing a coverage it was not given', () => {
        const comparison = { ...runCompareFixture('routesDiffer'), coverage: undefined as unknown as number }

        expect(buildRunDeltaCard(input(comparison)).kind).toBe('zones')
    })
})

describe('the zonetime fallback', () => {
    it('names the run without a replay', () => {
        const card = buildRunDeltaCard(input(null, { reference: { alias: '[Player B]', hasReplay: false } }))

        expect(card).toEqual({
            kind: 'zones',
            chip: 'ZONES',
            note: "[Player B]'s run has no replay, so this uses zone checkpoints.",
        })
    })

    it('says when this run has no replay', () => {
        const card = buildRunDeltaCard(input(null, { capHasReplay: false }))

        expect(card).toEqual({ kind: 'zones', chip: 'ZONES', note: 'This run has no replay, so this uses zone checkpoints.' })
    })

    it('falls back when the comparison could not be loaded', () => {
        const card = buildRunDeltaCard(input(null))

        expect(card).toEqual({
            kind: 'zones',
            chip: 'ZONES',
            note: 'The replay comparison is unavailable, so this uses zone checkpoints.',
        })
    })

    it('names a reference without an alias plainly', () => {
        const card = buildRunDeltaCard(input(null, { reference: { alias: null, hasReplay: false } }))

        expect(card.kind === 'zones' && card.note).toBe("The other run has no replay, so this uses zone checkpoints.")
    })

    it('never draws a comparison across sides', () => {
        const comparison = runCompareFixture('aligned')
        comparison.reference = { ...comparison.reference, team: 1 - comparison.runner.team }

        expect(buildRunDeltaCard(input(comparison)).kind).toBe('zones')
    })

    it('falls back instead of drawing an aligned comparison without sectors or a curve', () => {
        expect(buildRunDeltaCard(input({ ...runCompareFixture('aligned'), sectors: [] })).kind).toBe('zones')
        expect(buildRunDeltaCard(input({ ...runCompareFixture('aligned'), segments: [] })).kind).toBe('zones')
    })
})
