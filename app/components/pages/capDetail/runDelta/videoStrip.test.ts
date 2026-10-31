import { describe, expect, it } from 'vitest'
import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import type { CapComparison } from '@/app/utils/api'
import { buildVideoStrip, equalSectorEndsMs, referenceReadout, runnerReadout, type VideoStrip } from './videoStrip'

function strip(comparison: CapComparison): VideoStrip {
    const built = buildVideoStrip(comparison)
    if (!built) throw new Error('expected a strip')
    return built
}

describe('the video delta strip', () => {
    it("draws every sample at the runner's own video time", () => {
        const comparison = runCompareFixture('separated')
        const built = strip(comparison)

        expect(built.curves[0].points[0]).toEqual([0, 0])
        const drawn = new Set(built.curves.flatMap(c => c.points.map(p => p.join(','))))
        for (const [t, d] of comparison.segments.flat()) expect(drawn.has(`${t + d},${d}`)).toBe(true)
    })

    it('keeps the two tones split at zero crossings', () => {
        const built = strip(runCompareFixture('aligned'))

        expect(built.curves[0].tone).toBe('behind')
        expect(built.curves.at(-1)?.tone).toBe('ahead')
        for (const curve of built.curves) {
            const sign = curve.tone === 'ahead' ? -1 : 1
            expect(curve.points.every(([, d]) => d === 0 || Math.sign(d) === sign)).toBe(true)
            expect(curve.area[0][1]).toBe(0)
        }
        expect(built.zeroLineMs).toBe(0)
    })

    it("maps each different line into the runner's time", () => {
        const built = strip(runCompareFixture('separated'))

        expect(built.bands[0]).toEqual({
            startMs: 22998, endMs: 25146, connector: [[22998, -6802], [25146, -11925]], rejoined: true,
        })
        expect(built.bands[2]).toEqual({
            startMs: 32766, endMs: 38774, connector: [[32766, -13412], [38774, -15526]], rejoined: true,
        })
    })

    it('shows the lone cap point at the runner cap when the run never rejoins', () => {
        const built = strip(runCompareFixture('neverRejoins'))

        expect(built.capPoint).toEqual({ tMs: 25322, deltaMs: -14470, tone: 'ahead' })
        expect(built.bands.at(-1)?.endMs).toBe(25322)
    })

    it("ticks the runner's sector crossings in its own time and the reference's equal slices", () => {
        const built = strip(runCompareFixture('separated'))

        expect(built.runner).toEqual({
            ticksMs: [9181, 15979, 23125, 27724, 35878, 45072, 53183, 59101, 64615],
            capMs: 72876,
        })
        expect(built.reference).toEqual({
            ticksMs: [10077, 20154, 30231, 40308, 50385, 60462, 70539, 80616, 90693],
            capMs: 100770,
        })
        expect(built.spanMs).toBe(100770)
    })

    it('scales its gaps like the card', () => {
        expect(strip(runCompareFixture('separated')).y.ticks.map(t => t.label)).toEqual(['−20s', '−10s', '0s'])
    })

    it('has no strip when the routes differ or the runs are on different sides', () => {
        const crossSide = runCompareFixture('aligned')
        crossSide.runner = { ...crossSide.runner, team: 1 - crossSide.reference.team }

        expect(buildVideoStrip(runCompareFixture('routesDiffer'))).toBeNull()
        expect(buildVideoStrip(crossSide)).toBeNull()
        expect(buildVideoStrip(null)).toBeNull()
    })
})

describe('pane readouts', () => {
    it('reads the sector and the live gap on the line', () => {
        const built = strip(runCompareFixture('aligned'))

        expect(runnerReadout(built, 250)).toEqual({
            label: 'S1', sector: 1, differentLine: false, atCap: false,
            gap: { ms: 92, label: '+0.092', tone: 'behind' },
        })
    })

    it('reads "Different line" inside a band and follows the connector', () => {
        const built = strip(runCompareFixture('separated'))

        expect(runnerReadout(built, 36500)).toEqual({
            label: 'Different line', sector: 6, differentLine: true, atCap: false,
            gap: { ms: -14726, label: '−14.726', tone: 'ahead' },
        })
    })

    it('reads the next sector once the runner crosses a boundary', () => {
        const built = strip(runCompareFixture('separated'))

        expect(runnerReadout(built, 9180).label).toBe('S1')
        expect(runnerReadout(built, 9181).label).toBe('S2')
        expect(runnerReadout(built, 20000)).toMatchObject({ label: 'S3', differentLine: false })
    })

    it('starts on an even gap and holds the official gap after the cap', () => {
        const built = strip(runCompareFixture('separated'))

        expect(runnerReadout(built, 0)).toMatchObject({ label: 'S1', gap: { ms: 0, tone: 'even' } })
        expect(runnerReadout(built, 80000)).toEqual({
            label: 'S10', sector: 10, differentLine: false, atCap: true,
            gap: { ms: -27894, label: '−27.894', tone: 'ahead' },
        })
    })

    it('stays on the connector to the cap when the run never rejoins', () => {
        const built = strip(runCompareFixture('neverRejoins'))

        expect(runnerReadout(built, 25000)).toMatchObject({ label: 'Different line', differentLine: true })
        expect(runnerReadout(built, 25322)).toMatchObject({ atCap: true, gap: { ms: -14470 } })
    })

    it("reads the reference's sector from its equal slices", () => {
        const built = strip(runCompareFixture('separated'))

        expect(referenceReadout(built, 36500)).toEqual({ label: 'S4', sector: 4, atCap: false })
        expect(referenceReadout(built, 0)).toEqual({ label: 'S1', sector: 1, atCap: false })
        expect(referenceReadout(built, 100770)).toEqual({ label: 'S10', sector: 10, atCap: true })
    })
})

describe('equal sector slices', () => {
    it('ends ten slices on the rounded tenths of the run', () => {
        const alignedEnds = runCompareFixture('aligned').sectors.map(s => s.end_ms)
        const withinRounding = equalSectorEndsMs(82421).map((ms, i) => Math.abs(ms - alignedEnds[i]) <= 1)

        expect(withinRounding).toEqual(Array(10).fill(true))
        expect(equalSectorEndsMs(100770)).toEqual(runCompareFixture('separated').sectors.map(s => s.end_ms))
    })
})
