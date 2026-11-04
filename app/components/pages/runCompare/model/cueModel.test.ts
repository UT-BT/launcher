import { describe, expect, it } from 'vitest'
import type { CapCheckpoint, CapComparison, ReplayVideo } from '@/app/utils/api'
import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import type { LoadedComparisons } from '../loading/comparisons'
import type { SoloRun } from '../loading/soloRuns'
import { composeCompareModel } from './compareModel'
import { adjacentCue, type CuePoint } from './cueModel'

const SHORT = runCompareFixture('short')
const SEPARATED = runCompareFixture('separated')
const BLUE = runCompareFixture('aligned')
const RUNNER = SHORT.runner.cap_id
const REFERENCE = SHORT.reference.cap_id
const ZONED = 'c3c3c3c3-0000-4000-8000-0000000000c3'
const TIMED = 'd4d4d4d4-0000-4000-8000-0000000000d4'
const BLUE_REFERENCE = 'e5e5e5e5-0000-4000-8000-0000000000e5'
const BLUE_RUNNER = 'f6f6f6f6-0000-4000-8000-0000000000f6'

function checkpoints(...crossings: [string, number][]): CapCheckpoint[] {
    return crossings.map(([zone, cumulative], i) => ({ zone, cumulative, segment: cumulative - (crossings[i - 1]?.[1] ?? 0) }))
}

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

const reference = () => run(REFERENCE, 11.83, { checkpoints: checkpoints(['Door', 3], ['Hall', 7], ['Flag', 11.83]) })
const runner = () => run(RUNNER, 12.342, { checkpoints: checkpoints(['Door', 3.2], ['Hall', 7.5]) })
const zoned = () => run(ZONED, 12.9, { hasGhost: false, checkpoints: checkpoints(['Hall', 7.9]) })
const timed = () => run(TIMED, 14, { hasGhost: false })
const blueReference = () => run(BLUE_REFERENCE, BLUE.reference.cap_time_ms / 1000, { side: 1 })
const blueRunner = () => run(BLUE_RUNNER, BLUE.runner.cap_time_ms / 1000, { side: 1 })
const PIN_BLUE = `&ref=${BLUE_REFERENCE}`

function video(capId: string): ReplayVideo {
    return { source: 'utrecorder', mp4_url: `https://media.test/${capId}.mp4`, view_url: null, fps: 60 }
}

function compose(runs: SoloRun[], comparisons: [string, string, CapComparison | null][], query = '') {
    const loaded: LoadedComparisons = new Map(comparisons.map(([from, to, comparison]) => [`${from}:${to}`, comparison]))
    return composeCompareModel({
        query: `runs=${runs.map(r => r.capId).join(',')}${query}`,
        runs: new Map(runs.map(r => [r.capId, r])),
        videos: new Map(runs.map(r => [r.capId, video(r.capId)])),
        stageBox: { width: 1920, height: 1080 },
        comparisons: loaded,
    })
}

function cue(model: ReturnType<typeof compose>, key: string): CuePoint {
    return model.cues.points.find(point => point.key === key)!
}

function runTimes(point: CuePoint): Record<string, number> {
    return Object.fromEntries([...point.runTimesMs].map(([capId, ms]) => [capId, Math.round(ms)]))
}

