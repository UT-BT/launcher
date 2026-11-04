import { describe, expect, it } from 'vitest'
import { liveDelta, type Lane } from './laneModel'
import { tileOverlays } from './overlayModel'
import { pairRouteNote, pairSummaries } from './teamAnalysisModel'
import { TEAM_HEADER_HEIGHT, TEAM_HEADER_WIDTH } from './teamModel'
import { teamDeltaAt } from './teamVersus'
import { alignedComparisons, composeTeams as compose, composeVersus, testTeam as team, versusOf, WIDE } from './teamTestRuns'
import type { CompareModel } from './compareModel'

const ALIGNED = versusOf('teamAligned')
const MIXED = versusOf('teamMixed')
const OPPOSITE = versusOf('teamOppositeSides')
const THEATER = { width: 1800, height: 650 }

const [GXLS, NETTLEZ] = ALIGNED.reference.members.map(run => run.capId)
const [FIERD, NIGHTWOLF] = ALIGNED.runner.members.map(run => run.capId)
const [BUN, FIERD_2, NAMELESS] = MIXED.reference.members.map(run => run.capId)
const [GIORGIO, KRAD, PATRIK] = MIXED.runner.members.map(run => run.capId)

function rectsOf(model: CompareModel) {
    return new Map(model.race.layout.placed.map(placed => [placed.slot.id, placed.rect]))
}

function laneOf(model: CompareModel, capId: string): Lane {
    return model.lanes.lanes.find(lane => lane.capId === capId)!
}

function rowOf(model: CompareModel, teamCapId: string) {
    return model.teams.rows.find(row => row.teamCapId === teamCapId)!
}

function gapAt(lane: Lane | null, seconds: number): number | null {
    return lane ? liveDelta(lane, seconds)?.gap.ms ?? null : null
}

