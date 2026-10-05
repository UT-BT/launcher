import { describe, expect, it } from 'vitest'
import { STREAM_MATCH_ID, STREAM_T0, streamMatch } from '../../data/streamFixtures'
import {
    TEAM_A, TEAM_B, bracketHotState, bracketStage, groupHotState, groupStage, largeBracketStage, played, stage, standingsRead,
    standingsFormat, swissHotState, swissStage, upcoming, zoneless,
} from './standingsFixtures'
import {
    bracketFit, groupFit, pointsRule, standingsView, type BracketView, type GroupView, type StandingsView, type SwissView,
} from './standingsView'

const MINUTE = 60_000

function asGroups(view: StandingsView): GroupView {
    if (view.kind !== 'groups') throw new Error(`expected groups, got ${view.kind}`)
    return view
}

function asSwiss(view: StandingsView): SwissView {
    if (view.kind !== 'swiss') throw new Error(`expected swiss, got ${view.kind}`)
    return view
}

function asBracket(view: StandingsView): BracketView {
    if (view.kind !== 'bracket') throw new Error(`expected bracket, got ${view.kind}`)
    return view
}

const groupView = () => asGroups(standingsView({
    read: standingsRead(groupStage(), { group_id: 'group-b' }),
    match: groupHotState().match!,
    now: STREAM_T0,
}))

describe('standingsView for a group stage', () => {
    it('shows the match group as a table with the header of the mockup', () => {
        const view = groupView()

        expect(view.title).toBe('Standings')
        expect(view.kicker).toBe('Group B · after round 4 so far')
        expect(view.group.name).toBe('Group B')
        expect(view.group.pointsRule).toBe('3 pts win · 1 pt draw')
        expect(view.group.showDraws).toBe(true)
        expect(view.group.rows.map(row => row.name)).toEqual([
            'Warp Rabbits', TEAM_A.name, TEAM_B.name, 'Ledge Lords', 'Burrow Gang', 'Flagrunners',
        ])
        expect(view.group.rows[1]).toMatchObject({
            rank: 2, seed: 2, played: 3, wins: 2, draws: 1, losses: 0, maps: '8–3', caps: '+9', points: 7,
        })
        expect(view.group.rows[5].caps).toBe('−19')
    })

    it('lists the other group matches on the same UTC day, played ones with their score', () => {
        const view = groupView()

        expect(view.thisMatch).toEqual({ a: TEAM_A.name, b: TEAM_B.name, time: '20:00 UTC · in 1h 20m' })
        expect(view.alsoToday).toEqual([
            { id: 'g-2', a: 'Warp Rabbits', b: 'Ledge Lords', score: { a: 3, b: 1 }, time: '16:00 UTC · 2h 40m ago' },
            { id: 'g-4', a: 'Burrow Gang', b: 'Flagrunners', score: null, time: '22:00 UTC · in 3h 20m' },
        ])
    })

    it('falls back to the group holding team A when the read names no group', () => {
        const view = asGroups(standingsView({ read: standingsRead(groupStage()), match: groupHotState().match!, now: STREAM_T0 }))

        expect(view.group.name).toBe('Group B')
    })

    it('hides the draw column when no points row is a draw', () => {
        const payload = groupStage()
        payload.config = { ...(payload.config as object), points: [{ maps_won: 2, maps_lost: 0, points: 3 }, { maps_won: 2, maps_lost: 1, points: 2 }] } as typeof payload.config
        payload.groups = payload.groups.map(group => ({ ...group, standings: group.standings.map(row => ({ ...row, draws: 0 })) }))
        const view = asGroups(standingsView({ read: standingsRead(payload, { group_id: 'group-b' }), match: groupHotState().match!, now: STREAM_T0 }))

        expect(view.group.showDraws).toBe(false)
        expect(view.group.pointsRule).toBe('3 pts 2–0 · 2 pts 2–1')
    })

    it('keeps the draw column when a row has a draw, even without a points table', () => {
        const payload = groupStage()
        payload.config = null
        const view = asGroups(standingsView({ read: standingsRead(payload, { group_id: 'group-b' }), match: groupHotState().match!, now: STREAM_T0 }))

        expect(view.group.showDraws).toBe(true)
        expect(view.group.pointsRule).toBeNull()
    })

    it('says an other group match is live instead of its scheduled time', () => {
        const payload = groupStage()
        payload.matches = payload.matches.map(entry => entry.id === 'g-4' ? { ...entry, status: 'live' } : entry)
        const view = asGroups(standingsView({ read: standingsRead(payload, { group_id: 'group-b' }), match: groupHotState().match!, now: STREAM_T0 }))

        expect(view.alsoToday.find(line => line.id === 'g-4')?.time).toBe('Live')
    })

    it('says nothing has been played before the first result', () => {
        const payload = groupStage()
        payload.matches = payload.matches.filter(match => match.status !== 'complete')
        const view = asGroups(standingsView({ read: standingsRead(payload, { group_id: 'group-b' }), match: groupHotState().match!, now: STREAM_T0 }))

        expect(view.kicker).toBe('Group B · before round 4')
    })
})

