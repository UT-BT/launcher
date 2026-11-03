import { describe, expect, it } from 'vitest'
import type { ReplayVideo } from '@/app/utils/api'
import type { SoloRun } from '../loading/soloRuns'
import { composeCompareModel } from './compareModel'
import { focusAt, nextAudio, toggleFocus } from './focusModel'
import { packFocus, packStage } from './stageLayout'

const A = 'a1a1a1a1-0000-4000-8000-0000000000a1'
const B = 'b2b2b2b2-0000-4000-8000-0000000000b2'
const C = 'c3c3c3c3-0000-4000-8000-0000000000c3'
const D = 'd4d4d4d4-0000-4000-8000-0000000000d4'
const BOX = { width: 1920, height: 1080 }

function run(capId: string, timeSeconds: number): SoloRun {
    return {
        capId,
        user: `7000000000000000${capId.slice(0, 2)}`,
        alias: capId.slice(0, 4),
        title: null,
        timeSeconds,
        map: 'CTF-BT-NaliRealm',
        side: 0,
        hasGhost: false,
        zoneCheckpoints: null,
        checkpoints: [],
        disallowed: false,
    }
}

const RUNS = [run(A, 12), run(B, 13), run(C, 14), run(D, 15)]

function video(capId: string): ReplayVideo {
    return { source: 'utrecorder', mp4_url: `https://media.test/${capId}.mp4`, view_url: null, fps: 60 }
}

function compose(focus: string | null, query = `runs=${RUNS.map(r => r.capId).join(',')}`, missing: string[] = []) {
    return composeCompareModel({
        query,
        runs: new Map(RUNS.map(r => [r.capId, r])),
        videos: new Map(RUNS.map(r => [r.capId, missing.includes(r.capId) ? null : video(r.capId)])),
        stageBox: BOX,
        focus,
    })
}

describe('the focus layout', () => {
    it('packs the stage around the focused tile', () => {
        const { race } = compose(C)

        expect(race.focused).toBe(C)
        expect(race.layout).toEqual(packFocus(race.tiles, C, BOX))
    })

    it('is the grid when nothing is focused', () => {
        const { race } = compose(null)

        expect(race.focused).toBeNull()
        expect(race.layout).toEqual(packStage(race.tiles, BOX))
    })

    it('falls back to the grid when the focused run loses its tile', () => {
        const noVideo = compose(C, undefined, [C])
        const dataOnly = compose(C, `runs=${A},${B},${C},${D}&data=${C}`)
        const removed = compose(C, `runs=${A},${B},${D}`)

        for (const { race } of [noVideo, dataOnly, removed]) {
            expect(race.focused).toBeNull()
            expect(race.layout).toEqual(packStage(race.tiles, BOX))
        }
    })

    it('focuses a tile on a click and returns to the grid on a second click', () => {
        const { race } = compose(null)

        expect(toggleFocus(race, null, B)).toBe(B)
        expect(toggleFocus(race, B, D)).toBe(D)
        expect(toggleFocus(race, B, B)).toBeNull()
    })

    it('never focuses a run without a tile', () => {
        const { race } = compose(null, `runs=${A},${B},${C},${D}&data=${C}`)

        expect(toggleFocus(race, B, C)).toBe(B)
        expect(toggleFocus(race, null, C)).toBeNull()
    })

    it('numbers the tiles in stage order, skipping runs without a tile', () => {
        const { race } = compose(null, `runs=${A},${B},${C},${D}&data=${B}`)

        expect([1, 2, 3].map(n => focusAt(race, n))).toEqual([A, C, D])
        expect(focusAt(race, 4)).toBeNull()
    })
})

describe('cycling the audio', () => {
    it('goes from muted through every video tile in stage order and back to muted', () => {
        const { race } = compose(null, `runs=${A},${B},${C},${D}&data=${B}`)

        const order = [null, A, C, D, null]
        order.slice(0, -1).forEach((audible, i) => expect(nextAudio(race, audible)).toBe(order[i + 1]))
    })

    it('starts from the first tile when the chosen run has no tile', () => {
        const { race } = compose(null, `runs=${A},${B},${C},${D}&data=${B}`)

        expect(nextAudio(race, B)).toBe(A)
    })
})