describe('the pairing grid', () => {
    it('puts each paired member in its reference partner\'s column, whatever its finish order', () => {
        const model = composeVersus(ALIGNED, { stageBox: THEATER })
        const rects = rectsOf(model)

        expect(ALIGNED.runner.members.map(run => run.alias)).toEqual(['fierd_6', 'Nightwolf`'])
        expect(model.race.layout).toMatchObject({ columns: 2, rows: 2 })
        expect(model.teams.transposed).toBe(false)
        expect(rects.get(NIGHTWOLF)!.x).toBe(rects.get(GXLS)!.x)
        expect(rects.get(FIERD)!.x).toBe(rects.get(NETTLEZ)!.x)
        expect(rects.get(GXLS)!.x).toBeLessThan(rects.get(NETTLEZ)!.x)
        expect(rects.get(GXLS)!.y).toBeGreaterThan(rects.get(NIGHTWOLF)!.y)
        const overlays = tileOverlays(model)
        expect([NIGHTWOLF, FIERD, GXLS, NETTLEZ].map(capId => overlays.get(capId)?.teamIndex)).toEqual([1, 2, 1, 2])
    })

    it('puts unpaired members at the row end, and a hidden paired member leaves its column empty', () => {
        const model = composeVersus(MIXED, { stageBox: THEATER })
        const rects = rectsOf(model)

        expect(model.race.layout).toMatchObject({ columns: 3, rows: 2 })
        expect(rects.get(GIORGIO)!.x).toBe(rects.get(BUN)!.x)
        expect(rects.get(KRAD)!.x).toBe(rects.get(FIERD_2)!.x)
        expect(rects.get(PATRIK)!.x).toBe(rects.get(NAMELESS)!.x)
        expect(rects.get(PATRIK)!.x).toBeGreaterThan(rects.get(KRAD)!.x)

        const hidden = composeVersus(MIXED, { stageBox: THEATER }, `${MIXED.query}&data=${KRAD}`)
        const placed = rectsOf(hidden)
        expect(placed.has(KRAD)).toBe(false)
        expect(placed.get(GIORGIO)!.x).toBe(placed.get(BUN)!.x)
        expect(placed.get(PATRIK)!.x).toBe(placed.get(NAMELESS)!.x)
        expect(placed.get(PATRIK)!.x).toBeGreaterThan(placed.get(FIERD_2)!.x)
        expect(tileOverlays(hidden).get(PATRIK)?.teamIndex).toBe(3)
    })

    it('lines members up in finish order until the team read answers', () => {
        const model = composeVersus(ALIGNED, { teamComparisons: new Map(), stageBox: THEATER })
        const rects = rectsOf(model)

        expect(rects.get(FIERD)!.x).toBe(rects.get(GXLS)!.x)
        expect(rects.get(NIGHTWOLF)!.x).toBe(rects.get(NETTLEZ)!.x)
        expect(model.teams.requests).toEqual([{ runner: ALIGNED.runner.teamCapId, reference: ALIGNED.reference.teamCapId }])
    })

    it('keeps a third team run in finish order inside the pair columns while its read is pending or failed', () => {
        const third = team(5, 85)
        const reference = ALIGNED.reference.teamCapId
        const query = `runs=${ALIGNED.runner.teamCapId},${reference},${third.teamCapId}&ref=${reference}`
        const runs = [ALIGNED.runner, ALIGNED.reference, third]
        const read = { teamComparisons: new Map([[ALIGNED.key, ALIGNED.comparison]]), comparisons: alignedComparisons(ALIGNED) }
        const pending = compose(query, runs, read)
        const failed = compose(query, runs, { ...read, teamComparisons: new Map([...read.teamComparisons, [`${third.teamCapId}:${reference}`, null]]) })

        expect(pending.teams.requests).toEqual([
            { runner: ALIGNED.runner.teamCapId, reference },
            { runner: third.teamCapId, reference },
        ])
        for (const model of [pending, failed]) {
            const rects = rectsOf(model)
            const [first, second] = third.members.map(run => rects.get(run.capId)!)
            expect(model.race.layout).toMatchObject({ columns: 3, rows: 2 })
            expect(rects.get(NIGHTWOLF)!.y).toBe(rects.get(GXLS)!.y)
            expect(first.y).toBe(rects.get(GXLS)!.y)
            expect(second.y).toBe(rects.get(NETTLEZ)!.y)
        }
    })

    it('transposes to one column per team run when that gives larger tiles', () => {
        const teams = [team(1, 70), team(2, 71), team(3, 72), team(4, 73)]
        const model = compose(`runs=${teams.map(entry => entry.teamCapId).join(',')}`, teams)
        const rects = rectsOf(model)

        expect(model.teams.transposed).toBe(true)
        expect(model.race.layout).toMatchObject({ columns: 4, rows: 2 })
        teams.forEach((entry, i) => {
            const [first, second] = entry.members.map(run => rects.get(run.capId)!)
            const header = model.teams.rows[i].header!
            expect(second.x).toBe(first.x)
            expect(second.y).toBeGreaterThan(first.y)
            expect(header).toMatchObject({ x: first.x, y: first.y - TEAM_HEADER_HEIGHT - 4, width: first.width, height: TEAM_HEADER_HEIGHT })
        })
        expect(rects.get(teams[1].members[0].capId)!.x).toBeGreaterThan(rects.get(teams[0].members[0].capId)!.x)
        const inRows = Math.min((WIDE.width - TEAM_HEADER_WIDTH - 4 - 4) / 2, ((WIDE.height - 3 * 4) / 4) * (16 / 9))
        expect(model.race.layout.tileWidth).toBeGreaterThan(inRows)
    })

    it('keeps teams in rows when that gives the larger tile, each header in a column on the left of its row', () => {
        const model = composeVersus(ALIGNED, { stageBox: THEATER })
        const rects = rectsOf(model)

        expect(model.teams.transposed).toBe(false)
        model.teams.rows.forEach(row => {
            const first = row.team.members.map(run => rects.get(run.capId)!).sort((a, b) => a.x - b.x)[0]
            expect(row.header).toEqual({ x: first.x - 4 - TEAM_HEADER_WIDTH, y: first.y, width: TEAM_HEADER_WIDTH, height: first.height })
        })
    })

})

