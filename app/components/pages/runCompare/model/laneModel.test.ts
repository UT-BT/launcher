import { describe, expect, it } from 'vitest'
import type { CapCheckpoint, CapComparison, ReplayVideo } from '@/app/utils/api'
import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import type { LoadedComparisons } from '../loading/comparisons'
import type { SoloRun } from '../loading/soloRuns'
import { composeCompareModel, type CompareModelInput } from './compareModel'
import { liveDelta, type Lane } from './laneModel'

const SHORT = runCompareFixture('short')
const SEPARATED = runCompareFixture('separated')
const RUNNER = SHORT.runner.cap_id
const REFERENCE = SHORT.reference.cap_id
const OTHER = 'c3c3c3c3-0000-4000-8000-0000000000c3'
const FOURTH = 'd4d4d4d4-0000-4000-8000-0000000000d4'

function checkpoints(...crossings: [string, number][]): CapCheckpoint[] {
    return crossings.map(([zone, cumulative], i) => ({ zone, cumulative, segment: cumulative - (crossings[i - 1]?.[1] ?? 0) }))
}

const REFERENCE_ZONES = checkpoints(['Door', 3], ['Hall', 7])
const RUNNER_ZONES = checkpoints(['Door', 3.2], ['Hall', 7.5])

function run(capId: string, timeSeconds: number, overrides: Partial<SoloRun> = {}): SoloRun {
    return {
        capId,
        user: `7000000000000000${capId.slice(0, 2)}`,
        alias: capId.slice(0, 4),
        title: null,
        timeSeconds,
        map: 'CTF-BT-NaliRealm',
        side: 0,
        hasGhost: true,
        zoneCheckpoints: null,
        checkpoints: [],
        disallowed: false,
        ...overrides,
    }
}

function reference(overrides: Partial<SoloRun> = {}): SoloRun {
    return run(REFERENCE, SHORT.reference.cap_time_ms / 1000, { checkpoints: REFERENCE_ZONES, ...overrides })
}

function runner(overrides: Partial<SoloRun> = {}): SoloRun {
    return run(RUNNER, SHORT.runner.cap_time_ms / 1000, { checkpoints: RUNNER_ZONES, ...overrides })
}

function video(capId: string): ReplayVideo {
    return { source: 'utrecorder', mp4_url: `https://media.test/${capId}.mp4`, view_url: null, fps: 60 }
}

function compared(entries: [string, CapComparison | null][]): LoadedComparisons {
    return new Map(entries.map(([capId, comparison]) => [`${capId}:${REFERENCE}`, comparison]))
}

function compose(runs: SoloRun[], comparisons: LoadedComparisons, extra: Partial<CompareModelInput> = {}) {
    return composeCompareModel({
        query: `runs=${runs.map(r => r.capId).join(',')}`,
        runs: new Map(runs.map(r => [r.capId, r])),
        videos: new Map(runs.map(r => [r.capId, video(r.capId)])),
        stageBox: { width: 1920, height: 1080 },
        comparisons,
        ...extra,
    })
}

function laneOf(model: ReturnType<typeof compose>, capId: string): Lane {
    return model.lanes.lanes.find(lane => lane.capId === capId)!
}

function badges(model: ReturnType<typeof compose>): Record<string, string[]> {
    return Object.fromEntries(model.lanes.lanes.map(lane => [lane.capId, lane.badges]))
}

function tileBadges(model: ReturnType<typeof compose>): Record<string, string[]> {
    return Object.fromEntries(model.race.tiles.map(tile => [tile.id, tile.badges]))
}

