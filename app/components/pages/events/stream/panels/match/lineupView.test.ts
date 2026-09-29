import { describe, expect, it } from 'vitest'
import type { StreamMatch, StreamMember, StreamTeam } from '../../streamDesk'
import {
    EMPTY_LINEUP,
    buildLineupTeams,
    detectLineup,
    hasLineupBlock,
    isLineupEmpty,
    pickPlayer,
    shouldAutoApply,
    suggestLineup,
    swapSide,
    type LineupSlots,
} from './lineupView'

const A_CAPTAIN = '100000000000000001'
const A_MATE = '100000000000000002'
const A_BENCH = '100000000000000003'
const B_CAPTAIN = '200000000000000001'
const B_MATE = '200000000000000002'
const B_BENCH = '200000000000000003'

function member(id: string, captain = false): StreamMember {
    return { id, display_name: `Player ${id.slice(-1)}`, avatar: `https://example.test/${id}`, title: null, captain }
}

function team(id: string, ids: string[]): StreamTeam {
    return { id, name: `Team ${id}`, match_side: 'a', stage_seed: 1, pre_cup_seed: null, members: ids.map((memberId, index) => member(memberId, index === 0)) }
}

function person(id: string | null) {
    return id ? { id, display_name: `Player ${id.slice(-1)}`, avatar: `https://example.test/${id}` } : null
}

function match(aIds: string[], bIds: string[], lineup: LineupSlots): Pick<StreamMatch, 'teams' | 'lineup'> {
    return {
        teams: { a: team('A', aIds), b: team('B', bIds) },
        lineup: { a1: person(lineup.a1), a2: person(lineup.a2), b1: person(lineup.b1), b2: person(lineup.b2) },
    }
}

const DEFAULTS: LineupSlots = { a1: A_CAPTAIN, a2: A_MATE, b1: B_CAPTAIN, b2: B_MATE }

interface FakeServer {
    name: string
    players: { id: string; is_spectator?: boolean }[]
}

function server(name: string, ...ids: string[]): FakeServer {
    return { name, players: ids.map(id => ({ id })) }
}

describe('suggestLineup', () => {
    it('suggests the two members found per side, keeping players already in the lineup where they sit', () => {
        const suggestion = suggestLineup(DEFAULTS, EMPTY_LINEUP, { a: [A_CAPTAIN, A_BENCH], b: [B_MATE, B_BENCH] })

        expect(suggestion.pairs).toEqual({ a: [A_CAPTAIN, A_BENCH], b: [B_BENCH, B_MATE] })
        expect(suggestion.lineup).toEqual({ a1: A_CAPTAIN, a2: A_BENCH, b1: B_BENCH, b2: B_MATE })
        expect(suggestion.complete).toBe(true)
        expect(suggestion.changes).toBe(true)
    })

    it('keeps a swapped side as it is when the same two players are found', () => {
        const swapped: LineupSlots = { a1: A_MATE, a2: A_CAPTAIN, b1: B_CAPTAIN, b2: B_MATE }

        const suggestion = suggestLineup(swapped, swapped, { a: [A_CAPTAIN, A_MATE], b: [B_CAPTAIN, B_MATE] })

        expect(suggestion.lineup).toEqual(swapped)
        expect(suggestion.changes).toBe(false)
    })

    it('leaves a side it cannot decide as stored, so its defaults carry on', () => {
        const suggestion = suggestLineup(DEFAULTS, EMPTY_LINEUP, { a: [A_MATE, A_BENCH], b: [B_CAPTAIN, B_MATE, B_BENCH] })

        expect(suggestion.pairs.b).toBeNull()
        expect(suggestion.lineup).toEqual({ a1: A_BENCH, a2: A_MATE, b1: null, b2: null })
        expect(suggestion.complete).toBe(false)
        expect(suggestion.changes).toBe(true)
    })

    it('suggests nothing for a side with one member found', () => {
        const suggestion = suggestLineup(DEFAULTS, EMPTY_LINEUP, { a: [A_BENCH], b: [] })

        expect(suggestion.pairs).toEqual({ a: null, b: null })
        expect(suggestion.changes).toBe(false)
    })
})

describe('shouldAutoApply', () => {
    const found = { a: [A_CAPTAIN, A_BENCH], b: [B_CAPTAIN, B_BENCH] }

    it('applies when the lineup is empty and exactly two members per side are found', () => {
        expect(shouldAutoApply(EMPTY_LINEUP, suggestLineup(DEFAULTS, EMPTY_LINEUP, found))).toBe(true)
    })

    it('never applies once any slot is set', () => {
        const stored: LineupSlots = { ...EMPTY_LINEUP, b2: B_MATE }
        const effective: LineupSlots = { ...DEFAULTS, b1: B_CAPTAIN, b2: B_MATE }

        expect(shouldAutoApply(stored, suggestLineup(effective, stored, found))).toBe(false)
    })

    it('never applies with three members found on a side', () => {
        const three = { a: [A_CAPTAIN, A_MATE, A_BENCH], b: [B_CAPTAIN, B_BENCH] }

        expect(shouldAutoApply(EMPTY_LINEUP, suggestLineup(DEFAULTS, EMPTY_LINEUP, three))).toBe(false)
    })

    it('never applies with fewer than two found on a side', () => {
        const one = { a: [A_CAPTAIN, A_BENCH], b: [B_BENCH] }

        expect(shouldAutoApply(EMPTY_LINEUP, suggestLineup(DEFAULTS, EMPTY_LINEUP, one))).toBe(false)
    })

    it('does not write when the players found are already the lineup on screen', () => {
        const same = { a: [A_CAPTAIN, A_MATE], b: [B_CAPTAIN, B_MATE] }

        expect(shouldAutoApply(EMPTY_LINEUP, suggestLineup(DEFAULTS, EMPTY_LINEUP, same))).toBe(false)
    })

    it('waits until the stored lineup is known', () => {
        expect(shouldAutoApply(null, suggestLineup(DEFAULTS, EMPTY_LINEUP, found))).toBe(false)
    })
})