describe('deltas against the paired member', () => {
    it('reads the pairwise comparison of an aligned pair for its tile delta, and only for aligned pairs', () => {
        const model = composeVersus(ALIGNED)
        const lane = laneOf(model, NIGHTWOLF)

        expect(model.lanes.requests).toEqual([
            { runner: NIGHTWOLF, reference: GXLS },
            { runner: FIERD, reference: NETTLEZ },
        ])
        expect(lane).toMatchObject({ rung: 'replay', reference: false })
        expect(lane.trace.kind).toBe('strip')
        expect(lane.badges).toEqual([])
        expect(gapAt(lane, 20)).not.toBeNull()
        expect(laneOf(model, GXLS).trace.kind).toBe('none')
        expect(composeVersus(MIXED).lanes.requests).toEqual([])
    })

    it('says on each tile which member its delta is against: its pair partner, or nobody when unpaired', () => {
        const aligned = tileOverlays(composeVersus(ALIGNED))
        expect([NIGHTWOLF, FIERD].map(capId => aligned.get(capId)?.versus?.capId)).toEqual([GXLS, NETTLEZ])

        const mixed = tileOverlays(composeVersus(MIXED))
        expect(mixed.get(GIORGIO)?.versus?.capId).toBe(BUN)
        expect(mixed.get(PATRIK)?.versus).toBeNull()
        expect(mixed.get(GIORGIO)?.reference).toBe(false)
    })

    it('follows a pairing override on the tile', () => {
        const overlays = tileOverlays(composeVersus(ALIGNED, {}, `${ALIGNED.query}&pair=${FIERD}:${GXLS},${NIGHTWOLF}:${NETTLEZ}`))
        expect([FIERD, NIGHTWOLF].map(capId => overlays.get(capId)?.versus?.capId)).toEqual([GXLS, NETTLEZ])
    })

    it('waits for a pending pairwise read, and drops a failed one to the zone delta', () => {
        const pending = laneOf(composeVersus(ALIGNED, { comparisons: new Map() }), NIGHTWOLF)
        expect(pending.rung).toBeNull()
        expect(gapAt(pending, 20)).toBeNull()

        const failed = composeVersus(ALIGNED, { comparisons: new Map([[`${NIGHTWOLF}:${GXLS}`, null]]) })
        const lane = laneOf(failed, NIGHTWOLF)
        expect(lane.rung).toBe('zones')
        expect(gapAt(lane, 20)).toBe(14880 - 15102)
    })

    it('gives a zones pair the zone delta against its partner', () => {
        const lane = laneOf(composeVersus(MIXED), KRAD)

        expect(lane.rung).toBe('zones')
        expect(lane.badges).toEqual(['Checkpoints only'])
        expect(gapAt(lane, 5)).toBe(0)
        expect(gapAt(lane, 11)).toBe(10402 - 9700)
        expect(gapAt(lane, 67)).toBe(66157 - 65990)
    })

    it('shows a pair on different routes as such, with the gap only at the shared anchors and no curve', () => {
        const lane = laneOf(composeVersus(MIXED), GIORGIO)

        expect(lane.badges).toEqual(['Different route', 'Checkpoints only'])
        expect(lane.curves).toEqual([])
        expect(lane.bands).toEqual([])
        expect([5, 10, 30, 50, 66].map(seconds => gapAt(lane, seconds))).toEqual([0, 359, 462, 463, 65453 - 64870])
    })

    it('gives an unpaired member final time only, with no delta', () => {
        const model = composeVersus(MIXED)
        const lane = laneOf(model, PATRIK)

        expect(lane.badges).toEqual(['Final time only'])
        expect([5, 30, 70].map(seconds => gapAt(lane, seconds))).toEqual([null, null, null])
        expect(laneOf(model, NAMELESS).trace.kind).toBe('none')
    })
})