describe('where the group teams go', () => {
    const withFormat = () => asGroups(standingsView({
        read: standingsRead(groupStage(), { group_id: 'group-b' }),
        match: groupHotState().match!,
        now: STREAM_T0,
        format: standingsFormat(),
    }))

    it('names each rank band and its next stage from the format', () => {
        expect(withFormat().zones).toEqual([
            { label: '1st–2nd · Final Stage', zone: 'top' },
            { label: '3rd–6th · Playoff Stage', zone: 'next' },
        ])
    })

    it('marks each row with its band', () => {
        expect(withFormat().group.rows.map(row => row.zone)).toEqual(['top', 'top', 'next', 'next', 'next', 'next'])
    })

    it('prefers the rule label and shows a single rank alone', () => {
        const format = standingsFormat()
        format.stages[0].advancement = [{ to_stage: 'final', label: 'Grand final', from_rank: 1, to_rank: 1 }]
        const view = asGroups(standingsView({ read: standingsRead(groupStage(), { group_id: 'group-b' }), match: groupHotState().match!, now: STREAM_T0, format }))

        expect(view.zones).toEqual([{ label: '1st · Grand final', zone: 'top' }])
        expect(view.group.rows.map(row => row.zone)).toEqual(['top', null, null, null, null, null])
    })

    it('shows no bands without the format', () => {
        const view = groupView()

        expect(view.zones).toEqual([])
        expect(view.group.rows.every(row => row.zone === null)).toBe(true)
    })
})

describe('pointsRule', () => {
    it('is null without a points table', () => {
        expect(pointsRule([])).toBeNull()
    })

    it('reads every level scoreline as one draw when they all pay the same', () => {
        const table = [
            { maps_won: 3, maps_lost: 0, points: 3 },
            { maps_won: 2, maps_lost: 0, points: 3 },
            { maps_won: 1, maps_lost: 0, points: 3 },
            { maps_won: 2, maps_lost: 2, points: 1 },
            { maps_won: 1, maps_lost: 1, points: 1 },
            { maps_won: 0, maps_lost: 0, points: 1 },
            { maps_won: 0, maps_lost: 2, points: 0 },
        ]

        expect(pointsRule(table)).toBe('3 pts win · 1 pt draw')
    })

    it('spells out each level scoreline when they pay differently', () => {
        const table = [
            { maps_won: 2, maps_lost: 0, points: 3 },
            { maps_won: 2, maps_lost: 2, points: 2 },
            { maps_won: 0, maps_lost: 0, points: 1 },
            { maps_won: 0, maps_lost: 2, points: 0 },
        ]

        expect(pointsRule(table)).toBe('3 pts win · 2 pts 2–2 draw · 1 pt 0–0 draw')
    })
})

