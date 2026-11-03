import { describe, expect, it } from 'vitest'
import type { ReplayVideo } from '@/app/utils/api'
import type { SoloRun } from '../loading/soloRuns'
import { composeCompareModel } from './compareModel'
import { editableSet, editSet, LAST_RUN, RUN_LIMIT_REACHED, VIDEO_LIMIT_REACHED, type SetEdit } from './setEdits'

const IDS = Array.from({ length: 11 }, (_, i) => `${String(i).padStart(2, '0')}0000aa-0000-4000-8000-0000000000${String(i).padStart(2, '0')}`)
const [A, B, C, D] = IDS
const RED = 0
const BLUE = 1

function run(capId: string, timeSeconds: number, side = RED): SoloRun {
    return {
        capId,
        user: `7000000000000000${String(IDS.indexOf(capId)).padStart(2, '0')}`,
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
    return { source: 'democonverter', mp4_url: `https://media.test/${capId}.mp4`, view_url: null, fps: 60 }
}

const RUNS = [run(A, 80), run(B, 79), run(C, 82, BLUE), run(D, 81, BLUE)]

function modelOf(query: string, runs: SoloRun[] = RUNS) {
    return composeCompareModel({
        query,
        runs: new Map(runs.map(r => [r.capId, r])),
        videos: new Map(runs.map(r => [r.capId, video(r.capId)])),
        stageBox: { width: 1920, height: 1080 },
    })
}

function edit(query: string, change: SetEdit, runs: SoloRun[] = RUNS) {
    return editSet(editableSet(modelOf(query, runs)), change)
}

const FOUR = `runs=${A},${B},${C},${D}`

describe('adding a run', () => {
    it('appends it in add order', () => {
        expect(edit(`runs=${A},${B}`, { kind: 'add', capId: C })).toEqual({ query: `runs=${A},${B},${C}`, blocked: null })
    })

    it('leaves the set as it is when the run is already in it', () => {
        expect(edit(FOUR, { kind: 'add', capId: B }).query).toBe(FOUR)
    })

    it('is blocked with an explanation past ten runs', () => {
        const ten = IDS.slice(0, 10).map((capId, i) => run(capId, 80 + i))

        expect(edit(`runs=${IDS.slice(0, 10).join(',')}`, { kind: 'add', capId: IDS[10] }, ten)).toEqual({ query: null, blocked: RUN_LIMIT_REACHED })
    })
})

describe('removing a run', () => {
    it('drops the run and every entry that points at it', () => {
        const query = `${FOUR}&ref=${A},${C}&data=${A},${B}&off=${A}:120,${D}:-40`

        expect(edit(query, { kind: 'remove', capId: A }).query).toBe(`runs=${B},${C},${D}&ref=${C}&data=${B}&off=${D}:-40`)
    })

    it('never removes the last run', () => {
        expect(edit(`runs=${A}`, { kind: 'remove', capId: A }, [run(A, 80)])).toEqual({ query: null, blocked: LAST_RUN })
    })
})

describe('pinning a reference', () => {
    it('stores the pin', () => {
        expect(edit(FOUR, { kind: 'pin', capId: A }).query).toBe(`${FOUR}&ref=${A}`)
    })

    it('replaces the pin on the same side and keeps the other side’s', () => {
        expect(edit(`${FOUR}&ref=${A},${C}`, { kind: 'pin', capId: B }).query).toBe(`${FOUR}&ref=${C},${B}`)
    })

    it('unpinning falls back to the fastest run on that side', () => {
        const unpinned = edit(`${FOUR}&ref=${A},${C}`, { kind: 'unpin', capId: A })

        expect(unpinned.query).toBe(`${FOUR}&ref=${C}`)
        expect(modelOf(unpinned.query!).race.references.sides[0]).toEqual({ side: RED, capId: B, pinned: false })
    })
})

describe('turning a video on and off', () => {
    it('turns a video off by listing the run as data-only', () => {
        expect(edit(FOUR, { kind: 'video', capId: B, on: false }).query).toBe(`${FOUR}&data=${B}`)
    })

    it('turns it back on', () => {
        expect(edit(`${FOUR}&data=${B},${C}`, { kind: 'video', capId: B, on: true }).query).toBe(`${FOUR}&data=${C}`)
    })

    it('blocks a ninth video with an explanation', () => {
        const nine = IDS.slice(0, 9).map((capId, i) => run(capId, 80 + i))
        const query = `runs=${IDS.slice(0, 9).join(',')}&data=${IDS[8]}`

        expect(modelOf(query, nine).race.tiles).toHaveLength(8)
        expect(edit(query, { kind: 'video', capId: IDS[8], on: true }, nine)).toEqual({ query: null, blocked: VIDEO_LIMIT_REACHED })
    })

    it('lets a video on again once another is off', () => {
        const nine = IDS.slice(0, 9).map((capId, i) => run(capId, 80 + i))
        const query = `runs=${IDS.slice(0, 9).join(',')}&data=${IDS[0]},${IDS[8]}`

        expect(edit(query, { kind: 'video', capId: IDS[8], on: true }, nine).query).toBe(`runs=${IDS.slice(0, 9).join(',')}&data=${IDS[0]}`)
    })
})

describe('offsets', () => {
    it('stores a whole-millisecond offset for the run', () => {
        expect(edit(FOUR, { kind: 'offset', capId: C, ms: 33.4 }).query).toBe(`${FOUR}&off=${C}:33`)
    })

    it('replaces the run’s offset in place', () => {
        expect(edit(`${FOUR}&off=${A}:10,${C}:20`, { kind: 'offset', capId: A, ms: -50 }).query).toBe(`${FOUR}&off=${A}:-50,${C}:20`)
    })

    it('drops an offset set back to zero', () => {
        expect(edit(`${FOUR}&off=${A}:10`, { kind: 'offset', capId: A, ms: 0 }).query).toBe(FOUR)
    })
})

describe('the URL an edit produces', () => {
    it('never carries the start time', () => {
        const model = modelOf(`${FOUR}&t=12.500`)

        expect(editSet(editableSet(model), { kind: 'pin', capId: A }).query).toBe(`${FOUR}&ref=${A}`)
    })
})