describe('the data rung of each run', () => {
    it('puts a run with a video and a ghost aligned with the reference on Replay with no note, on its tile and its lane', () => {
        const model = compose([runner(), reference()], compared([[RUNNER, SHORT]]))

        expect(laneOf(model, RUNNER).rung).toBe('replay')
        expect(badges(model)[RUNNER]).toEqual([])
        expect(tileBadges(model)[RUNNER]).toEqual([])
        expect(model.race.layout.placed.find(placed => placed.slot.id === RUNNER)!.slot.badges).toEqual([])
    })

    it('asks for the pairwise comparison only for runs on the reference side where both have a ghost', () => {
        const model = compose(
            [runner(), reference(), run(OTHER, 13, { side: 1 }), run(FOURTH, 14, { hasGhost: false })],
            new Map(),
        )

        expect(model.lanes.requests).toEqual([{ runner: RUNNER, reference: REFERENCE }])
    })

    it('shows no rung while the comparison is still being read', () => {
        const model = compose([runner(), reference()], new Map())

        expect(laneOf(model, RUNNER).rung).toBeNull()
        expect(badges(model)[RUNNER]).toEqual([])
        expect(laneOf(model, RUNNER).curves).toEqual([])
    })

    it('drops a failed comparison to the zone delta when both runs share zones', () => {
        const model = compose([runner(), reference()], compared([[RUNNER, null]]))

        expect(laneOf(model, RUNNER).rung).toBe('zones')
        expect(badges(model)[RUNNER]).toEqual(['Checkpoints only'])
    })

    it('drops a failed comparison to time only when the runs share no zone', () => {
        const model = compose([runner({ checkpoints: checkpoints(['Roof', 4]) }), reference()], compared([[RUNNER, null]]))

        expect(laneOf(model, RUNNER).rung).toBe('time')
        expect(badges(model)[RUNNER]).toEqual(['Final time only'])
    })

    it('puts a comparison whose routes differ on Zones', () => {
        const routesDiffer = { ...runCompareFixture('routesDiffer'), runner: { ...SHORT.runner }, reference: { ...SHORT.reference } }
        const model = compose([runner(), reference()], compared([[RUNNER, routesDiffer]]))

        expect(laneOf(model, RUNNER).rung).toBe('zones')
        expect(badges(model)[RUNNER]).toEqual(['Checkpoints only'])
        expect(laneOf(model, RUNNER).bands).toEqual([])
    })

    it('puts a run without a ghost but with shared zones on Zones without reading a comparison', () => {
        const model = compose([runner({ hasGhost: false }), reference()], new Map())

        expect(model.lanes.requests).toEqual([])
        expect(badges(model)[RUNNER]).toEqual(['Checkpoints only'])
    })

    it('puts a run with neither a ghost nor zones on Time only', () => {
        const model = compose([runner({ hasGhost: false, checkpoints: [] }), reference()], new Map())

        expect(badges(model)[RUNNER]).toEqual(['Final time only'])
    })

    it('makes a run set alone on the other side that side’s baseline, never compared and with no note', () => {
        const model = compose([run(OTHER, 12.9, { side: 1, checkpoints: RUNNER_ZONES }), reference()], new Map())

        expect(model.lanes.requests).toEqual([])
        expect(laneOf(model, OTHER)).toMatchObject({ reference: true, rung: 'time', sideLabel: 'Blue', curves: [], bands: [], splits: [] })
        expect(badges(model)[OTHER]).toEqual([])
        expect(tileBadges(model)[OTHER]).toEqual([])
    })

    it('tags every run with its side when the set mixes sides', () => {
        const model = compose([run(OTHER, 12.9, { side: 0 }), reference({ side: 1 })], new Map())

        expect([laneOf(model, OTHER).sideLabel, laneOf(model, REFERENCE).sideLabel]).toEqual(['Red', 'Blue'])
    })

    it('tags no side when every run was set on the same side, or its side is unknown', () => {
        const model = compose([runner(), reference(), run(OTHER, 14, { side: null })], compared([[RUNNER, SHORT]]))

        expect(model.lanes.lanes.map(lane => lane.sideLabel)).toEqual([null, null, null])
    })

    it('gives no note to the baseline of either side, and notes the other runs against their own side’s baseline', () => {
        const model = compose(
            [runner(), reference(), run(OTHER, 12.9, { side: 1 }), run(FOURTH, 14, { side: 1, hasGhost: false })],
            compared([[RUNNER, SHORT]]),
        )

        expect([REFERENCE, OTHER].map(capId => [laneOf(model, capId).reference, badges(model)[capId]])).toEqual([[true, []], [true, []]])
        expect(badges(model)[FOURTH]).toEqual(['Final time only'])
        expect(laneOf(model, FOURTH).sideLabel).toBe('Blue')
        expect(badges(model)[RUNNER]).toEqual([])
    })

    it('keeps a data-only run at the rung its data reaches, still marked as without a video', () => {
        const model = compose([runner(), reference()], compared([[RUNNER, SHORT]]), { failedVideos: new Set([RUNNER]) })

        expect(laneOf(model, RUNNER).rung).toBe('replay')
        expect(badges(model)[RUNNER]).toEqual(['Video didn’t load'])
        expect(model.race.dataOnly.map(row => row.badges)).toEqual([['Video didn’t load']])
    })

    it('marks a run with no video at all and a failed comparison as Checkpoints only and Graph only', () => {
        const model = compose([runner(), reference()], compared([[RUNNER, null]]), {
            videos: new Map([[RUNNER, null], [REFERENCE, video(REFERENCE)]]),
        })

        expect(badges(model)[RUNNER]).toEqual(['Checkpoints only', 'Graph only'])
    })

    it('gives the reference the rung of its own data and a flat lane', () => {
        const model = compose([runner(), reference()], compared([[RUNNER, SHORT]]))
        const lane = laneOf(model, REFERENCE)

        expect(lane).toMatchObject({ reference: true, rung: 'replay', curves: [], bands: [] })
        expect(lane.finalGap.label).toBe('±0.000')
    })
})

