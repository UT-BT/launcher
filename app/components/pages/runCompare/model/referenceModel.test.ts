import { describe, expect, it } from 'vitest'
import type { CapComparison, ReplayVideo } from '@/app/utils/api'
import type { LoadedComparisons } from '../loading/comparisons'
import type { SoloRun } from '../loading/soloRuns'
import { composeCompareModel } from './compareModel'
import { editableSet, editSet } from './setEdits'

const IDS = Array.from({ length: 6 }, (_, i) => `0${i}0${i}0${i}0${i}-0000-4000-8000-00000000000${i}`)
const [RED_SLOW, RED_FAST, BLUE_SLOW, BLUE_FAST, UNKNOWN, RED_MID] = IDS
const RED = 0
const BLUE = 1

function run(capId: string, timeSeconds: number, side: number | null): SoloRun {
    return {
        capId,
        user: `70000000000000000${IDS.indexOf(capId)}`,
        alias: `Player ${IDS.indexOf(capId) + 1}`,
        title: null,
        timeSeconds,
        map: 'CTF-BT-NaliRealm',
        side,
        hasGhost: true,
        zoneCheckpoints: null,
        checkpoints: [],
        disallowed: false,
    }
}

function video(capId: string): ReplayVideo {
    return { source: 'utrecorder', mp4_url: `https://media.test/${capId}.mp4`, view_url: null, fps: 60 }
}

const MIXED = [run(RED_SLOW, 80, RED), run(RED_FAST, 79, RED), run(BLUE_SLOW, 82, BLUE), run(BLUE_FAST, 81, BLUE)]

function compose(query: string, runs: SoloRun[] = MIXED, comparisons: LoadedComparisons = new Map()) {
    return composeCompareModel({
        query,
        runs: new Map(runs.map(r => [r.capId, r])),
        videos: new Map(runs.map(r => [r.capId, video(r.capId)])),
        stageBox: { width: 1920, height: 1080 },
        comparisons,
    })
}

function runsQuery(runs: SoloRun[] = MIXED): string {
    return `runs=${runs.map(r => r.capId).join(',')}`
}

function sidesOf(model: ReturnType<typeof compose>) {
    return model.race.references.sides
}

function partnersOf(model: ReturnType<typeof compose>): Record<string, string> {
    return Object.fromEntries(model.race.references.partners)
}

function laneOf(model: ReturnType<typeof compose>, capId: string) {
    return model.lanes.lanes.find(lane => lane.capId === capId)!
}

describe('one reference per side', () => {
    it('takes the fastest run on each side as that side’s reference', () => {
        const model = compose(runsQuery())

        expect(sidesOf(model)).toEqual([
            { side: RED, capId: RED_FAST, pinned: false },
            { side: BLUE, capId: BLUE_FAST, pinned: false },
        ])
        expect(model.race.reference).toBe(RED_FAST)
    })

    it('measures every run against its own side’s reference', () => {
        const model = compose(runsQuery())

        expect(partnersOf(model)).toMatchObject({ [RED_SLOW]: RED_FAST, [BLUE_SLOW]: BLUE_FAST })
        expect(model.lanes.requests).toEqual([
            { runner: RED_SLOW, reference: RED_FAST },
            { runner: BLUE_SLOW, reference: BLUE_FAST },
        ])
        expect(model.race.runs.map(r => r.result)).toEqual([
            'CAP 01:20.000 · +1.000 · 2nd',
            'CAP 01:19.000 · ±0.000 · 1st',
            'CAP 01:22.000 · +1.000 · 2nd',
            'CAP 01:21.000 · +2.000 · 1st',
        ])
    })

    it('marks both side references on their lanes', () => {
        const model = compose(runsQuery())

        expect(model.lanes.lanes.filter(lane => lane.reference).map(lane => lane.capId)).toEqual([RED_FAST, BLUE_FAST])
    })

    it('has a single reference when every run is on one side', () => {
        const runs = [run(RED_SLOW, 80, RED), run(RED_FAST, 79, RED)]
        const model = compose(runsQuery(runs), runs)

        expect(sidesOf(model)).toEqual([{ side: RED, capId: RED_FAST, pinned: false }])
        expect(model.lanes.lanes.map(lane => lane.sideLabel)).toEqual([null, null])
    })

    it('counts a run with an unknown side on the side of the fastest run', () => {
        const runs = [run(UNKNOWN, 78, null), ...MIXED]
        const model = compose(runsQuery(runs), runs)

        expect(sidesOf(model).map(entry => [entry.side, entry.capId])).toEqual([[RED, UNKNOWN], [BLUE, BLUE_FAST]])
        expect(partnersOf(model)[RED_FAST]).toBe(UNKNOWN)
    })
})