describe('groupFit', () => {
    it('uses the mockup row height for a group of six', () => {
        expect(groupFit(6)).toEqual({ rowHeight: 100, fontSize: 36, scale: 1 })
    })

    it('shrinks rows for a bigger group and still fits', () => {
        const fit = groupFit(12)

        expect(fit.rowHeight).toBeLessThan(100)
        expect(fit.rowHeight * 12).toBeLessThanOrEqual(670)
        expect(fit.scale).toBe(1)
    })

    it('scales the table down once rows reach their minimum height', () => {
        const fit = groupFit(24)

        expect(fit.rowHeight).toBe(44)
        expect(fit.scale).toBeLessThan(1)
        expect(fit.rowHeight * 24 * fit.scale).toBeLessThanOrEqual(670)
    })
})

describe('the highlight', () => {
    it('marks both teams in their stream A/B tones and nobody else', () => {
        const view = groupView()

        expect(view.group.rows.map(row => row.side)).toEqual([null, 'a', 'b', null, null, null])
    })

    it('follows the stream sides, not the bracket slots', () => {
        const view = asGroups(standingsView({
            read: standingsRead(groupStage(), { group_id: 'group-b', team_ids: { a: TEAM_B.id, b: TEAM_A.id } }),
            match: groupHotState().match!,
            now: STREAM_T0,
        }))

        expect(view.group.rows.find(row => row.name === TEAM_B.name)?.side).toBe('a')
        expect(view.group.rows.find(row => row.name === TEAM_A.name)?.side).toBe('b')
    })

    it('marks the teams inside the Swiss chips and the bracket boxes', () => {
        const swiss = asSwiss(standingsView({ read: standingsRead(swissStage()), match: swissHotState().match!, now: STREAM_T0 }))
        const bracket = asBracket(standingsView({ read: standingsRead(bracketStage()), match: bracketHotState().match!, now: STREAM_T0 }))

        expect(swiss.centre?.pairings[0]).toMatchObject({ a: { name: TEAM_A.name, side: 'a' }, b: { name: TEAM_B.name, side: 'b' } })
        const opening = bracket.rounds[0].boxes.find(box => box.id === 'r1-2')
        expect(opening?.highlight).toBe(true)
        expect(opening?.lines[0]).toMatchObject({ name: TEAM_B.name, side: 'b' })
        expect(bracket.rounds[0].boxes.find(box => box.id === 'r1-1')?.highlight).toBe(false)
    })
})

describe('standingsView for a Swiss stage', () => {
    const view = () => asSwiss(standingsView({ read: standingsRead(swissStage()), match: swissHotState().match!, now: STREAM_T0 }))

    it('puts qualified teams left, the match record in the centre and eliminated teams right', () => {
        const swiss = view()

        expect(swiss.title).toBe('Standings')
        expect(swiss.kicker).toBe('Playoff Stage · Swiss')
        expect(swiss.left).toEqual([{ key: 'qualified', record: '2–0', label: 'Qualified', tone: 'gold', teams: [
            { id: 'team-moonhoppers', name: 'Moonhoppers', side: null },
            { id: 'team-strafe-society', name: 'Strafe Society', side: null },
        ] }])
        expect(swiss.right).toEqual([{ key: 'eliminated', record: '0–2', label: 'Eliminated', tone: 'out', teams: [
            { id: 'team-burrow-gang', name: 'Burrow Gang', side: null },
            { id: 'team-flagrunners', name: 'Flagrunners', side: null },
        ] }])
    })

    it('shows the match bucket with its round pairings, the match first', () => {
        const centre = view().centre!

        expect(centre.record).toBe('1–1')
        expect(centre.label).toBe('Decider round')
        expect(centre.line).toBe('Round 3 · winners qualify, losers are out')
        expect(centre.pairings.map(pairing => [pairing.a.name, pairing.b.name, pairing.current])).toEqual([
            [TEAM_A.name, TEAM_B.name, true],
            ['Ledge Lords', 'Quad Damage', false],
        ])
    })

    it('reads each team path from its earlier results', () => {
        expect(view().paths).toEqual([
            { side: 'a', name: TEAM_A.name, steps: ['W 3–1 vs Burrow Gang', 'L 1–3 vs Moonhoppers'] },
            { side: 'b', name: TEAM_B.name, steps: ['L 2–3 vs Strafe Society', 'W 3–0 vs Burrow Gang'] },
        ])
    })

    it('keeps the match bucket once the match is decided', () => {
        const payload = swissStage()
        payload.matches = payload.matches.map(match => (match.id === STREAM_MATCH_ID ? played(TEAM_A.name, TEAM_B.name, [3, 2], { ...match, status: 'complete', score_a: 3, score_b: 2, winner_team_id: TEAM_A.id }) : match))
        payload.entrants = payload.entrants.map(row => {
            if (row.team_id === TEAM_A.id) return { ...row, wins: 2, status: 'qualified' as const }
            if (row.team_id === TEAM_B.id) return { ...row, losses: 2, status: 'eliminated' as const }
            return row
        })
        const swiss = asSwiss(standingsView({ read: standingsRead(payload), match: swissHotState().match!, now: STREAM_T0 }))

        expect(swiss.centre?.record).toBe('1–1')
        expect(swiss.centre?.pairings[0]).toMatchObject({ current: true, score: { a: 3, b: 2 }, winner: 'a' })
        expect(swiss.left[0].teams.map(team => team.name)).not.toContain(TEAM_A.name)
        expect(swiss.right[0].teams.map(team => team.name)).not.toContain(TEAM_B.name)
    })

    it('uses the full chip size for a small stage and a denser one for a big stage', () => {
        expect(view().density).toBe(0)

        const big = swissStage()
        big.entrants = [
            ...big.entrants,
            ...Array.from({ length: 10 }, (_, index) => ({ ...big.entrants[0], team_id: `q-${index}`, team: { id: `q-${index}`, name: `Qualifier ${index}`, seed: null, status: null } })),
        ]
        const dense = asSwiss(standingsView({ read: standingsRead(big), match: swissHotState().match!, now: STREAM_T0 }))

        expect(dense.density).toBeGreaterThan(0)
    })
})

