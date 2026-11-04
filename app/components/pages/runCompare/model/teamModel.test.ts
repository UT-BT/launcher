import { describe, expect, it } from 'vitest'
import { composeCompareModel } from './compareModel'
import { liveDelta } from './laneModel'
import { tileOverlays } from './overlayModel'
import { GRAPH_ONLY } from './raceModel'
import { packTeamRows, TEAM_COLOURS, TEAM_HEADER_HEIGHT, TEAM_HEADER_WIDTH, teamVideoOrder } from './teamModel'
import { composeTeams as compose, INDUSTRY, testId as id, testMember as member, testSolo as solo, testTeam as team } from './teamTestRuns'

const A = INDUSTRY.teamCapId
const [GIORGIO, KRAD, PATRIK] = INDUSTRY.members.map(run => run.capId)

describe('team cap ids as team runs', () => {
    it('expands a team run into its members in finish order, one clock group per team run', () => {
        const model = compose(`runs=${A}`, [INDUSTRY])

        expect(model.loading).toBe(false)
        expect(model.query).toBe(`runs=${A}`)
        expect(model.noticeLine).toBeNull()
        expect(model.runs.map(run => run.alias)).toEqual(['GiorgiO.pX5', '<Krad.pX4', 'PatriK.pX3'])
        expect(model.race.runs.map(run => run.group)).toEqual([A, A, A])
        expect(model.race.tiles.map(tile => tile.id)).toEqual([GIORGIO, KRAD, PATRIK])
        expect(model.teams.rows.map(row => row.teamCapId)).toEqual([A])
    })

    it('reads the team members from the team cap detail, with sides, ghosts and first zone crossings', () => {
        const [giorgio, krad, patrik] = INDUSTRY.members
        expect(INDUSTRY.timeSeconds).toBe(67.116)
        expect(giorgio).toMatchObject({ side: 0, hasGhost: true, timeSeconds: 65.453 })
        expect(giorgio.checkpoints.map(checkpoint => checkpoint.zone)).toEqual(['Gate', 'Crane', 'Furnace', 'Flag'])
        expect(krad).toMatchObject({ hasGhost: false })
        expect(patrik.checkpoints).toEqual([])
    })

    it('waits for the team read of an id the cap read did not find', () => {
        const model = composeCompareModel({ query: `runs=${A}`, runs: new Map([[A, null]]), teams: new Map() })
        expect(model.loading).toBe(true)
    })

    it('drops team runs past four, with the notice', () => {
        const teams = [INDUSTRY, team(1, 70), team(2, 71), team(3, 72), team(4, 73)]
        const model = compose(`runs=${teams.map(entry => entry.teamCapId).join(',')}`, teams)

        expect(model.teams.rows).toHaveLength(4)
        expect(model.noticeLine).toBe('Dropped 1 run past the limit of 4 team runs.')
        expect(model.query).not.toContain(teams[4].teamCapId)
    })

    it('keeps the kind of the first valid run and drops a cap in a team set, and a team run in a solo set', () => {
        const cap = id(50, 'aa')
        const inTeam = composeCompareModel({
            query: `runs=${A},${cap}`,
            runs: new Map([[A, null], [cap, solo(cap)]]),
            teams: new Map([[A, INDUSTRY]]),
        })
        expect(inTeam.teams.rows.map(row => row.teamCapId)).toEqual([A])
        expect(inTeam.noticeLine).toBe('Dropped 1 solo run in a team comparison.')

        const inSolo = composeCompareModel({
            query: `runs=${cap},${A}`,
            runs: new Map([[cap, solo(cap)], [A, null]]),
            teams: new Map([[A, INDUSTRY]]),
        })
        expect(inSolo.teams.rows).toEqual([])
        expect(inSolo.runs.map(run => run.capId)).toEqual([cap])
        expect(inSolo.noticeLine).toBe('Dropped 1 team run in a solo comparison.')
    })

    it('drops a disallowed team run, one on another map and an unknown id', () => {
        const unknown = id(60, 'ab')
        const teams = [team(1, 70, { disallowed: true }), INDUSTRY, team(2, 71, { map: 'CTF-BT-Other' })]
        const model = compose(`runs=${teams.map(entry => entry.teamCapId).join(',')},${unknown}`, teams)

        expect(model.teams.rows.map(row => row.teamCapId)).toEqual([A])
        expect(model.noticeLine).toBe('Dropped 1 disallowed run, 1 run on another map and 1 run that could not be loaded.')
    })

    it('calls a disallowed run disallowed when no run of either kind is valid', () => {
        const disallowedTeam = team(1, 70, { disallowed: true })
        const disallowedCap = id(55, 'ac')
        const model = composeCompareModel({
            query: `runs=${disallowedTeam.teamCapId},${disallowedCap}`,
            runs: new Map([[disallowedTeam.teamCapId, null], [disallowedCap, { ...solo(disallowedCap), disallowed: true }]]),
            teams: new Map([[disallowedTeam.teamCapId, disallowedTeam]]),
        })

        expect(model.runs).toEqual([])
        expect(model.noticeLine).toBe('Dropped 2 disallowed runs.')
    })

    it('keeps data-only and offset entries that name members, and drops those outside the set', () => {
        const outsider = id(70, 'ad')
        const model = compose(`runs=${A}&data=${KRAD},${outsider}&off=${PATRIK}:120`, [INDUSTRY])

        expect(model.query).toBe(`runs=${A}&data=${KRAD}&off=${PATRIK}:120`)
        expect(model.noticeLine).toBe('Dropped 1 data-only entry outside the comparison.')
    })

    it('reads member videos, the visible POVs first, and skips ids already known not to be caps', () => {
        const other = team(1, 70)
        const pending = id(80, 'af')
        const query = `runs=${A},${other.teamCapId},${pending}&data=${GIORGIO}`
        const order = teamVideoOrder(query, new Map([[A, null], [other.teamCapId, null]]), new Map([[A, INDUSTRY], [other.teamCapId, other]]))

        expect(order).toEqual([KRAD, PATRIK, ...other.members.map(run => run.capId), pending, GIORGIO])
    })
})