describe('a pinned reference', () => {
    it('replaces the fastest run on its side and leaves the other side alone', () => {
        const model = compose(`${runsQuery()}&ref=${RED_SLOW}`)

        expect(sidesOf(model)).toEqual([
            { side: RED, capId: RED_SLOW, pinned: true },
            { side: BLUE, capId: BLUE_FAST, pinned: false },
        ])
        expect(partnersOf(model)[RED_FAST]).toBe(RED_SLOW)
        expect(model.lanes.requests).toContainEqual({ runner: RED_FAST, reference: RED_SLOW })
        expect(model.query).toBe(`${runsQuery()}&ref=${RED_SLOW}`)
    })

    it('keeps one pin per side', () => {
        const model = compose(`${runsQuery()}&ref=${RED_SLOW},${BLUE_SLOW}`)

        expect(sidesOf(model).map(entry => entry.capId)).toEqual([RED_SLOW, BLUE_SLOW])
        expect(model.race.reference).toBe(RED_SLOW)
    })

    it('drops a second pin on the same side with a notice', () => {
        const model = compose(`${runsQuery()}&ref=${RED_SLOW},${RED_FAST}`)

        expect(sidesOf(model)[0]).toEqual({ side: RED, capId: RED_SLOW, pinned: true })
        expect(model.noticeLine).toBe('Dropped 1 reference past one per side.')
        expect(model.query).toBe(`${runsQuery()}&ref=${RED_SLOW}`)
    })

    it('falls back to the fastest run on that side once the pinned run is removed', () => {
        const runs = [...MIXED, run(RED_MID, 79.5, RED)]
        const pinnedModel = compose(`${runsQuery(runs)}&ref=${RED_SLOW}`, runs)
        const removed = editSet(editableSet(pinnedModel), { kind: 'remove', capId: RED_SLOW })
        const remaining = runs.filter(r => r.capId !== RED_SLOW)
        const model = compose(removed.query!, remaining)

        expect(removed.query).toBe(runsQuery(remaining))
        expect(sidesOf(model)[0]).toEqual({ side: RED, capId: RED_FAST, pinned: false })
        expect(partnersOf(model)[RED_MID]).toBe(RED_FAST)
    })
})

describe('runs on different sides', () => {
    const comparison = { state: 'aligned' } as CapComparison

    it('compare the other side’s reference with the lead reference on final time only, without a note on that baseline', () => {
        const comparisons: LoadedComparisons = new Map([[`${BLUE_FAST}:${RED_FAST}`, comparison]])
        const model = compose(runsQuery(), MIXED, comparisons)
        const blue = laneOf(model, BLUE_FAST)

        expect(partnersOf(model)[BLUE_FAST]).toBe(RED_FAST)
        expect(blue).toMatchObject({ rung: 'time', reference: true, sideLabel: 'Blue', curves: [], bands: [], splits: [] })
        expect(blue.finalGap.label).toBe('+2.000')
        expect(blue.badges).toEqual([])
    })

    it('never ask for a comparison across sides', () => {
        const model = compose(runsQuery())

        expect(model.lanes.requests.every(request => {
            const side = (capId: string) => MIXED.find(r => r.capId === capId)!.side
            return side(request.runner) === side(request.reference)
        })).toBe(true)
    })

    it('tag every run with the side it was set on', () => {
        const model = compose(runsQuery())

        expect(model.lanes.lanes.map(lane => lane.sideLabel)).toEqual(['Red', 'Red', 'Blue', 'Blue'])
    })

    it('stay on final time only when the lead reference has an unknown side', () => {
        const runs = [run(UNKNOWN, 78, null), run(BLUE_FAST, 81, BLUE), run(RED_FAST, 79, RED)]
        const model = compose(runsQuery(runs), runs)

        expect(laneOf(model, BLUE_FAST)).toMatchObject({ rung: 'time', reference: true, curves: [] })
        expect(model.lanes.requests).toEqual([{ runner: RED_FAST, reference: UNKNOWN }])
    })
})
