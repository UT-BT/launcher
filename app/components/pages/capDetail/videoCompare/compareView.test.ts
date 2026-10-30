import { describe, expect, it } from 'vitest'
import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import type { CapCheckpoint, CapComparison } from '@/app/utils/api'
import {
    buildCompareView,
    comparisonKey,
    comparisonRequests,
    paneReadout,
    type CompareRunTiming,
} from './compareView'

const separated = runCompareFixture('separated')
const RUNNER_ID = separated.runner.cap_id
const REFERENCE_ID = separated.reference.cap_id

const RUNNER_CHECKPOINTS: CapCheckpoint[] = runCompareFixture('capDetailCandidates').checkpoints

const REFERENCE_CHECKPOINTS: CapCheckpoint[] = [
    { zone: 'Courtyard', cumulative: 10.077, segment: 10.077 },
    { zone: 'Bridge', cumulative: 20.155, segment: 10.078 },
    { zone: 'Library', cumulative: 31.367, segment: 11.212 },
    { zone: 'Chimney', cumulative: 50.267, segment: 18.9 },
    { zone: 'Attic', cumulative: 65.796, segment: 15.529 },
    { zone: 'Cellar', cumulative: 83.88, segment: 18.084 },
    { zone: 'Flag Room', cumulative: 100.77, segment: 16.89 },
]

function run(capId: string, capTime: number, side: number | null, checkpoints: CapCheckpoint[] = []): CompareRunTiming {
    return { capId, capTime, side, checkpoints }
}

function comparisons(...entries: CapComparison[]): Map<string, CapComparison | null> {
    return new Map(entries.map(c => [comparisonKey(c.runner.cap_id, c.reference.cap_id), c]))
}

const runner = run(RUNNER_ID, 72.876, 0, RUNNER_CHECKPOINTS)
const reference = run(REFERENCE_ID, 100.77, 0, REFERENCE_CHECKPOINTS)
const otherSide = run('other-side-run', 80.5, 1, RUNNER_CHECKPOINTS)
const noSide = run('no-side-run', 90.25, null, RUNNER_CHECKPOINTS)

describe('the reference run', () => {
    it('is the slowest loaded run, wherever it sits', () => {
        expect(buildCompareView([runner, reference], new Map()).referenceIndex).toBe(1)
        expect(buildCompareView([reference, runner, otherSide], new Map()).referenceIndex).toBe(0)
    })

    it('is the first of equally slow runs', () => {
        expect(buildCompareView([run('a', 50, 0), run('b', 50, 0)], new Map()).referenceIndex).toBe(0)
    })
})

describe('comparison requests', () => {
    it('asks for every other run on the reference side against the slowest run', () => {
        const third = run('third', 95.5, 0)

        expect(comparisonRequests([runner, reference, third])).toEqual([
            { runnerCapId: RUNNER_ID, referenceCapId: REFERENCE_ID },
            { runnerCapId: 'third', referenceCapId: REFERENCE_ID },
        ])
    })

    it('never asks across sides or for a run without a known side', () => {
        expect(comparisonRequests([runner, reference, otherSide, noSide])).toEqual([
            { runnerCapId: RUNNER_ID, referenceCapId: REFERENCE_ID },
        ])
        expect(comparisonRequests([run('red', 60, 0), run('blue', 70, 1)])).toEqual([])
        expect(comparisonRequests([run('a', 60, null), run('b', 70, null)])).toEqual([])
    })
})

describe('scrubber ticks', () => {
    it("ticks a compared run's sector crossings in its own time and the reference's equal slices", () => {
        const view = buildCompareView([runner, reference], comparisons(separated))

        expect(view.referenceIndex).toBe(1)
        expect(view.tracks[0]).toMatchObject({
            role: 'replay',
            capTime: 72.876,
            ticks: [8.994, 15.977, 22.976, 27.691, 35.792, 44.986, 53.162, 58.975, 64.637],
        })
        expect(view.tracks[1]).toMatchObject({
            role: 'reference',
            capTime: 100.77,
            ticks: [10.077, 20.154, 30.231, 40.308, 50.385, 60.462, 70.539, 80.616, 90.693],
        })
    })
})