describe('no delta across sides', () => {
    it('draws nothing but the cap for a run on the other side even when a comparison was read for it', () => {
        const model = compose([run(OTHER, 12.342, { side: 1 }), reference()], compared([[OTHER, SHORT]]))
        const lane = laneOf(model, OTHER)

        expect(lane.curves).toEqual([])
        expect(liveDelta(lane, 5)).toBeNull()
        expect(liveDelta(lane, 12.342)!.gap.label).toBe('+0.512')
    })

    it('never draws a comparison whose two runs were set on different sides', () => {
        const crossed = { ...SHORT, runner: { ...SHORT.runner, team: 1 } }
        const model = compose([runner({ checkpoints: [] }), reference()], compared([[RUNNER, crossed]]))

        expect(laneOf(model, RUNNER)).toMatchObject({ rung: 'time', curves: [] })
    })
})

describe('the delta lanes', () => {
    it('gives one lane per run in add order, each ending at its own cap with the gap to the reference', () => {
        const model = compose([runner(), reference(), run(OTHER, 13.5, { side: 1 })], compared([[RUNNER, SHORT]]))

        expect(model.lanes.lanes.map(lane => [lane.capId, lane.capMs, lane.finalGap.label, lane.finalGap.tone])).toEqual([
            [RUNNER, 12342, '+0.512', 'behind'],
            [REFERENCE, 11830, '±0.000', 'even'],
            [OTHER, 13500, '+1.670', 'behind'],
        ])
    })

    it('reads the delta at the run’s own time, not the reference’s', () => {
        const lane = laneOf(compose([runner(), reference()], compared([[RUNNER, SHORT]])), RUNNER)
        const [referenceMs, deltaMs] = SHORT.segments[0][60]

        expect(liveDelta(lane, (referenceMs + deltaMs) / 1000)!.gap.ms).toBe(deltaMs)
        expect(lane.curves.every(curve => curve.points.every(([t]) => t <= SHORT.runner.cap_time_ms))).toBe(true)
        expect(lane.curves.at(-1)!.points.at(-1)![0]).toBe(SHORT.runner.cap_time_ms)
    })

    it('reports the final gap from the cap on', () => {
        const lane = laneOf(compose([runner(), reference()], compared([[RUNNER, SHORT]])), RUNNER)

        expect(liveDelta(lane, 12.342)).toEqual({ gap: { ms: 512, label: '+0.512', tone: 'behind' }, differentLine: false, atCap: true })
        expect(liveDelta(lane, 20)!.atCap).toBe(true)
    })

    it('draws the separation bands at the run’s own time and marks the live delta inside one as a different line', () => {
        const separatedRunner = run(SEPARATED.runner.cap_id, SEPARATED.runner.cap_time_ms / 1000)
        const separatedReference = run(SEPARATED.reference.cap_id, 70)
        const model = composeCompareModel({
            query: `runs=${separatedRunner.capId},${separatedReference.capId}`,
            runs: new Map([separatedRunner, separatedReference].map(r => [r.capId, r])),
            videos: new Map([separatedRunner, separatedReference].map(r => [r.capId, video(r.capId)])),
            comparisons: new Map([[`${separatedRunner.capId}:${separatedReference.capId}`, SEPARATED]]),
        })
        const lane = laneOf(model, separatedRunner.capId)
        const [first] = SEPARATED.separations
        const band = lane.bands[0]

        expect(lane.bands).toHaveLength(SEPARATED.separations.length)
        expect([band.startMs, band.endMs]).toEqual([first.start_ms + first.start_delta_ms, first.end_ms + first.end_delta_ms])

        const inside = liveDelta(lane, (band.startMs + band.endMs) / 2000)!
        expect(inside.differentLine).toBe(true)
        expect(inside.gap.ms).toBeLessThan(first.start_delta_ms)
        expect(inside.gap.ms).toBeGreaterThan(first.end_delta_ms)

        const outside = liveDelta(lane, (band.startMs - 500) / 1000)!
        expect(outside.differentLine).toBe(false)
    })

    it('steps a zone lane at its zone crossings', () => {
        const lane = laneOf(compose([runner(), reference()], compared([[RUNNER, null]])), RUNNER)

        expect(liveDelta(lane, 3.1)!.gap.ms).toBe(0)
        expect(liveDelta(lane, 3.2)!.gap.ms).toBe(200)
        expect(liveDelta(lane, 7.4)!.gap.ms).toBe(200)
        expect(liveDelta(lane, 7.5)!.gap.ms).toBe(500)
        expect(liveDelta(lane, 12.342)!.gap.ms).toBe(512)
        expect(lane.curves.flatMap(curve => curve.points)).toContainEqual([3200, 200])
        expect(lane.curves.flatMap(curve => curve.points)).toContainEqual([7500, 200])
    })

    it('shows only the final gap at the cap on a time-only lane', () => {
        const lane = laneOf(compose([runner({ hasGhost: false, checkpoints: [] }), reference()], new Map()), RUNNER)

        expect(lane.curves).toEqual([])
        expect(liveDelta(lane, 6)).toBeNull()
        expect(liveDelta(lane, 12.342)!.gap.label).toBe('+0.512')
    })

    it('keeps the reference lane flat until its cap', () => {
        const lane = laneOf(compose([runner(), reference()], compared([[RUNNER, SHORT]])), REFERENCE)

        expect(liveDelta(lane, 4)).toEqual({ gap: { ms: 0, label: '±0.000', tone: 'even' }, differentLine: false, atCap: false })
        expect(liveDelta(lane, 11.83)!.atCap).toBe(true)
    })

    it('keeps the cap marker and the curve inside the lane’s delta range', () => {
        const lane = laneOf(compose([runner(), reference()], compared([[RUNNER, SHORT]])), RUNNER)
        const [lo, hi] = lane.domainMs
        const deltas = lane.curves.flatMap(curve => curve.points.map(([, d]) => d))

        expect(lo).toBeLessThan(Math.min(...deltas))
        expect(hi).toBeGreaterThan(Math.max(...deltas, lane.finalGap.ms))
    })
})