describe('team deltas and team lanes', () => {
    it('draws one transport lane per team run from its team splits, and the row header reads the last passed split', () => {
        const model = composeVersus(MIXED)
        const runner = rowOf(model, MIXED.runner.teamCapId)
        const reference = rowOf(model, MIXED.reference.teamCapId)

        expect(model.teams.rows.map(row => row.lane?.capId)).toEqual([MIXED.runner.teamCapId, MIXED.reference.teamCapId])
        expect(reference.lane!.trace.kind).toBe('flat')
        expect(runner.badges).toEqual([])
        expect([5, 10, 30, 50, 66, 67.2].map(seconds => gapAt(runner.lane, seconds))).toEqual([0, 359, 592, 463, 583, 275])
        expect(runner.lane!.marks).toEqual([
            { kind: 'zone', label: 'Gate', atMs: 9871 },
            { kind: 'zone', label: 'Crane', atMs: 27402 },
            { kind: 'zone', label: 'Furnace', atMs: 44118 },
            { kind: 'zone', label: 'Flag', atMs: 65453 },
            { kind: 'cap', label: 'CAP', atMs: 67116 },
        ])
        expect(runner.lane!.curves.length).toBeGreaterThan(0)
        expect([5, 10, 30, 70].map(t => teamDeltaAt(runner, { t, runTimes: { [PATRIK]: Math.min(t, 67.116) } })?.ms ?? null)).toEqual([null, 359, 592, 275])
        expect(teamDeltaAt(reference, { t: 30, runTimes: {} })).toBeNull()
    })

    it('keeps one team run alone on its member lanes, with no team lane', () => {
        const model = compose(`runs=${MIXED.runner.teamCapId}`, [MIXED.runner])
        expect(model.teams.rows[0].lane).toBeNull()
        expect(model.teams.requests).toEqual([])
    })
})

describe('team-zone cues', () => {
    it('ticks the team splits\' zones and cues each team as a unit to its own team crossing', () => {
        const model = composeVersus(MIXED)

        expect(model.cues.points.map(point => [point.label, point.atMs])).toEqual([['Gate', 9512], ['Crane', 26810], ['Furnace', 43655], ['Flag', 64870]])
        expect([...model.cues.points[1].runTimesMs]).toEqual([[MIXED.reference.teamCapId, 26810], [MIXED.runner.teamCapId, 27402]])
        expect(model.cues.sectors).toEqual([])
        expect(model.cues.references).toEqual([MIXED.reference.teamCapId])
    })

    it('cues no zone until a team read answers', () => {
        expect(composeVersus(MIXED, { teamComparisons: new Map() }).cues.points).toEqual([])
    })
})

describe('the team analysis', () => {
    it('lists the team zone splits first, with each team\'s time, delta and first member across', () => {
        const { splits, teams } = composeVersus(MIXED).teamAnalysis
        const runner = teams.findIndex(row => row.teamCapId === MIXED.runner.teamCapId)
        const reference = teams.findIndex(row => row.teamCapId === MIXED.reference.teamCapId)

        expect(splits.map(row => row.label)).toEqual(['Gate', 'Crane', 'Furnace', 'Flag', 'Cap'])
        const crane = splits[1]
        expect(crane.cells[reference]).toMatchObject({ time: '00:26.810', delta: null })
        expect(crane.cells[reference]?.member?.capId).toBe(FIERD_2)
        expect(crane.cells[runner]).toMatchObject({ time: '00:27.402', delta: { ms: 592 } })
        expect(crane.cells[runner]?.member?.capId).toBe(GIORGIO)
        expect(crane.cue?.key).toBe('zone:Crane')
        const cap = splits[4]
        expect(cap).toMatchObject({ kind: 'cap', cue: null, atMs: 66841 })
        expect(cap.cells[runner]).toMatchObject({ time: '01:07.116', delta: { ms: 275 } })
        expect(cap.cells[runner]?.member?.capId).toBe(PATRIK)
        expect(cap.cells[reference]?.member?.capId).toBe(NAMELESS)
    })

    it('gives each matched pair its own section through the solo analysis, cueing both teams', () => {
        const { pairs } = composeVersus(ALIGNED).teamAnalysis

        expect(pairs.map(pair => [pair.runner.run.capId, pair.reference.run.capId])).toEqual([[NIGHTWOLF, GXLS], [FIERD, NETTLEZ]])
        const [first] = pairs
        expect(first.analysis.runs.map(run => [run.capId, run.reference])).toEqual([[GXLS, true], [NIGHTWOLF, false]])
        expect(first.analysis.cumulative.lines.map(line => line.capId)).toEqual([NIGHTWOLF])
        const sector = first.analysis.matrix.find(row => row.kind === 'sector' && row.cue)!
        expect([...sector.cue!.runTimesMs.keys()]).toEqual([ALIGNED.reference.teamCapId, ALIGNED.runner.teamCapId])
        expect(sector.cue!.key.startsWith('pair:')).toBe(true)
        expect(first.analysis.speed.options.map(option => option.capId)).toEqual([NIGHTWOLF])
    })

    it('gives a zones pair a section on zone deltas, and lists a pair on different routes on its own', () => {
        const { pairs, routes } = composeVersus(MIXED).teamAnalysis

        expect(pairs.map(pair => pair.runner.run.capId)).toEqual([KRAD])
        expect(pairs[0].analysis.runs.find(run => run.capId === KRAD)?.rung).toBe('zones')
        expect(routes).toHaveLength(1)
        const [card] = routes
        expect([card.runner.run.capId, card.reference.run.capId]).toEqual([GIORGIO, BUN])
    })

    it('highlights the tile of the pair run chosen for speed', () => {
        const model = composeVersus(ALIGNED, { speedRun: FIERD })
        expect(model.race.tiles.filter(tile => tile.highlighted).map(tile => tile.id)).toEqual([FIERD])
    })
})

