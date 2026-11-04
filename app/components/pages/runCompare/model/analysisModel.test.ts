import { describe, expect, it } from 'vitest'
import type { CapCheckpoint, CapComparison, ReplayVideo } from '@/app/utils/api'
import { runCompareFixture } from '@/app/utils/fixtures/runCompareFixtures'
import type { LoadedComparisons } from '../loading/comparisons'
import type { SoloRun } from '../loading/soloRuns'
import { RUN_COLOURS, type MatrixRow } from './analysisModel'
import { composeCompareModel } from './compareModel'
import { gapShade, sectorTable, type SectorView } from './sectorTable'

const SHORT = runCompareFixture('short')
const SEPARATED = runCompareFixture('separated')
const BLUE = runCompareFixture('aligned')
const RUNNER = SHORT.runner.cap_id
const REFERENCE = SHORT.reference.cap_id
const ZONED = 'c3c3c3c3-0000-4000-8000-0000000000c3'
const TIMED = 'd4d4d4d4-0000-4000-8000-0000000000d4'
const BLUE_REFERENCE = 'e5e5e5e5-0000-4000-8000-0000000000e5'
const BLUE_RUNNER = 'f6f6f6f6-0000-4000-8000-0000000000f6'
const PIN_BLUE = `&ref=${BLUE_REFERENCE}`

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

function video(capId: string): ReplayVideo {
    return { source: 'utrecorder', mp4_url: `https://media.test/${capId}.mp4`, view_url: null, fps: 60 }
}

function compose(runs: SoloRun[], comparisons: [string, string, CapComparison | null][], query = '', speedRun: string | null = null, side: number | null = null) {
    const loaded: LoadedComparisons = new Map(comparisons.map(([from, to, comparison]) => [`${from}:${to}`, comparison]))
    return composeCompareModel({
        query: `runs=${runs.map(r => r.capId).join(',')}${query}`,
        runs: new Map(runs.map(r => [r.capId, r])),
        videos: new Map(runs.map(r => [r.capId, video(r.capId)])),
        stageBox: { width: 1920, height: 1080 },
        comparisons: loaded,
        speedRun,
        side,
    })
}

function row(rows: MatrixRow[], key: string): MatrixRow {
    return rows.find(candidate => candidate.key === key)!
}

function values(matrixRow: MatrixRow): (string | null)[] {
    return matrixRow.cells.map(cell => (cell ? `${cell.value}${cell.delta ? ` ${cell.delta.label}` : ''}` : null))
}

function best(matrixRow: MatrixRow): boolean[] {
    return matrixRow.cells.map(cell => cell?.best ?? false)
}