describe('team rows, colours and role indices', () => {
    it('packs one row per team run, members in columns, with a header on the left of each row', () => {
        const other = team(1, 70)
        const model = compose(`runs=${A},${other.teamCapId}`, [INDUSTRY, other], { stageBox: { width: 1800, height: 650 } })
        const rects = new Map(model.race.layout.placed.map(placed => [placed.slot.id, placed.rect]))
        const [first, second] = model.teams.rows
        const giorgio = rects.get(GIORGIO)!

        expect(model.teams.transposed).toBe(false)
        expect(model.race.layout.columns).toBe(3)
        expect(model.race.layout.rows).toBe(2)
        expect(new Set([GIORGIO, KRAD, PATRIK].map(capId => rects.get(capId)!.y)).size).toBe(1)
        expect(rects.get(other.members[0].capId)!.y).toBeGreaterThan(giorgio.y)
        expect(rects.get(other.members[0].capId)!.x).toBe(giorgio.x)
        expect(first.header).toEqual({ x: giorgio.x - 4 - TEAM_HEADER_WIDTH, y: giorgio.y, width: TEAM_HEADER_WIDTH, height: giorgio.height })
        expect(second.header).toMatchObject({ x: first.header!.x, y: rects.get(other.members[0].capId)!.y })
    })

    it('gives each team run its own colour, on its tiles with the member index', () => {
        const other = team(1, 70)
        const model = compose(`runs=${A},${other.teamCapId}`, [INDUSTRY, other])
        const overlays = tileOverlays(model)

        expect(model.teams.rows.map(row => row.colour)).toEqual([TEAM_COLOURS[0], TEAM_COLOURS[1]])
        expect([GIORGIO, KRAD, PATRIK].map(capId => overlays.get(capId)?.teamColour)).toEqual([TEAM_COLOURS[0], TEAM_COLOURS[0], TEAM_COLOURS[0]])
        expect([GIORGIO, KRAD, PATRIK].map(capId => overlays.get(capId)?.teamIndex)).toEqual([1, 2, 3])
        expect(overlays.get(other.members[1].capId)).toMatchObject({ teamColour: TEAM_COLOURS[1], teamIndex: 2 })
    })

    it('labels each row with the member aliases joined by " & " and the team time', () => {
        const model = compose(`runs=${A}`, [INDUSTRY])
        expect(model.teams.rows[0]).toMatchObject({ label: 'GiorgiO.pX5 & <Krad.pX4 & PatriK.pX3', time: '01:07.116' })
    })

    it('packs no row header outside the grid, and none for a team run without a tile', () => {
        const other = team(1, 70)
        const model = compose(`runs=${A},${other.teamCapId}&data=${other.members.map(run => run.capId).join(',')}`, [INDUSTRY, other])
        expect(model.teams.rows.map(row => row.header !== null)).toEqual([true, false])

        const phone = compose(`runs=${A}`, [INDUSTRY], { environment: { touch: true, width: 390, height: 844 } })
        expect(phone.teams.rows[0].header).toBeNull()
        expect(phone.race.view.mode).toBe('single')
    })

    it('packs nothing into an unmeasured stage', () => {
        expect(packTeamRows([[{ kind: 'video', id: 'a' }]], { width: 0, height: 0 }).layout.placed).toEqual([])
    })

    it('centres the rows with their header column beside them', () => {
        const slot = (id: string) => ({ kind: 'video', id })
        const box = { width: 1800, height: 650 }
        const packed = packTeamRows([[slot('a'), slot('b')], [slot('c'), slot('d')]], box, 4)
        const [a, b] = packed.layout.placed.map(placed => placed.rect)
        const header = packed.headers[0]
        const gridWidth = TEAM_HEADER_WIDTH + 4 + 2 * a.width + 4

        expect(packed.transposed).toBe(false)
        expect(header.x).toBeCloseTo((box.width - gridWidth) / 2, 6)
        expect(a.x).toBeCloseTo(header.x + TEAM_HEADER_WIDTH + 4, 6)
        expect(b.x).toBeCloseTo(a.x + a.width + 4, 6)
        expect(header.height).toBe(a.height)
        expect(a.height).toBeCloseTo(a.width / (16 / 9), 6)
        expect(2 * a.height + 4).toBeLessThanOrEqual(box.height + 1e-6)
    })

    it('puts a header band above each team column when the grid transposes', () => {
        const slot = (id: string) => ({ kind: 'video', id })
        const packed = packTeamRows([[slot('a'), slot('b')], [slot('c'), slot('d')], [slot('e'), slot('f')], [slot('g'), slot('h')]], { width: 1920, height: 1080 })
        const rects = new Map(packed.layout.placed.map(placed => [placed.slot.id, placed.rect]))

        expect(packed.transposed).toBe(true)
        expect(packed.headers[1]).toEqual({ x: rects.get('c')!.x, y: rects.get('c')!.y - TEAM_HEADER_HEIGHT - 4, width: rects.get('c')!.width, height: TEAM_HEADER_HEIGHT })
        expect(rects.get('d')!.x).toBe(rects.get('c')!.x)
    })

    it('makes the whole team run the unit a tile removes and pins', () => {
        const single = tileOverlays(compose(`runs=${A}`, [INDUSTRY]))
        expect(single.get(GIORGIO)?.removable).toBe(false)

        const other = team(1, 70)
        const pinned = tileOverlays(compose(`runs=${A},${other.teamCapId}&ref=${other.teamCapId}`, [INDUSTRY, other]))
        expect(pinned.get(GIORGIO)).toMatchObject({ removable: true, pinned: false })
        expect(pinned.get(other.members[0].capId)?.pinned).toBe(true)
    })
})

