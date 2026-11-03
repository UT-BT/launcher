import { describe, expect, it } from 'vitest'
import type { ReplayVideo } from '@/app/utils/api'
import type { SoloRun } from '../loading/soloRuns'
import { composeCompareModel } from './compareModel'
import { povForAudio, stepPov, swipeOf, type StageEnvironment } from './phoneStage'
import { packFocus, TILE_ASPECT, type StageBox } from './stageLayout'

const A = 'a1a1a1a1-0000-4000-8000-0000000000a1'
const B = 'b2b2b2b2-0000-4000-8000-0000000000b2'
const C = 'c3c3c3c3-0000-4000-8000-0000000000c3'
const D = 'd4d4d4d4-0000-4000-8000-0000000000d4'

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

function touchAt(width: number, height: number): StageEnvironment {
    return { touch: true, width, height }
}

interface Setup {
    ids: string[]
    environment: StageEnvironment | null
    stageBox: StageBox
    pov?: string | null
    focus?: string | null
    query?: string
}

function compose({ ids, environment, stageBox, pov = null, focus = null, query }: Setup) {
    const runs = RUNS.filter(r => ids.includes(r.capId))
    return composeCompareModel({
        query: query ?? `runs=${ids.join(',')}`,
        runs: new Map(runs.map(r => [r.capId, r])),
        videos: new Map(runs.map(r => [r.capId, video(r.capId)])),
        stageBox,
        focus,
        environment,
        pov,
    })
}

function placedIds(race: ReturnType<typeof compose>['race']): string[] {
    return race.layout.placed.map(placed => placed.slot.id)
}

function hiddenIds(race: ReturnType<typeof compose>['race']): string[] {
    return race.runs.filter(raceRun => raceRun.hidden).map(raceRun => raceRun.run.capId)
}

function expectInside(race: ReturnType<typeof compose>['race'], box: StageBox) {
    for (const { rect } of race.layout.placed) {
        expect(rect.width / rect.height).toBeCloseTo(TILE_ASPECT, 6)
        expect(rect.x).toBeGreaterThanOrEqual(0)
        expect(rect.y).toBeGreaterThanOrEqual(0)
        expect(rect.x + rect.width).toBeLessThanOrEqual(box.width + 1e-6)
        expect(rect.y + rect.height).toBeLessThanOrEqual(box.height + 1e-6)
    }
}

describe('the stage on a phone in portrait', () => {
    const PHONE = touchAt(390, 844)
    const BOX = { width: 390, height: 220 }

    it('shows one tile at 390×844 and hides the other videos', () => {
        const { race } = compose({ ids: [A, B, C], environment: PHONE, stageBox: BOX })

        expect(race.view).toMatchObject({ form: 'phone-portrait', mode: 'single', pov: A, visible: [A], switcher: true })
        expect(placedIds(race)).toEqual([A])
        expect(race.layout.placed[0].rect).toEqual({ x: 0, y: (220 - 390 / TILE_ASPECT) / 2, width: 390, height: 390 / TILE_ASPECT })
        expect(race.tiles.map(tile => tile.id)).toEqual([A, B, C])
        expect(hiddenIds(race)).toEqual([B, C])
    })

    it('shows the chosen point of view, and the first tile when the choice has no tile', () => {
        expect(placedIds(compose({ ids: [A, B, C], environment: PHONE, stageBox: BOX, pov: C }).race)).toEqual([C])
        expect(placedIds(compose({ ids: [A, B, C], environment: PHONE, stageBox: BOX, pov: D }).race)).toEqual([A])
        const switchedOff = compose({ ids: [A, B, C], environment: PHONE, stageBox: BOX, pov: C, query: `runs=${A},${B},${C}&data=${C}` }).race
        expect(switchedOff.view.pov).toBe(A)
        expect(hiddenIds(switchedOff)).toEqual([B])
    })

    it('never hides a data-only run, which keeps its lane on the master clock', () => {
        const { race } = compose({ ids: [A, B, C], environment: PHONE, stageBox: BOX, query: `runs=${A},${B},${C}&data=${B}` })

        expect(race.dataOnly.map(raceRun => raceRun.run.capId)).toEqual([B])
        expect(race.dataOnly[0].hidden).toBeUndefined()
        expect(hiddenIds(race)).toEqual([C])
    })

    it('has no switcher for a single video and ignores a stored focus', () => {
        const single = compose({ ids: [A], environment: PHONE, stageBox: BOX }).race
        expect(single.view.switcher).toBe(false)
        expect(hiddenIds(single)).toEqual([])

        const focused = compose({ ids: [A, B], environment: PHONE, stageBox: BOX, focus: B }).race
        expect(focused.focused).toBeNull()
        expect(placedIds(focused)).toEqual([A])
    })
})