describe('standingsView for an elimination stage', () => {
    const view = () => asBracket(standingsView({ read: standingsRead(bracketStage()), match: bracketHotState().match!, now: STREAM_T0 }))

    it('lays the bracket out by round, leaving byes out', () => {
        const bracket = view()

        expect(bracket.title).toBe('Bracket')
        expect(bracket.kicker).toBe('Final Stage · single elimination')
        expect(bracket.rounds.map(round => [round.label, round.boxes.length])).toEqual([
            ['Opening round', 4], ['Quarter-finals', 4], ['Semi-finals', 2], ['Final', 1],
        ])
        expect(bracket.region).toBe(false)
        expect(bracket.scale).toBe(1)
    })

    it('tags the match, where its winner goes, results and scheduled times', () => {
        const boxes = view().rounds.flatMap(round => round.boxes)
        const tag = (id: string) => boxes.find(box => box.id === id)?.tag

        expect(tag(STREAM_MATCH_ID)).toBe('Live · this match')
        expect(tag('sf-1')).toBe('Winner goes here')
        expect(tag('qf-1')).toBe('Final')
        expect(tag('qf-3')).toBe('21:30 UTC · in 2h 50m')
        expect(tag('final')).toBe('Not scheduled')
        expect(boxes.find(box => box.id === 'sf-1')?.lines[1]).toMatchObject({ name: 'Winner QF2', known: false, score: null })
        expect(boxes.find(box => box.id === 'qf-1')?.lines).toMatchObject([
            { name: 'Warp Rabbits', score: 3, won: true },
            { name: 'Ledge Lords', score: 0, won: false },
        ])
    })

    it('tags an other live match as live instead of its scheduled time', () => {
        const payload = bracketStage()
        payload.matches = payload.matches.map(entry => entry.id === 'qf-3' ? { ...entry, status: 'live' } : entry)
        const boxes = asBracket(standingsView({ read: standingsRead(payload), match: bracketHotState().match!, now: STREAM_T0 })).rounds.flatMap(round => round.boxes)

        expect(boxes.find(box => box.id === 'qf-3')?.tag).toBe('Live')
    })

    it('says how both teams got here, and the match format', () => {
        expect(view().footer).toBe(`${TEAM_A.name} came in with a bye · ${TEAM_B.name} won in the Opening round · Bo5 · first to 3`)
    })
})