describe('the cumulative model', () => {
    it('draws one line per run against its reference, in its colour, ending at its cap', () => {
        const model = compose([runner(), reference()], [[RUNNER, REFERENCE, SHORT]])
        const { cumulative, runs } = model.analysis

        expect(runs.map(r => r.colour)).toEqual([RUN_COLOURS[0], RUN_COLOURS[1]])
        expect(cumulative.lines.map(line => line.capId)).toEqual([RUNNER])
        const [line] = cumulative.lines
        expect(line.colour).toBe(RUN_COLOURS[0])
        expect(line.segments.flat().length).toBeGreaterThan(10)
        expect(line.cap).toEqual([12342, 512])
        expect(line.dots).toHaveLength(10)
        expect(cumulative.endMs).toBe(12342)
        expect(cumulative.domainMs[0]).toBeLessThan(0)
        expect(cumulative.domainMs[1]).toBeGreaterThan(512)
        expect(cumulative.gridMs).toContain(0)
    })

    it('carries each run\'s separation bands', () => {
        const runs = [run(SEPARATED.runner.cap_id, SEPARATED.runner.cap_time_ms / 1000), run(SEPARATED.reference.cap_id, SEPARATED.reference.cap_time_ms / 1000)]
        const model = compose(runs, [[SEPARATED.runner.cap_id, SEPARATED.reference.cap_id, SEPARATED]], `&ref=${SEPARATED.reference.cap_id}`)
        const [line] = model.analysis.cumulative.lines

        expect(line.bands).toHaveLength(SEPARATED.separations.length)
        expect(line.bands).toEqual(model.lanes.lanes[0].bands)
    })

    it('draws a Zones run as its zone steps and leaves a Time only run to the final time', () => {
        const model = compose([runner(), reference(), zoned(), timed()], [[RUNNER, REFERENCE, SHORT]])
        const { lines, timeOnly } = model.analysis.cumulative

        expect(lines.map(line => line.capId)).toEqual([RUNNER, ZONED])
        expect(lines[1].cap).toEqual([12900, 1070])
        expect(timeOnly).toEqual([TIMED])
    })

    it('draws nothing for a run whose comparison is still being read', () => {
        const model = compose([runner(), reference()], [])

        expect(model.analysis.cumulative.lines).toEqual([])
        expect(model.analysis.runs.map(r => r.rung)).toEqual([null, 'replay'])
    })

    it('analyses one side at a time when the sides mix, against that side\'s own reference', () => {
        const runs = [runner(), reference(), blueRunner(), blueReference()]
        const comparisons: [string, string, CapComparison][] = [[RUNNER, REFERENCE, SHORT], [BLUE_RUNNER, BLUE_REFERENCE, BLUE]]
        const red = compose(runs, comparisons, PIN_BLUE, null, 0)
        const blue = compose(runs, comparisons, PIN_BLUE, null, 1)

        expect(red.race.sides).toMatchObject({ focus: 0, switchable: true })
        expect(red.analysis.cumulative.lines.map(line => [line.capId, line.cap[1]])).toEqual([[RUNNER, 512]])
        expect(red.analysis.runs.map(run => run.capId)).toEqual([RUNNER, REFERENCE])
        expect(blue.race.sides.focus).toBe(1)
        expect(blue.analysis.cumulative.lines.map(line => [line.capId, line.cap[1]])).toEqual([[BLUE_RUNNER, BLUE.runner.cap_time_ms - BLUE.reference.cap_time_ms]])
        expect(blue.analysis.runs.map(run => run.capId)).toEqual([BLUE_RUNNER, BLUE_REFERENCE])
    })

    it('analyses the side with two or more runs when the other side has one', () => {
        const model = compose([blueReference(), runner(), reference()], [[RUNNER, REFERENCE, SHORT]], '', null, 1)

        expect(model.race.sides).toMatchObject({ focus: 0, switchable: false })
        expect(model.analysis.runs.map(run => run.capId)).toEqual([RUNNER, REFERENCE])
    })
})

describe('the sector matrix', () => {
    it('has the reference\'s ten sectors, then the cap', () => {
        const model = compose([runner(), reference()], [[RUNNER, REFERENCE, SHORT]])
        const rows = model.analysis.matrix

        expect(rows.map(r => r.label)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'Cap'])
        expect(rows.slice(0, 10).map(r => r.atMs)).toEqual([0, 1183, 2366, 3549, 4732, 5915, 7098, 8281, 9464, 10647])
        expect(rows[3].cue).toBe(model.cues.sectors[3])
        expect(row(rows, 'cap')).toMatchObject({ kind: 'cap', atMs: 11830, cue: null })
    })

    it('shows each run\'s split and its delta, and the reference\'s own tenths', () => {
        const rows = compose([runner(), reference()], [[RUNNER, REFERENCE, SHORT]]).analysis.matrix

        expect(values(row(rows, 'S1'))).toEqual(['1.500 +0.317', '1.183'])
        expect(values(row(rows, 'S2'))).toEqual(['1.144 −0.039', '1.183'])
        expect(values(row(rows, 'cap'))).toEqual(['00:12.342 +0.512', '00:11.830'])
    })

    it('highlights the best split per sector', () => {
        const rows = compose([runner(), reference()], [[RUNNER, REFERENCE, SHORT]]).analysis.matrix

        expect(best(row(rows, 'S1'))).toEqual([false, true])
        expect(best(row(rows, 'S2'))).toEqual([true, false])
        expect(best(row(rows, 'S5'))).toEqual([true, false])
        expect(best(row(rows, 'cap'))).toEqual([false, false])
    })

    it('highlights nothing when a sector has a single split', () => {
        const rows = compose([reference(), timed()], []).analysis.matrix

        expect(best(row(rows, 'S1'))).toEqual([false, false])
    })

    it('gives Zones and Time only runs no sector split, a Zones run its zone rows and every run its final time', () => {
        const model = compose([runner(), reference(), zoned(), timed()], [[RUNNER, REFERENCE, SHORT]])
        const rows = model.analysis.matrix

        expect(values(row(rows, 'S4'))).toEqual(['1.215 +0.032', '1.183', null, null])
        expect(rows.filter(r => r.kind === 'zone').map(r => r.label)).toEqual(['Door', 'Hall'])
        expect(values(row(rows, 'zone:Door'))).toEqual([null, '00:03.000', null, null])
        expect(values(row(rows, 'zone:Hall'))).toEqual([null, '00:07.000', '00:07.900 +0.900', null])
        expect(row(rows, 'zone:Hall').cue).toBe(model.cues.zones[1])
        expect(values(row(rows, 'cap'))).toEqual(['00:12.342 +0.512', '00:11.830', '00:12.900 +1.070', '00:14.000 +2.170'])
    })

    it('splits the analysed side against its own reference', () => {
        const model = compose([runner(), reference(), blueRunner(), blueReference()], [[RUNNER, REFERENCE, SHORT], [BLUE_RUNNER, BLUE_REFERENCE, BLUE]], PIN_BLUE, null, 1)
        const s1 = row(model.analysis.matrix, 'S1')
        const blueTenth = Math.round(BLUE.reference.cap_time_ms / 10)

        expect(values(s1)).toEqual([
            `${(BLUE.sectors[0].split_ms / 1000).toFixed(3)} ${BLUE.sectors[0].delta_split_ms < 0 ? '−' : '+'}${(Math.abs(BLUE.sectors[0].delta_split_ms) / 1000).toFixed(3)}`,
            (blueTenth / 1000).toFixed(3),
        ])
        expect(best(s1)).toEqual([BLUE.sectors[0].split_ms < blueTenth, BLUE.sectors[0].split_ms > blueTenth])
    })

    it('has nothing to analyse when each side has a single run', () => {
        const model = compose([reference(), blueReference()], [], PIN_BLUE)

        expect(model.analysis.runs.every(run => run.reference)).toBe(true)
        expect(model.analysis.cumulative.lines).toEqual([])
        expect(model.race.sides.switchable).toBe(false)
    })
})