describe('the stage on a tablet in portrait', () => {
    const TABLET = touchAt(820, 1180)
    const BOX = { width: 820, height: 900 }

    it('stacks two tiles at 820×1180', () => {
        const { race } = compose({ ids: [A, B], environment: TABLET, stageBox: BOX })

        expect(race.view).toMatchObject({ form: 'tablet-portrait', mode: 'stacked', visible: [A, B], switcher: false })
        const [top, bottom] = race.layout.placed.map(placed => placed.rect)
        expect(top.x).toBe(bottom.x)
        expect(bottom.y).toBeGreaterThan(top.y + top.height)
        expect(top.width).toBeCloseTo(Math.min(820, ((900 - 4) / 2) * TILE_ASPECT), 6)
        expectInside(race, BOX)
        expect(hiddenIds(race)).toEqual([])
    })

    it('stacks the chosen run and the next one when more runs have videos', () => {
        const { race } = compose({ ids: [A, B, C, D], environment: TABLET, stageBox: BOX, pov: D })

        expect(race.view.switcher).toBe(true)
        expect(placedIds(race)).toEqual([D, A])
        expect(hiddenIds(race)).toEqual([B, C])
    })
})

describe('the stage on a phone in landscape', () => {
    const LANDSCAPE = touchAt(844, 390)
    const BOX = { width: 844, height: 300 }

    it('puts two tiles side by side at 844×390 when there are two runs', () => {
        const { race } = compose({ ids: [A, B], environment: LANDSCAPE, stageBox: BOX })

        expect(race.view).toMatchObject({ form: 'phone-landscape', mode: 'side-by-side', visible: [A, B], switcher: false })
        const [left, right] = race.layout.placed.map(placed => placed.rect)
        expect(left.y).toBe(right.y)
        expect(right.x).toBeGreaterThan(left.x + left.width)
        expect(left.width).toBeCloseTo(Math.min((844 - 4) / 2, 300 * TILE_ASPECT), 6)
        expectInside(race, BOX)
    })

    it('shows one tile with the switcher when there are more runs', () => {
        const { race } = compose({ ids: [A, B, C], environment: LANDSCAPE, stageBox: BOX, pov: B })

        expect(race.view).toMatchObject({ mode: 'single', visible: [B], switcher: true })
        expectInside(race, BOX)
    })
})

describe('the stage on a wide screen', () => {
    const BOX = { width: 1920, height: 1080 }

    it('keeps the packed grid and the focus without touch, at any size', () => {
        for (const environment of [null, { touch: false, width: 390, height: 844 }, { touch: false, width: 1920, height: 1080 }]) {
            const { race } = compose({ ids: [A, B, C], environment, stageBox: BOX, focus: B })
            expect(race.view).toMatchObject({ form: 'wide', mode: 'grid', visible: [A, B, C], switcher: false })
            expect(race.layout).toEqual(packFocus(race.tiles, B, BOX))
            expect(hiddenIds(race)).toEqual([])
        }
    })

    it('keeps the packed grid on a touch screen in landscape from 1024 px', () => {
        const { race } = compose({ ids: [A, B, C], environment: touchAt(1180, 820), stageBox: BOX })

        expect(race.view.mode).toBe('grid')
        expect(placedIds(race)).toEqual([A, B, C])
    })
})

describe('switching the point of view', () => {
    const PHONE = touchAt(390, 844)
    const BOX = { width: 390, height: 220 }

    it('steps through the tiles in stage order and wraps', () => {
        const { race } = compose({ ids: [A, B, C], environment: PHONE, stageBox: BOX, pov: C })

        expect(stepPov(race.tiles, race.view, 1)).toBe(A)
        expect(stepPov(race.tiles, race.view, -1)).toBe(B)
    })

    it('stays put without a switcher', () => {
        const { race } = compose({ ids: [A, B], environment: touchAt(844, 390), stageBox: BOX })

        expect(stepPov(race.tiles, race.view, 1)).toBe(race.view.pov)
    })

    it('moves the point of view to an audible run outside the view, and only then', () => {
        const phone = compose({ ids: [A, B, C], environment: PHONE, stageBox: BOX }).race
        expect(povForAudio(phone.view, C)).toBe(C)
        expect(povForAudio(phone.view, A)).toBeNull()
        expect(povForAudio(phone.view, null)).toBeNull()

        const tablet = compose({ ids: [A, B, C], environment: touchAt(820, 1180), stageBox: { width: 820, height: 900 } }).race
        expect(povForAudio(tablet.view, B)).toBeNull()
        expect(povForAudio(tablet.view, C)).toBe(C)

        const wide = compose({ ids: [A, B, C], environment: null, stageBox: { width: 1280, height: 720 } }).race
        expect(povForAudio(wide.view, C)).toBeNull()
    })

    it('reads a swipe only when it is long enough and mostly along one axis', () => {
        expect(swipeOf(-80, 10)).toBe('left')
        expect(swipeOf(80, -20)).toBe('right')
        expect(swipeOf(5, 90)).toBe('down')
        expect(swipeOf(-30, 0)).toBeNull()
        expect(swipeOf(70, 50)).toBeNull()
    })
})
