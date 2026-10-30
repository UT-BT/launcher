import { describe, expect, it } from 'vitest'
import { chartRuleVectors, runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import { timeAxis, deltaAxis } from './chartRules'

const vectors = chartRuleVectors()

describe('the run-time axis', () => {
    it.each(vectors.x.map(v => [v.name, v] as const))('reproduces the %s vector', (_name, vector) => {
        const axis = timeAxis(vector.duration_ms)

        expect(axis.stepMs).toBe(vector.step_ms)
        expect(axis.endTick).toBe(vector.end_tick)
        expect(axis.ticks.map(t => ({ t_ms: t.ms, label: t.label }))).toEqual(vector.ticks)
        expect(axis.domainMs).toEqual([0, vector.duration_ms])
    })

    it('covers the 11.8 s, 1:22 and 9:37 runs of the scaling board', () => {
        const names = vectors.x.map(v => v.name)
        expect(names).toEqual(expect.arrayContaining(['11.8 s run', '1:22 run', '9:37 run']))
    })

    it('never shows more than 7 ticks while a step fits', () => {
        for (const duration of [400, 2400, 13900, 44600, 59900, 119600, 577352, 2033002]) {
            expect(timeAxis(duration).ticks.length).toBeLessThanOrEqual(7)
        }
    })

    it('falls back to 10-minute steps when no step fits', () => {
        const axis = timeAxis(7200000)
        expect(axis.stepMs).toBe(600000)
        expect(axis.ticks.at(-1)).toEqual({ ms: 7200000, label: '120:00' })
    })
})

describe('the gap axis', () => {
    it.each(vectors.y.map(v => [v.name, v] as const))('reproduces the %s vector', (_name, vector) => {
        const axis = deltaAxis(vector.min_delta_ms, vector.max_delta_ms)

        expect(axis.stepMs).toBe(vector.step_ms)
        expect(axis.domainMs[0]).toBeCloseTo(vector.domain_ms[0], 9)
        expect(axis.domainMs[1]).toBeCloseTo(vector.domain_ms[1], 9)
        expect(axis.ticks.map(t => ({ value_ms: t.ms, label: t.label }))).toEqual(vector.ticks)
    })

    it('reads its range from the curve of the run each vector names', () => {
        const sourced = vectors.y.filter(v => v.source)
        expect(sourced.length).toBeGreaterThanOrEqual(3)
        const byFile = {
            'compare_short.json': runCompareFixture('short'),
            'compare_aligned.json': runCompareFixture('aligned'),
            'compare_long.json': runCompareFixture('long'),
            'compare_separated.json': runCompareFixture('separated'),
        } as const
        for (const vector of sourced) {
            const comparison = byFile[vector.source as keyof typeof byFile]
            const deltas = comparison.segments.flat().map(p => p[1])
            expect([Math.min(...deltas), Math.max(...deltas)]).toEqual([vector.min_delta_ms, vector.max_delta_ms])
        }
    })

    it('always includes zero, even when every gap has one sign', () => {
        for (const [lo, hi] of [[-27891, -3], [400, 900], [0, 0], [12, 15]]) {
            const axis = deltaAxis(lo, hi)
            expect(axis.domainMs[0]).toBeLessThan(0)
            expect(axis.domainMs[1]).toBeGreaterThan(0)
            expect(axis.ticks.some(t => t.ms === 0)).toBe(true)
        }
    })
})