describe('zone-less timestamps', () => {
    it('read as UTC', () => {
        const payload = bracketStage()
        payload.matches = payload.matches.map(match => (match.id === 'qf-4' ? { ...match, scheduled_at: '2026-09-30 01:30:00' } : match))
        const boxes = asBracket(standingsView({ read: standingsRead(payload), match: bracketHotState().match!, now: STREAM_T0 }))
            .rounds.flatMap(round => round.boxes)

        expect(boxes.find(box => box.id === 'qf-4')?.tag).toBe('Wed 30 Sep, 01:30 UTC · in 6h 50m')
    })

    it('put a group match on its UTC day', () => {
        const payload = groupStage()
        payload.matches = [
            ...payload.matches,
            upcoming('Ledge Lords', 'Flagrunners', null, { id: 'late', group_id: 'group-b', round_no: 5, scheduled_at: '2026-09-29 23:59:00' }),
            upcoming('Ledge Lords', 'Burrow Gang', null, { id: 'tomorrow', group_id: 'group-b', round_no: 5, scheduled_at: '2026-09-30 00:01:00' }),
        ]
        const view = asGroups(standingsView({ read: standingsRead(payload, { group_id: 'group-b' }), match: groupHotState().match!, now: STREAM_T0 }))

        expect(view.alsoToday.map(entry => entry.id)).toEqual(['g-2', 'g-4', 'late'])
        expect(view.alsoToday[2].time).toBe('23:59 UTC · in 5h 19m')
    })

    it('are the fixture format the read uses', () => {
        expect(zoneless(STREAM_T0 + 30 * MINUTE)).toBe('2026-09-29 19:10:00')
    })
})

describe('bracketFit', () => {
    it('fits the mockup bracket at full size', () => {
        expect(bracketFit([4, 4, 2, 1])).toBe(1)
    })

    it('scales a bracket that is a little too tall', () => {
        const scale = bracketFit([6, 4, 2, 1])

        expect(scale).toBeLessThan(1)
        expect(scale).toBeGreaterThanOrEqual(0.7)
    })

    it('would shrink a sixteen-team bracket below a readable size', () => {
        expect(bracketFit([8, 4, 2, 1])).toBeLessThan(0.7)
    })
})

describe('the fit decision for a large bracket', () => {
    const view = () => asBracket(standingsView({ read: standingsRead(largeBracketStage()), match: bracketHotState().match!, now: STREAM_T0 }))

    it('shows the teams region of the bracket at full size', () => {
        const bracket = view()

        expect(bracket.region).toBe(true)
        expect(bracket.scale).toBe(1)
        expect(bracket.rounds.map(round => [round.label, round.boxes.map(box => box.id)])).toEqual([
            ['Round of 16', ['r1-5', 'r1-6', 'r1-7', 'r1-8']],
            ['Quarter-finals', ['r2-3', STREAM_MATCH_ID]],
            ['Semi-finals', ['r3-2']],
            ['Final', ['r4-1']],
        ])
        expect(bracket.footer.endsWith('Their half of the bracket')).toBe(true)
    })

    it('keeps the whole bracket when the match is not in the stage', () => {
        const payload = largeBracketStage()
        const bracket = asBracket(standingsView({
            read: standingsRead(payload, { match_id: 'elsewhere' }),
            match: streamMatch({ id: 'elsewhere' }),
            now: STREAM_T0,
        }))

        expect(bracket.region).toBe(false)
        expect(bracket.rounds[0].boxes).toHaveLength(8)
        expect(bracket.scale).toBeLessThan(0.7)
    })
})

describe('an undrawn stage', () => {
    it('shows a notice instead of an empty layout', () => {
        const view = standingsView({
            read: standingsRead(stage({ kind: 'single_elim', name: 'Final Stage' })),
            match: bracketHotState().match!,
            now: STREAM_T0,
        })

        expect(view).toEqual({ kind: 'empty', title: 'Bracket', kicker: 'Final Stage · single elimination', message: 'This stage has not been drawn yet.' })
    })
})
