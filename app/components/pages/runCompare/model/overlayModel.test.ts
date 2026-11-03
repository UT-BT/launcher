import { describe, expect, it } from 'vitest'
import type { CapCheckpoint, ReplayVideo } from '@/app/utils/api'
import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import type { LoadedComparisons } from '../loading/comparisons'
import type { SoloRun } from '../loading/soloRuns'
import { audibleRun, chooseAudio } from './audioModel'
import { composeCompareModel } from './compareModel'
import { SECTOR_FLASH_MS, tileOverlays, tileReadout, type TileOverlay } from './overlayModel'

const SHORT = runCompareFixture('short')
const RUNNER = SHORT.runner.cap_id
const REFERENCE = SHORT.reference.cap_id
const BLUE = 'c3c3c3c3-0000-4000-8000-0000000000c3'
const SLOW = 'd4d4d4d4-0000-4000-8000-0000000000d4'

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

const reference = run(REFERENCE, SHORT.reference.cap_time_ms / 1000, { checkpoints: checkpoints(['Door', 3], ['Hall', 7]) })
const runner = run(RUNNER, SHORT.runner.cap_time_ms / 1000, { checkpoints: checkpoints(['Door', 3.2], ['Hall', 7.5]) })

function video(capId: string, source: ReplayVideo['source'] = 'utrecorder'): ReplayVideo {
    return { source, mp4_url: `https://media.test/${capId}.mp4`, view_url: null, fps: 60 }
}

interface ComposeOptions {
    query?: string
    comparisons?: LoadedComparisons
    videos?: Map<string, ReplayVideo | null>
}

function compose(runs: SoloRun[], { query, comparisons = new Map(), videos }: ComposeOptions = {}) {
    return composeCompareModel({
        query: query ?? `runs=${runs.map(r => r.capId).join(',')}`,
        runs: new Map(runs.map(r => [r.capId, r])),
        videos: videos ?? new Map(runs.map(r => [r.capId, video(r.capId)])),
        stageBox: { width: 1920, height: 1080 },
        comparisons,
    })
}

const aligned: LoadedComparisons = new Map([[`${RUNNER}:${REFERENCE}`, SHORT]])
const refused: LoadedComparisons = new Map([[`${RUNNER}:${REFERENCE}`, null]])

function overlayOf(model: ReturnType<typeof compose>, capId: string): TileOverlay {
    return tileOverlays(model).get(capId)!
}

describe('the tile overlay', () => {
    it('gives every video tile its player, final time, reference pin and badges', () => {
        const model = compose([runner, reference], { comparisons: aligned })
        const overlays = tileOverlays(model)

        expect([...overlays.keys()]).toEqual([RUNNER, REFERENCE])
        expect(overlays.get(RUNNER)).toMatchObject({ run: runner, time: '0:12.342', reference: false, pinned: false, badges: ['Replay'], removable: true })
        expect(overlays.get(REFERENCE)).toMatchObject({ run: reference, time: '0:11.830', reference: true, pinned: false, badges: ['Replay'] })
    })

    it('leaves the team colour slot empty for solo runs', () => {
        const model = compose([runner, reference], { comparisons: aligned })

        expect([...tileOverlays(model).values()].map(overlay => overlay.teamColour)).toEqual([null, null])
    })

    it('moves the reference pin to a pinned run and marks it pinned', () => {
        const model = compose([runner, reference], { query: `runs=${RUNNER},${REFERENCE}&ref=${RUNNER}` })

        expect(overlayOf(model, RUNNER)).toMatchObject({ reference: true, pinned: true })
        expect(overlayOf(model, REFERENCE)).toMatchObject({ reference: false, pinned: false })
    })

    it('marks one reference per side and labels the run set on the other side', () => {
        const model = compose([runner, reference, run(BLUE, 12.9, { side: 1 })], { comparisons: aligned })

        expect(overlayOf(model, BLUE)).toMatchObject({ reference: true, badges: ['Time only', 'Set on Blue'] })
        expect(overlayOf(model, REFERENCE).reference).toBe(true)
    })

    it('flags a video not from UTRecorder as not frame-synced', () => {
        const videos = new Map([[RUNNER, video(RUNNER, 'democonverter')], [REFERENCE, video(REFERENCE)]])
        const model = compose([runner, reference], { comparisons: refused, videos })

        expect(overlayOf(model, RUNNER).badges).toEqual(['Zones', 'Not frame-synced'])
        expect(overlayOf(model, REFERENCE).badges).not.toContain('Not frame-synced')
    })

    it('has no overlay for a data-only run, and forbids removing the only run', () => {
        const model = compose([runner, reference], { query: `runs=${RUNNER},${REFERENCE}&data=${RUNNER}` })

        expect([...tileOverlays(model).keys()]).toEqual([REFERENCE])
        expect(overlayOf(compose([reference]), REFERENCE).removable).toBe(false)
    })
})