describe('teams set on opposite sides', () => {
    it('leaves every member unpaired, with only the cap split, on final time only', () => {
        const model = composeVersus(OPPOSITE)
        const runner = rowOf(model, OPPOSITE.runner.teamCapId)

        expect(runner.badges).toEqual(['Final time only'])
        expect(runner.lane!.trace.kind).toBe('cap')
        expect([30, 68].map(seconds => gapAt(runner.lane, seconds))).toEqual([null, -1874])
        expect(model.cues.points).toEqual([])
        expect(model.lanes.requests).toEqual([])
        expect(laneOf(model, GIORGIO).badges).toEqual(['Final time only'])
        expect(laneOf(model, GIORGIO).sideLabel).toBe('Red')
        expect(model.teamAnalysis.splits.map(row => row.label)).toEqual(['Cap'])
        expect(model.teamAnalysis.pairs).toEqual([])
        expect(model.teamAnalysis.routes).toEqual([])
    })
})

describe('a failed team read', () => {
    it('drops that team run to final time only, on its row and its members', () => {
        const model = composeVersus(MIXED, { teamComparisons: new Map([[MIXED.key, null]]) })
        const runner = rowOf(model, MIXED.runner.teamCapId)

        expect(runner.badges).toEqual(['Final time only'])
        expect([30, 67.2].map(seconds => gapAt(runner.lane, seconds))).toEqual([null, 275])
        expect(MIXED.runner.members.map(run => laneOf(model, run.capId).badges)).toEqual([['Final time only'], ['Final time only'], ['Final time only']])
        expect(model.lanes.requests).toEqual([])
        expect(model.cues.points).toEqual([])
        expect(model.teamAnalysis.splits.map(row => row.label)).toEqual(['Cap'])
    })

    it('shows no badge on a row whose team read is still pending', () => {
        const model = composeVersus(MIXED, { teamComparisons: new Map() })
        expect(rowOf(model, MIXED.runner.teamCapId).badges).toEqual([])
        expect(laneOf(model, GIORGIO).badges).toEqual([])
    })
})

describe('the member pairs list', () => {
    it('sums up each pair by how much of the run it spent on another line, then the pairs on different routes', () => {
        const aligned = pairSummaries(composeVersus(ALIGNED).teamAnalysis)
        expect(aligned.map(summary => [summary.runner.run.capId, summary.reference.run.capId])).toEqual([[NIGHTWOLF, GXLS], [FIERD, NETTLEZ]])
        expect(aligned.every(summary => summary.route !== 'different' && summary.apartShare >= 0 && summary.apartShare <= 1)).toBe(true)

        const mixed = pairSummaries(composeVersus(MIXED).teamAnalysis)
        expect(mixed.map(summary => [summary.runner.run.capId, summary.route])).toEqual([[KRAD, 'same'], [GIORGIO, 'different']])
        expect(pairRouteNote(mixed[1])).toBe('Different routes')
    })

    it('words the share of the run spent apart', () => {
        const [summary] = pairSummaries(composeVersus(ALIGNED).teamAnalysis)
        expect(pairRouteNote({ ...summary, route: 'apart', apartShare: 0.456 })).toBe('Took another line for 46% of the run')
        expect(pairRouteNote({ ...summary, route: 'same', apartShare: 0.01 })).toBe('Same line')
    })
})