describe('the sector splits of each run', () => {
    it('gives a replay lane the ten sectors at the run’s own time', () => {
        const lane = laneOf(compose([runner(), reference()], compared([[RUNNER, SHORT]])), RUNNER)

        expect(lane.splits).toHaveLength(10)
        expect(lane.splits[4]).toEqual({
            index: 5,
            label: 'S5',
            endMs: SHORT.sectors[4].end_ms + SHORT.sectors[4].delta_total_ms,
            splitMs: SHORT.sectors[4].split_ms,
            deltaSplitMs: SHORT.sectors[4].delta_split_ms,
            deltaTotalMs: SHORT.sectors[4].delta_total_ms,
        })
    })

    it('gives a zone lane one split per shared zone and the cap', () => {
        const lane = laneOf(compose([runner(), reference()], compared([[RUNNER, null]])), RUNNER)

        expect(lane.splits.map(split => [split.label, split.endMs, split.splitMs, split.deltaSplitMs, split.deltaTotalMs])).toEqual([
            ['CP1', 3200, 3200, 200, 200],
            ['CP2', 7500, 4300, 300, 500],
            ['CAP', 12342, 4842, 12, 512],
        ])
    })

    it('gives the reference its own equal tenths', () => {
        const lane = laneOf(compose([runner(), reference()], compared([[RUNNER, SHORT]])), REFERENCE)

        expect(lane.splits.map(split => split.endMs)).toEqual(SHORT.sectors.map(sector => sector.end_ms))
        expect(lane.splits.every(split => split.deltaTotalMs === 0)).toBe(true)
    })
})

describe('the sector ticks', () => {
    it('marks the reference’s ten equal tenths', () => {
        const model = compose([runner(), reference()], compared([[RUNNER, SHORT]]))

        expect(model.lanes.sectors.map(sector => sector.label)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'])
        expect(model.lanes.sectors.map(sector => sector.endMs)).toEqual(SHORT.sectors.map(sector => sector.end_ms))
        expect(model.lanes.sectors[0].startMs).toBe(0)
        expect(model.lanes.sectors[3].startMs).toBe(SHORT.sectors[2].end_ms)
    })

    it('follows the reference when a faster run joins', () => {
        const model = compose([runner(), reference(), run(OTHER, 10, { side: 0 })], new Map())

        expect(model.lanes.sectors.at(-1)!.endMs).toBe(10000)
        expect(model.lanes.requests.map(request => request.reference)).toEqual([OTHER, OTHER])
    })

    it('has no lanes and no ticks while the runs load', () => {
        const model = composeCompareModel({ query: `runs=${RUNNER}`, runs: new Map() })

        expect(model.lanes).toEqual({ lanes: [], requests: [], sectors: [] })
    })
})
