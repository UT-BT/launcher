import { describe, expect, it } from 'vitest'
import type { ReplayVideo } from '@/app/utils/api'
import type { SoloRun } from '../loading/soloRuns'
import { composeCompareModel } from '../model/compareModel'
import type { LoadedVideos } from '../model/raceModel'
import { formatOffset, offsetNudges } from './offsetNudge'
import { OLDER_VIDEO, rosterRows } from './rosterRows'

const IDS = Array.from({ length: 9 }, (_, i) => `0${i}0${i}0${i}0${i}-0000-4000-8000-00000000000${i}`)
const [A, B, C, D] = IDS

function run(capId: string, timeSeconds: number, side = 0): SoloRun {
    return {
        capId,
        user: `70000000000000000${IDS.indexOf(capId)}`,
        alias: `Player ${IDS.indexOf(capId) + 1}`,
        title: null,
        timeSeconds,
        map: 'CTF-BT-NaliRealm',
        side,
        hasGhost: false,
        zoneCheckpoints: null,
        checkpoints: [],
        disallowed: false,
    }
}

function video(capId: string, overrides: Partial<ReplayVideo> = {}): ReplayVideo {
    return { source: 'utrecorder', mp4_url: `https://media.test/${capId}.mp4`, view_url: null, fps: 60, ...overrides }
}

function rowsOf(query: string, runs: SoloRun[], videos: LoadedVideos = new Map(runs.map(r => [r.capId, video(r.capId)])), failedVideos: ReadonlySet<string> = new Set()) {
    const model = composeCompareModel({
        query,
        runs: new Map(runs.map(r => [r.capId, r])),
        videos,
        failedVideos,
        stageBox: { width: 1920, height: 1080 },
    })
    return rosterRows({ model, videos, failedVideos })
}

describe('the roster', () => {
    it('lists the reference first on each side, then the side’s runs in add order, each tagged with its side, and marks only the analysed side’s baseline', () => {
        const runs = [run(A, 82), run(B, 83, 1), run(C, 80), run(D, 81, 1)]
        const rows = rowsOf(`runs=${A},${B},${C},${D}`, runs)

        expect(rows.map(row => [row.capId, row.reference, row.sideLabel])).toEqual([
            [C, true, 'Red'],
            [A, false, 'Red'],
            [D, false, 'Blue'],
            [B, false, 'Blue'],
        ])
    })

    it('tags no side when every run was set on the same side', () => {
        const rows = rowsOf(`runs=${A},${B}`, [run(A, 82, 1), run(B, 80, 1)])

        expect(rows.map(row => row.sideLabel)).toEqual([null, null])
    })

    it('shows each run’s final time, and no gap, note or lone baseline when each side has one run', () => {
        const rows = rowsOf(`runs=${A},${B}`, [run(A, 81.234), run(B, 79.5, 1)])

        expect(rows.map(row => [row.time, row.reference, row.badges, row.gap])).toEqual([
            ['01:19.500', false, [], null],
            ['01:21.234', false, [], null],
        ])
    })

    it('gives every run but a baseline its final gap to that baseline', () => {
        const rows = rowsOf(`runs=${A},${B}`, [run(A, 81.25), run(B, 80)])

        expect(rows.map(row => [row.capId, row.gap?.label ?? null, row.gap?.tone ?? null])).toEqual([
            [B, null, null],
            [A, '+1.250', 'behind'],
        ])
    })

    it('marks a pinned reference', () => {
        const rows = rowsOf(`runs=${A},${B}&ref=${A}`, [run(A, 82), run(B, 80)])

        expect(rows.map(row => [row.capId, row.reference, row.pinned])).toEqual([[A, true, true], [B, false, false]])
    })

    it('tells a playing video from one switched off and from a run without one', () => {
        const runs = [run(A, 80), run(B, 81), run(C, 82), run(D, 83)]
        const videos: LoadedVideos = new Map([[A, video(A)], [B, video(B)], [C, null], [D, video(D)]])
        const rows = rowsOf(`runs=${A},${B},${C},${D}&data=${B}`, runs, videos, new Set([D]))

        expect(rows.map(row => [row.capId, row.video, row.badges])).toEqual([
            [A, 'on', []],
            [B, 'off', ['Final time only']],
            [C, 'none', ['Final time only', 'Graph only']],
            [D, 'none', ['Final time only', 'Video didn’t load']],
        ])
    })

    it('shows a run past the eighth video as off', () => {
        const runs = IDS.map((capId, i) => run(capId, 80 + i))
        const rows = rowsOf(`runs=${IDS.join(',')}`, runs)

        expect(rows.at(-1)).toMatchObject({ capId: IDS[8], video: 'off' })
    })

    it('flags a video that is not from UTRecorder as an older video, with its offset and frame rate', () => {
        const runs = [run(A, 80), run(B, 81)]
        const videos: LoadedVideos = new Map([[A, video(A)], [B, video(B, { source: 'democonverter', fps: 25 })]])
        const rows = rowsOf(`runs=${A},${B}&off=${B}:-120`, runs, videos)

        expect(rows.map(row => [row.frameSynced, row.offsetMs, row.fps])).toEqual([[true, 0, 60], [false, -120, 25]])
        expect(OLDER_VIDEO).toBe('Older video')
    })
})

describe('the offset nudges', () => {
    it('step by a tenth of a second and by one frame of the video', () => {
        expect(offsetNudges(25).map(nudge => [nudge.label, nudge.ms])).toEqual([
            ['−100 ms', -100],
            ['−1 frame', -40],
            ['+1 frame', 40],
            ['+100 ms', 100],
        ])
    })

    it('read as signed milliseconds', () => {
        expect([formatOffset(0), formatOffset(33), formatOffset(-120)]).toEqual(['0 ms', '+33 ms', '−120 ms'])
    })
})
