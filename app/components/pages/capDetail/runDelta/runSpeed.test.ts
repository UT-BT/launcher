import { describe, expect, it } from 'vitest'
import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import { buildRunDeltaCard } from './runDeltaCard'
import { runSpeed, speedAxis } from './runSpeed'

describe('the speed axis', () => {
    it.each([
        [650, 200, [0, 200, 400, 600, 800]],
        [380, 100, [0, 100, 200, 300, 400]],
        [1200, 500, [0, 500, 1000, 1500]],
        [0, 50, [0, 50]],
    ])('fits %d UU/s with a step of %d', (max, step, ticks) => {
        const axis = speedAxis(max)

        expect(axis.step).toBe(step)
        expect(axis.ticks.map(t => t.value)).toEqual(ticks)
        expect(axis.ticks.map(t => t.label)).toEqual(ticks.map(String))
        expect(axis.domain).toEqual([0, ticks.at(-1)])
    })

    it('always leaves headroom above the fastest sample', () => {
        for (const max of [200, 400, 600, 1000]) expect(speedAxis(max).domain[1]).toBeGreaterThan(max)
    })
})

describe('the speed chart', () => {
    it('draws both runs as the comparison sends them, on the run-time axis of the card', () => {
        const comparison = runCompareFixture('aligned')
        const { chart } = runSpeed(comparison)

        expect(chart.runner).toEqual(comparison.speed.runner)
        expect(chart.reference).toEqual(comparison.speed.reference)
        expect(chart.x.domainMs).toEqual([0, comparison.duration_ms])
        expect(chart.bands).toEqual([])
        const fastest = Math.max(...[...comparison.speed.runner, ...comparison.speed.reference].flat().map(([, s]) => s))
        expect(chart.y.domain[1]).toBeGreaterThan(fastest)
    })

    it('shades the different lines and leaves the runner out of them', () => {
        const comparison = runCompareFixture('separated')
        const { chart } = runSpeed(comparison)

        expect(chart.bands).toEqual(comparison.separations.map(s => ({ startMs: s.start_ms, endMs: s.end_ms })))
        for (const band of chart.bands) {
            const inside = chart.runner.flat().filter(([t]) => t > band.startMs && t < band.endMs)
            expect(inside).toEqual([])
        }
    })
})

describe('the speed rows', () => {
    it('splits every sector gap into time from speed and time from the line', () => {
        const comparison = runCompareFixture('aligned')
        const { rows } = runSpeed(comparison)

        expect(rows.map(r => r.label)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'])
        rows.forEach((row, i) => {
            expect(row.fromSpeed.ms + row.fromLine.ms).toBe(comparison.sectors[i].delta_split_ms)
        })
        expect(rows[0]).toEqual({
            index: 1,
            label: 'S1',
            runnerSpeed: 439,
            speedGap: { value: 11, label: '+11', tone: 'ahead' },
            fromSpeed: { ms: -211, label: '−0.211', tone: 'ahead' },
            fromLine: { ms: -78, label: '−0.078', tone: 'ahead' },
            flagged: false,
        })
    })

    it('shows each sector\'s average speed and its gap to the other run as the comparison sends them', () => {
        const comparison = runCompareFixture('aligned')
        const { rows } = runSpeed(comparison)

        rows.forEach((row, i) => {
            const sector = comparison.sectors[i]
            expect(row.runnerSpeed).toBe(sector.runner_speed_uu_s)
            expect(row.speedGap.value).toBe(sector.runner_speed_uu_s - sector.reference_speed_uu_s)
            expect(Math.sign(row.speedGap.value)).not.toBe(Math.sign(row.fromSpeed.ms))
        })
    })

    it('marks a slower sector with a minus and the behind tone', () => {
        const comparison = runCompareFixture('aligned')
        comparison.sectors[2] = { ...comparison.sectors[2], runner_speed_uu_s: comparison.sectors[2].reference_speed_uu_s - 40 }

        expect(runSpeed(comparison).rows[2].speedGap.tone).toBe('behind')
        expect(runSpeed(comparison).rows[2].speedGap.label).toMatch(/^−\d+$/)
    })

    it('flags the sectors that left the line', () => {
        const { rows } = runSpeed(runCompareFixture('separated'))

        expect(rows.filter(r => r.flagged).map(r => r.label)).toEqual(['S3', 'S4', 'S5', 'S6', 'S8', 'S9'])
    })
})

describe('the speed totals', () => {
    it('adds the speed and line gaps up to the final gap', () => {
        for (const name of ['aligned', 'separated', 'neverRejoins', 'long', 'short'] as const) {
            const comparison = runCompareFixture(name)
            const { totals } = runSpeed(comparison)

            expect(totals.fromSpeed.ms + totals.fromLine.ms).toBe(comparison.final_delta_ms)
        }
    })

    it('sums the distances of both runs and averages over their whole times', () => {
        const comparison = runCompareFixture('aligned')
        const { totals } = runSpeed(comparison)
        const runnerDistance = comparison.sectors.reduce((sum, s) => sum + s.runner_distance_uu, 0)
        const referenceDistance = comparison.sectors.reduce((sum, s) => sum + s.reference_distance_uu, 0)

        expect(totals.runnerDistance).toBe(runnerDistance)
        expect(totals.referenceDistance).toBe(referenceDistance)
        const runnerWeighted = comparison.sectors.reduce((sum, s) => sum + s.runner_speed_uu_s * s.split_ms, 0)
        const referenceWeighted = comparison.sectors.reduce(
            (sum, s, i) => sum + s.reference_speed_uu_s * (s.end_ms - (i === 0 ? 0 : comparison.sectors[i - 1].end_ms)),
            0,
        )
        expect(totals.runnerSpeed).toBe(Math.round(runnerWeighted / comparison.runner.cap_time_ms))
        expect(totals.referenceSpeed).toBe(Math.round(referenceWeighted / comparison.duration_ms))
        expect(totals.speedGap.value).toBe(totals.runnerSpeed - totals.referenceSpeed)
    })
})

describe('the replay card', () => {
    it('carries the speed view beside the curve', () => {
        const comparison = runCompareFixture('aligned')
        const card = buildRunDeltaCard({ comparison, capHasReplay: true, reference: { alias: 'Bun', hasReplay: true } })

        expect(card.kind).toBe('replay')
        if (card.kind !== 'replay') return
        expect(card.speed).toEqual(runSpeed(comparison))
    })
})
