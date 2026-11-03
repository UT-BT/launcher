import { describe, expect, it } from 'vitest'
import type { ReplayVideo } from '@/app/utils/api'
import type { SoloRun } from '../loading/soloRuns'
import { composeCompareModel, type CompareModelInput } from './compareModel'
import { videoReadOrder } from './raceModel'
import { parseCompareQuery } from '../url/compareUrl'

const IDS = Array.from({ length: 10 }, (_, i) => `0${i}0${i}0${i}0${i}-0000-4000-8000-00000000000${i}`)
const [A, B, C, D] = IDS

function run(capId: string, timeSeconds: number, overrides: Partial<SoloRun> = {}): SoloRun {
    return {
        capId,
        user: `70000000000000000${IDS.indexOf(capId)}`,
        alias: `Player ${IDS.indexOf(capId) + 1}`,
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

function video(capId: string, overrides: Partial<ReplayVideo> = {}): ReplayVideo {
    return { source: 'utrecorder', mp4_url: `https://media.test/${capId}.mp4`, view_url: null, fps: 60, ...overrides }
}

function compose(query: string, runs: SoloRun[], extra: Partial<CompareModelInput> = {}) {
    return composeCompareModel({
        query,
        runs: new Map(runs.map(r => [r.capId, r])),
        videos: new Map(runs.map(r => [r.capId, video(r.capId)])),
        stageBox: { width: 1920, height: 1080 },
        ...extra,
    }).race
}

function tileIds(race: ReturnType<typeof compose>): string[] {
    return race.tiles.map(tile => tile.id)
}

function badgesOf(race: ReturnType<typeof compose>): Record<string, string[]> {
    return Object.fromEntries(race.dataOnly.map(row => [row.run.capId, row.badges]))
}

describe('the race stage', () => {
    it('gives every run with a video a video tile, in add order', () => {
        const race = compose(`runs=${A},${B}`, [run(A, 81.234), run(B, 79.5)])

        expect(race.runs.map(r => r.run.capId)).toEqual([A, B])
        expect(race.tiles).toEqual([
            expect.objectContaining({ kind: 'video', id: A, src: `https://media.test/${A}.mp4`, badges: [] }),
            expect.objectContaining({ kind: 'video', id: B, src: `https://media.test/${B}.mp4`, badges: [] }),
        ])
        expect(race.dataOnly).toEqual([])
    })

    it('packs the tiles into the measured stage', () => {
        const race = compose(`runs=${A},${B}`, [run(A, 81.234), run(B, 79.5)], { stageBox: { width: 1800, height: 600 } })

        expect([race.layout.columns, race.layout.rows]).toEqual([2, 1])
        expect(race.layout.placed.map(p => p.slot.id)).toEqual([A, B])
    })

    it('places nothing before the stage is measured', () => {
        const race = compose(`runs=${A},${B}`, [run(A, 81.234), run(B, 79.5)], { stageBox: null })

        expect(tileIds(race)).toEqual([A, B])
        expect(race.layout.placed).toEqual([])
    })

    it('keeps a tile for a run whose video is still being read', () => {
        const race = compose(`runs=${A},${B}`, [run(A, 81.234), run(B, 79.5)], { videos: new Map([[A, video(A)]]) })

        expect(tileIds(race)).toEqual([A, B])
        expect(race.tiles[1].src).toBeNull()
    })

    it('plays at most eight videos and lists the runs past them as data-only without a video', () => {
        const runs = IDS.map((id, i) => run(id, 70 + i))
        const race = compose(`runs=${IDS.join(',')}`, runs)

        expect(tileIds(race)).toEqual(IDS.slice(0, 8))
        expect(badgesOf(race)).toEqual({ [IDS[8]]: ['No video'], [IDS[9]]: ['No video'] })
    })

    it('makes a run without a video data-only, which frees its tile for the ninth run', () => {
        const runs = IDS.slice(0, 9).map((id, i) => run(id, 70 + i))
        const videos = new Map<string, ReplayVideo | null>(runs.map(r => [r.capId, video(r.capId)]))
        videos.set(C, null)
        const race = compose(`runs=${IDS.slice(0, 9).join(',')}`, runs, { videos })

        expect(tileIds(race)).toEqual(IDS.slice(0, 9).filter(id => id !== C))
        expect(badgesOf(race)).toEqual({ [C]: ['No video'] })
    })

    it('makes a run listed in data a data-only lane', () => {
        const race = compose(`runs=${A},${B}&data=${B}`, [run(A, 81.234), run(B, 79.5)])

        expect(tileIds(race)).toEqual([A])
        expect(badgesOf(race)).toEqual({ [B]: ['No video'] })
        expect(race.runs.map(r => r.tile)).toEqual([true, false])
    })

    it('drops a video that failed to load to a data-only lane marked unavailable', () => {
        const race = compose(`runs=${A},${B}`, [run(A, 81.234), run(B, 79.5)], { failedVideos: new Set([A]) })

        expect(tileIds(race)).toEqual([B])
        expect(badgesOf(race)).toEqual({ [A]: ['Video unavailable'] })
    })
})

describe('the default reference and the result at the cap', () => {
    it('takes the fastest run as the reference', () => {
        const race = compose(`runs=${A},${B},${C}`, [run(A, 81.234), run(B, 79.5), run(C, 80)])

        expect(race.reference).toBe(B)
    })

    it('keeps the first listed of two equally fast runs as the reference', () => {
        const race = compose(`runs=${A},${B}`, [run(A, 79.5), run(B, 79.5)])

        expect(race.reference).toBe(A)
    })

    it('shows the cap time, the gap to the reference and the finish position on its side', () => {
        const race = compose(`runs=${A},${B},${C},${D}`, [
            run(A, 83.456),
            run(B, 82.944),
            run(C, 79.5, { side: 1 }),
            run(D, 81.0, { side: 1 }),
        ])

        expect(race.runs.map(r => r.result)).toEqual([
            'CAP 1:23.456 · +3.956 · 2nd',
            'CAP 1:22.944 · +3.444 · 1st',
            'CAP 1:19.500 · ±0.000 · 1st',
            'CAP 1:21.000 · +1.500 · 2nd',
        ])
    })

    it('ranks equal times on a side together', () => {
        const race = compose(`runs=${A},${B},${C}`, [run(A, 80), run(B, 80), run(C, 81)])

        expect(race.runs.map(r => r.result.split(' · ')[2])).toEqual(['1st', '1st', '3rd'])
    })

    it('freezes each run at its own official cap time', () => {
        const race = compose(`runs=${A},${B}`, [run(A, 81.234), run(B, 79.5)])

        expect(race.runs.map(r => r.cap)).toEqual([81.234, 79.5])
    })
})

describe('offsets for videos that are not frame-synced', () => {
    it('applies an offset only to a video that is not from UTRecorder', () => {
        const runs = [run(A, 81.234), run(B, 79.5)]
        const race = compose(`runs=${A},${B}&off=${A}:-1500,${B}:250`, runs, {
            videos: new Map([[A, video(A, { source: 'democonverter', fps: null })], [B, video(B)]]),
        })

        expect(race.runs.map(r => r.offset)).toEqual([-1.5, 0])
        expect(race.runs.map(r => [r.source, r.fps])).toEqual([['democonverter', null], ['utrecorder', 60]])
    })

    it('has no offset while the video is unknown', () => {
        const race = compose(`runs=${A}&off=${A}:400`, [run(A, 81.234)], { videos: new Map() })

        expect(race.runs[0].offset).toBe(0)
        expect(race.runs[0].source).toBeNull()
    })
})

describe('the video read order', () => {
    it('reads the runs that get a tile first, then the data-only ones, in add order', () => {
        const { state } = parseCompareQuery(`runs=${A},${B},${C},${D}&data=${A},${C}`)

        expect(videoReadOrder(state)).toEqual([B, D, A, C])
    })
})

describe('while the runs load', () => {
    it('has no race yet', () => {
        const model = composeCompareModel({ query: `runs=${A}`, runs: new Map() })

        expect(model.race.runs).toEqual([])
        expect(model.race.tiles).toEqual([])
        expect(model.race.reference).toBeNull()
    })
})
