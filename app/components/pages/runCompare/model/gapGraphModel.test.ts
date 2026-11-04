import { describe, expect, it } from 'vitest'
import type { CapComparison, ReplayVideo } from '@/app/utils/api'
import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import type { LoadedComparisons } from '../loading/comparisons'
import type { SoloRun } from '../loading/soloRuns'
import { RUN_COLOURS } from './analysisModel'
import { composeCompareModel } from './compareModel'
import { gapGraphOf } from './gapGraphModel'
import { composeVersus, versusOf } from './teamTestRuns'

const SHORT = runCompareFixture('short')
const RUNNER = SHORT.runner.cap_id
const REFERENCE = SHORT.reference.cap_id
const TIMED = 'd4d4d4d4-0000-4000-8000-0000000000d4'

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

function video(capId: string): ReplayVideo {
    return { source: 'utrecorder', mp4_url: `https://media.test/${capId}.mp4`, view_url: null, fps: 60 }
}

function compose(runs: SoloRun[], comparisons: [string, string, CapComparison | null][]) {
    const loaded: LoadedComparisons = new Map(comparisons.map(([from, to, comparison]) => [`${from}:${to}`, comparison]))
    return composeCompareModel({
        query: `runs=${runs.map(r => r.capId).join(',')}&ref=${REFERENCE}`,
        runs: new Map(runs.map(r => [r.capId, r])),
        videos: new Map(runs.map(r => [r.capId, video(r.capId)])),
        stageBox: { width: 1920, height: 1080 },
        comparisons: loaded,
    })
}

describe('the gap graph under the videos', () => {
    it('lists every run in stage order and draws each one against its baseline in the analysis colour', () => {
        const model = compose([run(RUNNER, 12.342), run(REFERENCE, 11.83)], [[RUNNER, REFERENCE, SHORT]])
        const graph = gapGraphOf(model)
        const colours = new Map(model.analysis.runs.map(r => [r.capId, r.colour]))

        expect(graph.series.map(line => line.key)).toEqual([RUNNER, REFERENCE])
        expect(graph.series.map(line => line.drawn)).toEqual([true, false])
        expect(graph.series.some(line => line.pending)).toBe(false)
        expect(graph.series.map(line => line.colour)).toEqual([colours.get(RUNNER), colours.get(REFERENCE)])
        const [line] = graph.series
        expect(line.segments.flat().length).toBeGreaterThan(10)
        expect(line.cap).toEqual([12342, 512])
        expect(line.dots.every(([ms]) => ms < 12342)).toBe(true)
        expect(graph.domainMs[0]).toBeLessThan(0)
        expect(graph.domainMs[1]).toBeGreaterThan(512)
        expect(graph.gridMs).toContain(0)
    })

    it('marks a run whose comparison is still loading as pending, so the graph keeps its place', () => {
        const model = compose([run(RUNNER, 12.342), run(REFERENCE, 11.83)], [])
        const graph = gapGraphOf(model)

        expect(graph.series.map(line => [line.drawn, line.pending])).toEqual([[false, true], [false, false]])
    })

    it('keeps a final-time-only run in the key without letting its gap stretch the scale', () => {
        const model = compose([run(RUNNER, 12.342), run(REFERENCE, 11.83), run(TIMED, 30, { hasGhost: false })], [[RUNNER, REFERENCE, SHORT]])
        const graph = gapGraphOf(model)
        const timed = graph.series.find(line => line.key === TIMED)!

        expect(timed.drawn).toBe(false)
        expect(timed.cap[1]).toBeGreaterThan(18000)
        expect(graph.domainMs[1]).toBeLessThan(2000)
        expect(graph.series.map(line => line.colour)).toEqual(RUN_COLOURS.slice(0, 3))
    })

    it('draws one line per team row in the team colour for a team comparison', () => {
        const model = composeVersus(versusOf('teamAligned'))
        const graph = gapGraphOf(model)
        const rows = model.teams.rows.filter(row => row.lane)

        expect(graph.series.map(line => line.key)).toEqual(rows.map(row => row.teamCapId))
        expect(graph.series.map(line => line.colour)).toEqual(rows.map(row => row.colour))
        expect(graph.series.map(line => line.row?.teamCapId)).toEqual(rows.map(row => row.teamCapId))
        expect(graph.series.filter(line => line.drawn)).toHaveLength(rows.filter(row => !row.reference).length)
    })
})