describe('runs on another side', () => {
    it('get no ticks in a mixed team while the reference side keeps its sectors', () => {
        const view = buildCompareView([otherSide, runner, reference], comparisons(separated))

        expect(view.tracks[0]).toEqual({ role: 'unpaired', capTime: 80.5, ticks: [], sideKnown: true })
        expect(view.tracks[1]).toMatchObject({ role: 'replay' })
        expect(view.tracks[2].ticks).toHaveLength(9)
    })

    it('get no ticks when their side is unknown', () => {
        const view = buildCompareView([noSide, reference], comparisons(separated))

        expect(view.tracks[0]).toEqual({ role: 'unpaired', capTime: 90.25, ticks: [], sideKnown: false })
    })

    it('get no ticks even when a comparison for them exists', () => {
        const crossSide = { ...runner, side: 1 }

        expect(buildCompareView([crossSide, reference], comparisons(separated)).tracks[0]).toMatchObject({
            role: 'unpaired', ticks: [],
        })
    })
})

describe('the checkpoint fallback', () => {
    const RUNNER_CHECKPOINT_TICKS = [8.994, 15.978, 24.112, 37.65, 51.203, 63.877, 72.876]
    const REFERENCE_CHECKPOINT_TICKS = [10.077, 20.155, 31.367, 50.267, 65.796, 83.88, 100.77]
    const routesDiffer = { ...runCompareFixture('routesDiffer'), runner: separated.runner, reference: separated.reference }

    it.each([
        ['failed', new Map([[comparisonKey(RUNNER_ID, REFERENCE_ID), null]])],
        ['still loading', new Map()],
        ['routes differ', comparisons(routesDiffer)],
    ])('ticks checkpoints for both runs when the comparison is %s', (_, loaded) => {
        const view = buildCompareView([runner, reference], loaded)

        expect(view.tracks[0]).toMatchObject({ role: 'zones', ticks: RUNNER_CHECKPOINT_TICKS })
        expect(view.tracks[1]).toMatchObject({ role: 'reference', ticks: REFERENCE_CHECKPOINT_TICKS })
    })

    it('applies to the failed run only and keeps the sector slices on the reference', () => {
        const third = run('third', 95.5, 0, RUNNER_CHECKPOINTS.map(c => ({ ...c, cumulative: c.cumulative * 1.3 })))
        const loaded = new Map([...comparisons(separated), [comparisonKey('third', REFERENCE_ID), null]])
        const view = buildCompareView([runner, third, reference], loaded)

        expect(view.tracks[0]).toMatchObject({ role: 'replay' })
        expect(view.tracks[1]).toMatchObject({ role: 'zones' })
        expect(view.tracks[1].ticks.length).toBeGreaterThan(0)
        expect(view.tracks[2].ticks).toEqual([10.077, 20.154, 30.231, 40.308, 50.385, 60.462, 70.539, 80.616, 90.693])
    })
})