describe('detectLineup', () => {
    it('finds each side\'s roster members in game, in roster order, with the servers they are on', () => {
        const eu = server('EU #1', B_BENCH, A_CAPTAIN, '12345', B_CAPTAIN)
        const us = server('US #1', A_BENCH)
        const lineupMatch = match([A_CAPTAIN, A_MATE, A_BENCH], [B_CAPTAIN, B_MATE, B_BENCH], DEFAULTS)

        const found = detectLineup([eu, us], lineupMatch)

        expect(found.a.map(entry => entry.discordId)).toEqual([A_CAPTAIN, A_BENCH])
        expect(found.a[1].servers).toEqual([us])
        expect(found.b.map(entry => entry.discordId)).toEqual([B_CAPTAIN, B_BENCH])
        expect(found.b[0].servers).toEqual([eu])
    })

    it('finds nobody when a team is missing', () => {
        const lineupMatch = { ...match([A_CAPTAIN, A_MATE], [B_CAPTAIN, B_MATE], DEFAULTS), teams: { a: null, b: null } }

        expect(detectLineup([server('EU #1', A_CAPTAIN)], lineupMatch)).toEqual({ a: [], b: [] })
    })
})

describe('pickPlayer and swapSide', () => {
    it('pins both slots of the side and keeps the other side as stored', () => {
        expect(pickPlayer(DEFAULTS, EMPTY_LINEUP, 'a2', A_BENCH)).toEqual({ a1: A_CAPTAIN, a2: A_BENCH, b1: null, b2: null })
    })

    it('swaps when the chosen player already sits in the other slot', () => {
        expect(pickPlayer(DEFAULTS, EMPTY_LINEUP, 'b1', B_MATE)).toEqual({ a1: null, a2: null, b1: B_MATE, b2: B_CAPTAIN })
    })

    it('swaps team A left and right', () => {
        expect(swapSide(DEFAULTS, EMPTY_LINEUP, 'a')).toEqual({ a1: A_MATE, a2: A_CAPTAIN, b1: null, b2: null })
    })

    it('swaps team B left and right', () => {
        const stored: LineupSlots = { a1: A_MATE, a2: A_CAPTAIN, b1: null, b2: null }
        const effective: LineupSlots = { ...DEFAULTS, a1: A_MATE, a2: A_CAPTAIN }

        expect(swapSide(effective, stored, 'b')).toEqual({ a1: A_MATE, a2: A_CAPTAIN, b1: B_MATE, b2: B_CAPTAIN })
    })

    it('notices a match block that carries no lineup or teams', () => {
        const full = { id: 'm1', ...match([A_CAPTAIN, A_MATE], [B_CAPTAIN, B_MATE], DEFAULTS) } as StreamMatch

        expect(hasLineupBlock(full)).toBe(true)
        expect(hasLineupBlock({ id: 'm1', reason: 'next' } as StreamMatch)).toBe(false)
    })

    it('tells an empty lineup from a set one', () => {
        expect(isLineupEmpty(EMPTY_LINEUP)).toBe(true)
        expect(isLineupEmpty({ ...EMPTY_LINEUP, b1: B_MATE })).toBe(false)
    })
})

describe('buildLineupTeams', () => {
    it('shows a two-player roster\'s default lineup with nothing to choose', () => {
        const teams = buildLineupTeams(match([A_CAPTAIN, A_MATE], [B_CAPTAIN, B_MATE], DEFAULTS), EMPTY_LINEUP, { a: [], b: [] })

        expect(teams.a.choosable).toBe(false)
        expect(teams.a.left?.id).toBe(A_CAPTAIN)
        expect(teams.a.right?.id).toBe(A_MATE)
        expect(teams.a.left?.pinned).toBe(false)
        expect(teams.a.canSwap).toBe(true)
        expect(teams.b.choosable).toBe(false)
        expect(teams.b.right?.id).toBe(B_MATE)
    })

    it('offers the whole roster of a bigger team, marking who sits where and where each was found', () => {
        const eu = server('EU #1', A_BENCH)
        const lineupMatch = match([A_CAPTAIN, A_MATE, A_BENCH], [B_CAPTAIN, B_MATE], { ...DEFAULTS, a2: A_BENCH })
        const found = detectLineup([eu], lineupMatch)

        const teams = buildLineupTeams(lineupMatch, { ...EMPTY_LINEUP, a2: A_BENCH }, found)

        expect(teams.a.choosable).toBe(true)
        expect(teams.a.name).toBe('Team A')
        expect(teams.a.roster.map(entry => [entry.id, entry.slot])).toEqual([[A_CAPTAIN, 'left'], [A_MATE, null], [A_BENCH, 'right']])
        expect(teams.a.right?.pinned).toBe(true)
        expect(teams.a.left?.pinned).toBe(false)
        expect(teams.a.roster[2].foundOn).toEqual([eu])
        expect(teams.a.roster[0].foundOn).toEqual([])
        expect(teams.a.roster[0].captain).toBe(true)
    })

    it('cannot swap a side with an empty slot', () => {
        const teams = buildLineupTeams(match([A_CAPTAIN], [B_CAPTAIN, B_MATE], { ...DEFAULTS, a2: null }), EMPTY_LINEUP, { a: [], b: [] })

        expect(teams.a.right).toBeNull()
        expect(teams.a.canSwap).toBe(false)
    })
})