describe('the sector table', () => {
    function tableOf(model: ReturnType<typeof compose>, view: SectorView | null = null) {
        return sectorTable(model.analysis.runs, model.analysis.matrix, view)
    }

    function gaps(table: ReturnType<typeof tableOf>): (string | null)[][] {
        return table.rows.map(r => r.cells.map(cell => cell?.delta?.label ?? null))
    }

    it('has one row per run and one column per sector, with each run\'s gap in the sector', () => {
        const table = tableOf(compose([runner(), reference()], [[RUNNER, REFERENCE, SHORT]]))

        expect(table.view).toBe('sectors')
        expect(table.views).toEqual(['sectors'])
        expect(table.columns.map(column => column.label)).toEqual(['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10'])
        expect(table.rows.map(r => r.run.capId)).toEqual([RUNNER, REFERENCE])
        expect(gaps(table)[0].slice(0, 2)).toEqual(['+0.317', '−0.039'])
        expect(table.rows[0].total).toMatchObject({ value: '00:12.342', delta: { label: '+0.512' } })
        expect(table.cap?.kind).toBe('cap')
    })

    it('gives the baseline no splits, since each of its sectors is a tenth of its run', () => {
        const [, baseline] = tableOf(compose([runner(), reference()], [[RUNNER, REFERENCE, SHORT]])).rows

        expect(baseline.run.reference).toBe(true)
        expect(baseline.sectorMs).toBe(1183)
        expect(baseline.total).toMatchObject({ value: '00:11.830', delta: null })
    })

    it('scales the shading by the largest sector gap', () => {
        const table = tableOf(compose([runner(), reference()], [[RUNNER, REFERENCE, SHORT]]))
        const largest = Math.max(...table.rows[0].cells.map(cell => Math.abs(cell?.delta?.ms ?? 0)))

        expect(table.scaleMs).toBe(largest)
        expect(gapShade(largest, table.scaleMs)).toBe(1)
        expect(gapShade(largest / 2, table.scaleMs)).toBe(0.5)
        expect(gapShade(-largest * 3, table.scaleMs)).toBe(1)
    })

    it('offers Checkpoints beside Sectors when a run only has zone crossings, and notes what each run lacks', () => {
        const model = compose([runner(), reference(), zoned(), timed()], [[RUNNER, REFERENCE, SHORT]])
        const sectors = tableOf(model)
        const zones = tableOf(model, 'zones')

        expect(sectors.views).toEqual(['sectors', 'zones'])
        expect(sectors.rows.map(r => r.note)).toEqual([null, null, 'Checkpoints only', 'Final time only'])
        expect(zones.view).toBe('zones')
        expect(zones.columns.map(column => column.label)).toEqual(['Door', 'Hall'])
        expect(gaps(zones)).toEqual([[null, null], [null, null], [null, '+0.900'], [null, null]])
        expect(zones.rows.map(r => r.note)).toEqual(['Sector times only', null, null, 'Final time only'])
        expect(zones.rows[1].cells.map(cell => cell?.value ?? null)).toEqual(['00:03.000', '00:07.000'])
        expect(zones.rows[1].sectorMs).toBeNull()
    })

    it('opens on Checkpoints when no run has sector times, and falls back from a view that is gone', () => {
        const model = compose([reference(), zoned()], [])

        expect(tableOf(model).views).toEqual(['zones'])
        expect(tableOf(model, 'sectors').view).toBe('zones')
        expect(tableOf(compose([runner(), reference()], [[RUNNER, REFERENCE, SHORT]]), 'zones').view).toBe('sectors')
    })

    it('marks the fastest only when a side has two runs to rank', () => {
        const pair = tableOf(compose([runner(), reference()], [[RUNNER, REFERENCE, SHORT]]))
        const twoRunners = tableOf(compose([runner(), reference(), run('a7a7a7a7-0000-4000-8000-0000000000a7', 12.5)], [[RUNNER, REFERENCE, SHORT], ['a7a7a7a7-0000-4000-8000-0000000000a7', REFERENCE, SHORT]]))

        expect(pair.ranked).toBe(false)
        expect(pair.rows.flatMap(r => r.cells).some(cell => cell?.best)).toBe(false)
        expect(twoRunners.ranked).toBe(true)
        expect(twoRunners.rows.flatMap(r => r.cells).some(cell => cell?.best)).toBe(true)
    })

    it('holds one side, so it leaves the side to the note above it', () => {
        const mixed = tableOf(compose([runner(), reference(), blueRunner(), blueReference()], [[RUNNER, REFERENCE, SHORT], [BLUE_RUNNER, BLUE_REFERENCE, BLUE]], PIN_BLUE, null, 0))

        expect(mixed.rows.map(r => r.sideLabel)).toEqual([null, null])
        expect(mixed.rows.map(r => r.sectorMs !== null)).toEqual([false, true])
        expect(tableOf(compose([runner(), reference()], [[RUNNER, REFERENCE, SHORT]])).rows.map(r => r.sideLabel)).toEqual([null, null])
    })
})