describe('one team run alone', () => {
    it('marks each member\'s own zone crossings and cap on its lane', () => {
        const model = compose(`runs=${A}`, [INDUSTRY])
        const marks = new Map(model.lanes.lanes.map(lane => [lane.capId, lane.marks]))

        expect(marks.get(GIORGIO)).toEqual([
            { kind: 'zone', label: 'Gate', atMs: 9871 },
            { kind: 'zone', label: 'Crane', atMs: 27402 },
            { kind: 'zone', label: 'Furnace', atMs: 44118 },
            { kind: 'cap', label: 'CAP', atMs: 65453 },
        ])
        expect(marks.get(KRAD)?.[0]).toEqual({ kind: 'zone', label: 'Gate', atMs: 10402 })
        expect(marks.get(PATRIK)).toEqual([{ kind: 'cap', label: 'CAP', atMs: 67116 }])
    })

    it('draws no member-vs-member delta, and reads no comparison', () => {
        const model = compose(`runs=${A}`, [INDUSTRY])

        expect(model.lanes.requests).toEqual([])
        model.lanes.lanes.forEach(lane => {
            expect(lane.curves).toEqual([])
            expect(lane.splits).toEqual([])
            expect(lane.reference).toBe(false)
            expect([0, 30, 66, 80].map(seconds => liveDelta(lane, seconds))).toEqual([null, null, null, null])
        })
        expect(model.race.runs.map(run => run.result)).toEqual(['CAP 01:05.453', 'CAP 01:06.157', 'CAP 01:07.116'])
        expect(model.analysis.runs).toEqual([])
    })

    it('notes on each member only what its own data lacks', () => {
        const model = compose(`runs=${A}`, [INDUSTRY])
        expect(model.lanes.lanes.map(lane => lane.badges)).toEqual([[], ['Checkpoints only'], []])
    })

    it('tags members with their side only when the team runs mix sides', () => {
        expect(compose(`runs=${A}`, [INDUSTRY]).lanes.lanes.map(lane => lane.sideLabel)).toEqual([null, null, null])
        const mixed = { ...INDUSTRY, members: INDUSTRY.members.map((run, i) => (i === 2 ? { ...run, side: 1 } : run)) }
        expect(compose(`runs=${A}`, [mixed]).lanes.lanes.map(lane => lane.sideLabel)).toEqual(['Red', 'Red', 'Blue'])
    })

    it('cues the team as a unit to its own first crossing of each zone', () => {
        const model = compose(`runs=${A}`, [INDUSTRY])

        expect(model.cues.points.map(point => [point.label, point.atMs])).toEqual([['Gate', 9871], ['Crane', 27402], ['Furnace', 44118], ['Flag', 65453]])
        expect([...model.cues.points[0].runTimesMs]).toEqual([[A, 9871]])
        expect(model.cues.sectors).toEqual([])
    })

    it('leaves the cues of two team runs to their team splits', () => {
        const other = team(1, 70)
        const model = compose(`runs=${A},${other.teamCapId}`, [INDUSTRY, other])

        expect(model.cues.points).toEqual([])
    })
})