describe('the live readout on a tile', () => {
    it('shows the live delta against the run’s reference, green when ahead and red when behind', () => {
        const overlay = overlayOf(compose([runner, reference], { comparisons: refused }), RUNNER)

        expect(tileReadout(overlay, { seconds: 2, playing: true }).delta).toEqual({ ms: 0, label: '±0.000', tone: 'even' })
        expect(tileReadout(overlay, { seconds: 5, playing: true }).delta).toMatchObject({ label: '+0.200', tone: 'behind' })
        expect(tileReadout(overlay, { seconds: 12.342, playing: false }).delta).toMatchObject({ label: '+0.512', tone: 'behind' })
    })

    it('shows the ahead tone on the faster run measured against a pinned slower reference', () => {
        const overlay = overlayOf(compose([runner, reference], { query: `runs=${RUNNER},${REFERENCE}&ref=${RUNNER}` }), REFERENCE)

        expect(tileReadout(overlay, { seconds: 11.83, playing: false }).delta).toMatchObject({ label: '−0.512', tone: 'ahead' })
    })

    it('shows no delta on a reference tile, where the REF pin stands instead', () => {
        const overlay = overlayOf(compose([runner, reference], { comparisons: aligned }), REFERENCE)

        expect(tileReadout(overlay, { seconds: 5, playing: true })).toEqual({ delta: null, flash: null })
    })

    it('shows no delta on a time-only run before its cap, and the final gap from its cap on', () => {
        const slow = run(SLOW, 14, { hasGhost: false })
        const overlay = overlayOf(compose([slow, reference]), SLOW)

        expect(tileReadout(overlay, { seconds: 5, playing: true }).delta).toBeNull()
        expect(tileReadout(overlay, { seconds: 14, playing: true }).delta).toMatchObject({ label: '+2.170', tone: 'behind' })
    })

    it('shows no delta while the comparison is still being read', () => {
        const overlay = overlayOf(compose([runner, reference]), RUNNER)

        expect(tileReadout(overlay, { seconds: 5, playing: true }).delta).toBeNull()
    })
})

describe('the sector flash', () => {
    it('flashes each sector delta for a short while as the run crosses that sector end', () => {
        const overlay = overlayOf(compose([runner, reference], { comparisons: aligned }), RUNNER)
        const [first, second] = overlay.lane!.splits
        const at = (ms: number) => tileReadout(overlay, { seconds: ms / 1000, playing: true }).flash

        expect(at(first.endMs - 1)).toBeNull()
        expect(at(first.endMs)).toMatchObject({ index: 1, label: 'S1', gap: { ms: first.deltaSplitMs } })
        expect(at(Math.min(first.endMs + SECTOR_FLASH_MS, second.endMs) - 1)).toMatchObject({ index: 1 })
        expect(at(second.endMs)).toMatchObject({ index: 2, label: 'S2', gap: { ms: second.deltaSplitMs } })
    })

    it('flashes zone splits on a zone lane', () => {
        const overlay = overlayOf(compose([runner, reference], { comparisons: refused }), RUNNER)
        const at = (seconds: number) => tileReadout(overlay, { seconds, playing: true }).flash

        expect(at(3.1)).toBeNull()
        expect(at(3.2)).toMatchObject({ index: 1, gap: { ms: 200, label: '+0.200', tone: 'behind' } })
        expect(at(3.2 + SECTOR_FLASH_MS / 1000 - 0.001)).toMatchObject({ index: 1 })
        expect(at(3.2 + SECTOR_FLASH_MS / 1000)).toBeNull()
        expect(at(7.5)).toMatchObject({ index: 2, gap: { ms: 300 } })
    })

    it('never flashes the last split at the cap, where the result shows instead', () => {
        const overlay = overlayOf(compose([runner, reference], { comparisons: aligned }), RUNNER)

        expect(tileReadout(overlay, { seconds: 12.342, playing: true }).flash).toBeNull()
        expect(tileReadout(overlay, { seconds: 13, playing: true }).flash).toBeNull()
    })

    it('flashes only during playback', () => {
        const overlay = overlayOf(compose([runner, reference], { comparisons: refused }), RUNNER)

        expect(tileReadout(overlay, { seconds: 3.2, playing: false }).flash).toBeNull()
    })

    it('never flashes on a reference or a time-only run', () => {
        const model = compose([runner, reference, run(SLOW, 14, { hasGhost: false })], { comparisons: aligned })

        for (let ms = 0; ms <= 14_000; ms += 100) {
            expect(tileReadout(overlayOf(model, REFERENCE), { seconds: ms / 1000, playing: true }).flash).toBeNull()
            expect(tileReadout(overlayOf(model, SLOW), { seconds: ms / 1000, playing: true }).flash).toBeNull()
        }
    })
})

describe('the audio choice', () => {
    it('is muted until a tile is chosen, and only one tile is ever audible', () => {
        const { race } = compose([runner, reference])

        expect(audibleRun(race, null)).toBeNull()
        const first = chooseAudio(race, null, RUNNER)
        expect(first).toBe(RUNNER)
        expect(chooseAudio(race, first, REFERENCE)).toBe(REFERENCE)
    })

    it('mutes everything when the audible tile is chosen again', () => {
        const { race } = compose([runner, reference])

        expect(chooseAudio(race, RUNNER, RUNNER)).toBeNull()
    })

    it('cannot be given to a data-only run', () => {
        const { race } = compose([runner, reference], { query: `runs=${RUNNER},${REFERENCE}&data=${RUNNER}` })

        expect(chooseAudio(race, REFERENCE, RUNNER)).toBe(REFERENCE)
        expect(chooseAudio(race, null, RUNNER)).toBeNull()
    })

    it('falls silent when the audible run loses its tile', () => {
        const { race } = compose([runner, reference], { query: `runs=${RUNNER},${REFERENCE}&data=${RUNNER}` })

        expect(audibleRun(race, RUNNER)).toBeNull()
        expect(audibleRun(race, REFERENCE)).toBe(REFERENCE)
    })
})