describe('pane readouts', () => {
    const replay = buildCompareView([runner, reference], comparisons(separated))
    const fallback = buildCompareView([runner, reference], new Map())

    it('reads the sector and the live gap of a compared run', () => {
        expect(paneReadout(replay.tracks[0], 0)).toEqual({
            label: 'S1', greyed: false, gap: { ms: -18, label: '−0.018', tone: 'ahead' },
        })
        expect(paneReadout(replay.tracks[0], 20)).toMatchObject({ label: 'S3', greyed: false, gap: { tone: 'ahead' } })
    })

    it('reads "Different line" inside a band, greyed, with the gap along the connector', () => {
        expect(paneReadout(replay.tracks[0], 36.5)).toEqual({
            label: 'Different line', greyed: true, gap: { ms: -14806, label: '−14.806', tone: 'ahead' },
        })
    })

    it('reads the official gap at the cap', () => {
        expect(paneReadout(replay.tracks[0], 72.85)).toEqual({
            label: 'CAP', greyed: false, gap: { ms: -27894, label: '−27.894', tone: 'ahead' },
        })
    })

    it("reads the reference's sector from its equal slices with no gap to itself", () => {
        expect(paneReadout(replay.tracks[1], 36.5)).toEqual({
            label: 'S4', greyed: false, gap: { ms: 0, label: '±0.000', tone: 'even' },
        })
        expect(paneReadout(replay.tracks[1], 100.77)).toMatchObject({ label: 'CAP', gap: { ms: 0 } })
    })

    it('reads checkpoints as today when the comparison is missing', () => {
        expect(paneReadout(fallback.tracks[0], 5)).toEqual({ label: 'SPAWN', greyed: false, gap: null })
        expect(paneReadout(fallback.tracks[0], 16)).toEqual({
            label: 'CP2', greyed: false, gap: { ms: -4177, label: '−4.177', tone: 'ahead' },
        })
        expect(paneReadout(fallback.tracks[0], 72.876)).toMatchObject({ label: 'CAP', gap: { ms: -27894 } })
        expect(paneReadout(fallback.tracks[1], 5)).toEqual({ label: 'SPAWN', greyed: false, gap: null })
        expect(paneReadout(fallback.tracks[1], 21)).toEqual({
            label: 'CP2', greyed: false, gap: { ms: 0, label: '±0.000', tone: 'even' },
        })
    })

    it('never reads a gap for a run on another side', () => {
        const mixed = buildCompareView([otherSide, noSide, runner, reference], comparisons(separated))

        expect(paneReadout(mixed.tracks[0], 30)).toEqual({ label: 'Other side', greyed: false, gap: null })
        expect(paneReadout(mixed.tracks[0], 80.5)).toEqual({ label: 'CAP', greyed: false, gap: null })
        expect(paneReadout(mixed.tracks[1], 30)).toEqual({ label: 'Side unknown', greyed: false, gap: null })
    })
})

describe('the delta strip', () => {
    it('follows the compared run when exactly two runs share the reference side', () => {
        const view = buildCompareView([runner, reference], comparisons(separated))

        expect(view.strip).toMatchObject({ kind: 'replay', runnerIndex: 0 })
        expect(view.strip?.kind === 'replay' && view.strip.strip.runner.capMs).toBe(72876)
    })

    it('pairs the two same-side runs of a mixed team', () => {
        const view = buildCompareView([otherSide, runner, reference], comparisons(separated))

        expect(view.strip).toMatchObject({ kind: 'replay', runnerIndex: 1 })
    })

    it('is hidden across sides, for unknown sides and for three runs on one side', () => {
        const crossSide = { ...runner, side: 1 }
        const third = run('third', 95.5, 0, RUNNER_CHECKPOINTS)

        expect(buildCompareView([crossSide, reference], comparisons(separated)).strip).toBeNull()
        expect(buildCompareView([{ ...runner, side: null }, { ...reference, side: null }], new Map()).strip).toBeNull()
        expect(buildCompareView([runner, third, reference], comparisons(separated)).strip).toBeNull()
    })

    it("draws today's checkpoint gaps along the first run when the comparison is missing", () => {
        const view = buildCompareView([runner, reference], new Map())

        expect(view.strip?.kind).toBe('zones')
        if (view.strip?.kind !== 'zones') return
        expect(view.strip.timeIndex).toBe(0)
        expect(view.strip.points).toHaveLength(9)
        expect(view.strip.points[0]).toEqual({ t: 0, delta: 0 })
        expect(view.strip.points[1].t).toBe(8.994)
        expect(view.strip.points[1].delta).toBeCloseTo(-1.083, 6)
        expect(view.strip.points[8].delta).toBeCloseTo(-27.894, 6)
    })

    it('keeps the loaded order of the pair in the checkpoint fallback, as today', () => {
        const view = buildCompareView([reference, runner], new Map())

        expect(view.strip).toMatchObject({ kind: 'zones', timeIndex: 0 })
        if (view.strip?.kind !== 'zones') return
        expect(view.strip.points[1].t).toBe(10.077)
        expect(view.strip.points[1].delta).toBeCloseTo(1.083, 6)
    })

    it('is hidden in the fallback when the two runs share no checkpoint', () => {
        const bare = run(RUNNER_ID, 72.876, 0)

        expect(buildCompareView([bare, reference], new Map()).strip).toBeNull()
    })
})