describe('team limits, hidden POVs and the team reference', () => {
    it('hides a member POV listed in data, keeping its lane', () => {
        const model = compose(`runs=${A}&data=${KRAD}`, [INDUSTRY])

        expect(model.race.tiles.map(tile => tile.id)).toEqual([GIORGIO, PATRIK])
        expect(model.race.dataOnly.map(run => run.run.capId)).toEqual([KRAD])
        expect(model.lanes.lanes.find(lane => lane.capId === KRAD)?.badges).toEqual(['Checkpoints only', GRAPH_ONLY])
    })

    it('plays at most eight POVs and keeps the rest as data-only lanes', () => {
        const teams = [INDUSTRY, { ...team(1, 70), members: [member(1, 1, 68), member(1, 2, 69), member(1, 3, 70)] }, { ...team(2, 71), members: [member(2, 1, 69), member(2, 2, 70), member(2, 3, 71)] }]
        const model = compose(`runs=${teams.map(entry => entry.teamCapId).join(',')}`, teams)

        expect(model.race.tiles).toHaveLength(8)
        expect(model.race.dataOnly.map(run => run.run.capId)).toEqual([teams[2].members[2].capId])
        expect(model.lanes.lanes).toHaveLength(9)
    })

    it('takes the fastest team run as the reference, or the pinned one', () => {
        const slower = team(1, 70)
        const faster = team(2, 60)
        const teams = [slower, INDUSTRY, faster]
        const runs = teams.map(entry => entry.teamCapId).join(',')

        expect(compose(`runs=${runs}`, teams).teams.reference).toBe(faster.teamCapId)
        const pinned = compose(`runs=${runs}&ref=${slower.teamCapId}`, teams)
        expect(pinned.teams.reference).toBe(slower.teamCapId)
        expect(pinned.teams.rows.map(row => [row.reference, row.pinned])).toEqual([[true, true], [false, false], [false, false]])
    })

    it('keeps one pinned team reference and drops the others with the notice', () => {
        const other = team(1, 70)
        const model = compose(`runs=${A},${other.teamCapId}&ref=${other.teamCapId},${A}`, [INDUSTRY, other])

        expect(model.query).toBe(`runs=${A},${other.teamCapId}&ref=${other.teamCapId}`)
        expect(model.noticeLine).toBe('Dropped 1 extra team reference.')
    })
})

describe('team labels in the title', () => {
    it('joins member aliases with " & " for one, two and many team runs', () => {
        const two = team(1, 70)
        const three = team(2, 71)
        expect(compose(`runs=${A}`, [INDUSTRY]).title).toBe('GiorgiO.pX5 & <Krad.pX4 & PatriK.pX3 on III-Industry')
        expect(compose(`runs=${two.teamCapId},${A}`, [two, INDUSTRY]).title).toBe('T1M1 & T1M2 vs GiorgiO.pX5 & <Krad.pX4 & PatriK.pX3 on III-Industry')
        expect(compose(`runs=${two.teamCapId},${three.teamCapId},${A}`, [two, three, INDUSTRY]).title).toBe('T1M1 & T1M2, T2M1 & T2M2 and 1 more on III-Industry')
    })
})