describe('sector cues', () => {
    it('offers ten sector cues at the starts of the reference\'s tenths', () => {
        const model = compose([runner(), reference()], [[RUNNER, REFERENCE, SHORT]])

        expect(model.cues.sectors.map(point => point.label)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'])
        expect(model.cues.sectors.map(point => point.atMs)).toEqual([0, 1183, 2366, 3549, 4732, 5915, 7098, 8281, 9464, 10647])
        expect(model.cues.zones).toEqual([])
    })

    it('sends the reference to its own sector start and a Replay run to its own crossing from the comparison', () => {
        const model = compose([runner(), reference()], [[RUNNER, REFERENCE, SHORT]])

        expect(runTimes(cue(model, 'S4'))).toEqual({ [REFERENCE]: 3549, [RUNNER]: 3740 })
        expect(runTimes(cue(model, 'S1'))).toEqual({ [REFERENCE]: 0, [RUNNER]: 0 })
        expect(runTimes(cue(model, 'S10'))).toEqual({ [REFERENCE]: 10647, [RUNNER]: 10733 })
    })

    it('cues each side against its own reference', () => {
        const model = compose(
            [runner(), reference(), blueRunner(), blueReference()],
            [[RUNNER, REFERENCE, SHORT], [BLUE_RUNNER, BLUE_REFERENCE, BLUE]],
            PIN_BLUE,
        )

        const s4 = cue(model, 'S4')
        expect(s4.atMs).toBe(3549)
        expect(runTimes(s4)).toEqual({ [REFERENCE]: 3549, [RUNNER]: 3740, [BLUE_REFERENCE]: 24726, [BLUE_RUNNER]: 23622 })
        expect(model.cues.sectors).toHaveLength(10)
    })

    it('names the side references its cues are resolved against', () => {
        const runs = [runner(), reference()]

        expect(compose(runs, [[RUNNER, REFERENCE, SHORT]]).cues.references).toEqual([REFERENCE])
        expect(compose(runs, [[REFERENCE, RUNNER, null]], `&ref=${RUNNER}`).cues.references).toEqual([RUNNER])
    })

    it('keeps a Zones run, a Time only run and a run whose comparison is pending on the race clock', () => {
        const model = compose([runner(), reference(), zoned(), timed()], [])

        expect(runTimes(cue(model, 'S4'))).toEqual({ [REFERENCE]: 3549 })
    })
})

describe('zone cues', () => {
    it('offers no zone cue while no run on the side is on Zones', () => {
        const model = compose([runner(), reference()], [[RUNNER, REFERENCE, SHORT]])

        expect(model.cues.zones).toEqual([])
    })

    it('offers the reference\'s zone crossings before its cap once a run on its side is on Zones', () => {
        const model = compose([runner(), reference(), zoned()], [[RUNNER, REFERENCE, SHORT]])

        expect(model.cues.zones.map(point => [point.label, point.atMs])).toEqual([['Door', 3000], ['Hall', 7000]])
        expect(model.cues.points.map(point => point.label)).toEqual(['S1', 'S2', 'S3', 'Door', 'S4', 'S5', 'S6', 'Hall', 'S7', 'S8', 'S9', 'S10'])
    })

    it('sends a Zones run to its own crossing of the zone and a Replay run to its crossing from the comparison', () => {
        const model = compose([runner(), reference(), zoned()], [[RUNNER, REFERENCE, SHORT]])

        expect(runTimes(cue(model, 'zone:Hall'))).toEqual({ [REFERENCE]: 7000, [RUNNER]: 7197, [ZONED]: 7900 })
        expect(runTimes(cue(model, 'zone:Door'))).toEqual({ [REFERENCE]: 3000, [RUNNER]: 3244 })
    })

    it('keeps a Zones run without that zone, and a Time only run, on the race clock', () => {
        const model = compose([runner(), reference(), zoned(), timed()], [[RUNNER, REFERENCE, SHORT]])

        expect(Object.keys(runTimes(cue(model, 'zone:Door')))).toEqual([REFERENCE, RUNNER])
    })

    it('offers zone cues only on a side with a Zones run', () => {
        const model = compose(
            [runner(), reference(), zoned(), run(BLUE_REFERENCE, 12, { side: 1, checkpoints: checkpoints(['Lift', 4]) })],
            [[RUNNER, REFERENCE, SHORT]],
        )

        expect(model.cues.zones.map(point => point.label)).toEqual(['Door', 'Hall'])
    })

    it('cues a zone of another side against that side\'s reference', () => {
        const model = compose(
            [runner(), reference(), run(BLUE_REFERENCE, 12, { side: 1, checkpoints: checkpoints(['Lift', 4]) }), run(BLUE_RUNNER, 12.5, { side: 1, hasGhost: false, checkpoints: checkpoints(['Lift', 4.4]) })],
            [[RUNNER, REFERENCE, SHORT]],
        )

        expect(model.cues.zones.map(point => [point.label, point.atMs])).toEqual([['Lift', 4000]])
        expect(runTimes(cue(model, 'zone:Lift'))).toEqual({ [BLUE_REFERENCE]: 4000, [BLUE_RUNNER]: 4400 })
    })
})

describe('the previous and next cue', () => {
    it('steps to the cue after the playhead, and to the last one before it', () => {
        const model = compose([runner(), reference(), zoned()], [[RUNNER, REFERENCE, SHORT]])

        expect(adjacentCue(model.cues, 3.2, 1)?.label).toBe('S4')
        expect(adjacentCue(model.cues, 3.2, -1)?.label).toBe('Door')
        expect(adjacentCue(model.cues, 3.549, -1)?.label).toBe('Door')
        expect(adjacentCue(model.cues, 3.549, 1)?.label).toBe('S5')
        expect(adjacentCue(model.cues, 0, -1)).toBeNull()
        expect(adjacentCue(model.cues, 11, 1)).toBeNull()
    })
})

describe('sync by position', () => {
    it('lets only runs with an aligned comparison against their side\'s reference follow position', () => {
        const model = compose(
            [runner(), reference(), zoned(), timed(), blueReference(), blueRunner()],
            [[RUNNER, REFERENCE, SHORT], [BLUE_RUNNER, BLUE_REFERENCE, BLUE]],
            `${PIN_BLUE}&sync=position`,
        )

        expect(model.sync.mode).toBe('position')
        expect(model.sync.links.map(link => [link.capId, link.reference])).toEqual([[RUNNER, REFERENCE], [BLUE_RUNNER, BLUE_REFERENCE]])
        expect(model.sync.links[0].knots).toEqual(SHORT.segments[0])
        expect(model.sync.raceClock).toEqual([ZONED, TIMED])
    })

    it('marks a run that stays on the race clock on its tile and its lane', () => {
        const model = compose([runner(), reference(), zoned()], [[RUNNER, REFERENCE, SHORT]], '&sync=position')

        const lane = (capId: string) => model.lanes.lanes.find(entry => entry.capId === capId)!.badges
        const tile = (capId: string) => model.race.tiles.find(entry => entry.id === capId)!.badges
        expect(lane(ZONED)).toEqual(['Checkpoints only', 'Plays in race time'])
        expect(tile(ZONED)).toEqual(['Checkpoints only', 'Plays in race time'])
        expect(lane(RUNNER)).toEqual([])
        expect(lane(REFERENCE)).not.toContain('Plays in race time')
    })

    it('marks nothing on the race clock', () => {
        const model = compose([runner(), reference(), zoned()], [[RUNNER, REFERENCE, SHORT]])

        expect(model.sync.mode).toBe('race')
        expect(model.sync.raceClock).toEqual([])
        expect(model.lanes.lanes.flatMap(lane => lane.badges)).not.toContain('Plays in race time')
        expect(model.sync.links.map(link => link.capId)).toEqual([RUNNER])
    })

    it('waits for a pending comparison before marking its run', () => {
        const model = compose([runner(), reference()], [], '&sync=position')

        expect(model.sync.raceClock).toEqual([])
        expect(model.sync.links).toEqual([])
    })

    it('keeps a run whose routes differ on the race clock, and follows a separated comparison across its bands', () => {
        const routesDiffer = runCompareFixture('routesDiffer')
        const model = compose(
            [runner(), reference(), run(ZONED, 12.9)],
            [[RUNNER, REFERENCE, SEPARATED], [ZONED, REFERENCE, routesDiffer]],
            '&sync=position',
        )

        expect(model.sync.raceClock).toEqual([ZONED])
        const knots = model.sync.links[0].knots
        SEPARATED.separations.forEach(separation => {
            expect(knots).toContainEqual([separation.start_ms, separation.start_delta_ms])
            expect(knots).toContainEqual([separation.end_ms, separation.end_delta_ms])
        })
    })
})