describe('the speed selector', () => {
    it('offers the Replay runs that are not references and defaults to the first, highlighting no tile', () => {
        const model = compose([runner(), reference(), zoned()], [[RUNNER, REFERENCE, SHORT]])
        const { speed } = model.analysis

        expect(speed.options.map(option => option.capId)).toEqual([RUNNER])
        expect(speed.chosen).toBe(RUNNER)
        expect(speed.reference?.capId).toBe(REFERENCE)
        expect(speed.pair).toBe(`${RUNNER}|${REFERENCE}`)
        expect(speed.card?.speed.rows).toHaveLength(10)
        expect(speed.highlighted).toBeNull()
        expect(model.race.tiles.some(tile => tile.highlighted)).toBe(false)
    })

    it('highlights the chosen run\'s tile on the stage', () => {
        const model = compose([runner(), reference()], [[RUNNER, REFERENCE, SHORT]], '', RUNNER)

        expect(model.analysis.speed.highlighted).toBe(RUNNER)
        expect(model.race.tiles.map(tile => [tile.id, tile.highlighted ?? false])).toEqual([[RUNNER, true], [REFERENCE, false]])
        expect(model.race.layout.placed.find(placed => placed.slot.id === RUNNER)?.slot.highlighted).toBe(true)
    })

    it('offers the analysed side\'s runs, measured against that side\'s reference', () => {
        const model = compose([runner(), reference(), blueRunner(), blueReference()], [[RUNNER, REFERENCE, SHORT], [BLUE_RUNNER, BLUE_REFERENCE, BLUE]], PIN_BLUE, BLUE_RUNNER, 1)
        const { speed } = model.analysis

        expect(speed.options.map(option => option.capId)).toEqual([BLUE_RUNNER])
        expect(speed.chosen).toBe(BLUE_RUNNER)
        expect(speed.reference?.capId).toBe(BLUE_REFERENCE)
        expect(speed.highlighted).toBe(BLUE_RUNNER)
    })

    it('falls back to the first run, without a highlight, when the chosen run left the set or has no replay comparison', () => {
        const model = compose([runner(), reference(), zoned()], [[RUNNER, REFERENCE, SHORT]], '', ZONED)

        expect(model.analysis.speed.chosen).toBe(RUNNER)
        expect(model.analysis.speed.highlighted).toBeNull()
        expect(model.race.tiles.some(tile => tile.highlighted)).toBe(false)
    })

    it('is empty without a Replay run', () => {
        const { speed } = compose([reference(), timed()], []).analysis

        expect(speed.options).toEqual([])
        expect(speed.chosen).toBeNull()
        expect(speed.card).toBeNull()
    })
})
