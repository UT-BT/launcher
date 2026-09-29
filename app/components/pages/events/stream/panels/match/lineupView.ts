import { detectTeamServers, type DetectionServer, type FoundRosterMember } from '@/lib/stream-kit/team-server-detection'
import type { RawActiveTitle } from '@/app/utils/api'
import type { StreamMatch, StreamSide } from '../../streamDesk'

export const SERVER_POLL_MS = 30_000

export type LineupSlot = 'a1' | 'a2' | 'b1' | 'b2'
export type LineupSlots = Record<LineupSlot, string | null>
export type LineupPosition = 'left' | 'right'

export const LINEUP_SLOTS: readonly LineupSlot[] = ['a1', 'a2', 'b1', 'b2']
export const STREAM_SIDES: readonly StreamSide[] = ['a', 'b']
export const SIDE_SLOTS: Record<StreamSide, readonly [LineupSlot, LineupSlot]> = { a: ['a1', 'a2'], b: ['b1', 'b2'] }
export const EMPTY_LINEUP: LineupSlots = { a1: null, a2: null, b1: null, b2: null }

export type FoundMembers<S> = Record<StreamSide, FoundRosterMember<S>[]>
type Pair = readonly [string, string]

export interface LineupSuggestion {
    pairs: Record<StreamSide, Pair | null>
    lineup: LineupSlots
    changes: boolean
    complete: boolean
}

export interface LineupPlayer<S> {
    id: string
    displayName: string | null
    title: RawActiveTitle | null
    captain: boolean
    foundOn: S[]
}

export interface LineupSeat<S> extends LineupPlayer<S> {
    pinned: boolean
}

export interface LineupRosterEntry<S> extends LineupPlayer<S> {
    slot: LineupPosition | null
}

export interface LineupTeam<S> {
    side: StreamSide
    name: string | null
    left: LineupSeat<S> | null
    right: LineupSeat<S> | null
    roster: LineupRosterEntry<S>[]
    choosable: boolean
    canSwap: boolean
}

export function hasLineupBlock(match: StreamMatch): boolean {
    const { lineup, teams } = match as Partial<StreamMatch>
    return typeof lineup === 'object' && lineup !== null && typeof teams === 'object' && teams !== null
}

export function effectiveLineupOf(match: Pick<StreamMatch, 'lineup'>): LineupSlots {
    return {
        a1: match.lineup.a1?.id ?? null,
        a2: match.lineup.a2?.id ?? null,
        b1: match.lineup.b1?.id ?? null,
        b2: match.lineup.b2?.id ?? null,
    }
}

export function isLineupEmpty(stored: LineupSlots): boolean {
    return LINEUP_SLOTS.every(slot => stored[slot] === null)
}

function withSide(stored: LineupSlots, side: StreamSide, pair: readonly [string | null, string | null]): LineupSlots {
    const [first, second] = SIDE_SLOTS[side]
    return { ...stored, [first]: pair[0], [second]: pair[1] }
}

function sideOf(lineup: LineupSlots, side: StreamSide): [string | null, string | null] {
    const [first, second] = SIDE_SLOTS[side]
    return [lineup[first], lineup[second]]
}

export function pickPlayer(effective: LineupSlots, stored: LineupSlots, slot: LineupSlot, userId: string): LineupSlots {
    const side: StreamSide = slot.startsWith('a') ? 'a' : 'b'
    const [left, right] = sideOf(effective, side)
    if (slot === SIDE_SLOTS[side][0]) return withSide(stored, side, [userId, right === userId ? left : right])
    return withSide(stored, side, [left === userId ? right : left, userId])
}

export function swapSide(effective: LineupSlots, stored: LineupSlots, side: StreamSide): LineupSlots {
    const [left, right] = sideOf(effective, side)
    return withSide(stored, side, [right, left])
}

function suggestPair(current: [string | null, string | null], found: readonly string[]): Pair | null {
    if (found.length !== 2) return null
    const kept = current.map(id => (id !== null && found.includes(id) ? id : null))
    const rest = found.filter(id => !kept.includes(id))
    const [left, right] = kept.map(id => id ?? rest.shift() ?? null)
    return left !== null && right !== null ? [left, right] : null
}

export function suggestLineup(effective: LineupSlots, stored: LineupSlots, found: Record<StreamSide, readonly string[]>): LineupSuggestion {
    const pairs = {
        a: suggestPair(sideOf(effective, 'a'), found.a),
        b: suggestPair(sideOf(effective, 'b'), found.b),
    }
    const lineup = STREAM_SIDES.reduce((next, side) => {
        const pair = pairs[side]
        return pair ? withSide(next, side, pair) : next
    }, stored)
    const changes = STREAM_SIDES.some(side => {
        const pair = pairs[side]
        const [left, right] = sideOf(effective, side)
        return pair !== null && (pair[0] !== left || pair[1] !== right)
    })
    return { pairs, lineup, changes, complete: pairs.a !== null && pairs.b !== null }
}

export function shouldAutoApply(stored: LineupSlots | null, suggestion: LineupSuggestion): boolean {
    return stored !== null && isLineupEmpty(stored) && suggestion.complete && suggestion.changes
}

export function detectLineup<S extends DetectionServer>(servers: readonly S[], match: Pick<StreamMatch, 'teams'>): FoundMembers<S> {
    const rosterOf = (side: StreamSide) => match.teams[side]?.members.map(member => member.id) ?? []
    const detection = detectTeamServers(servers, { A: rosterOf('a'), B: rosterOf('b') })
    return { a: detection.A.members, b: detection.B.members }
}

export function foundIds<S>(found: FoundMembers<S>): Record<StreamSide, string[]> {
    return { a: found.a.map(entry => entry.discordId), b: found.b.map(entry => entry.discordId) }
}

export function buildLineupTeams<S>(
    match: Pick<StreamMatch, 'teams' | 'lineup'>,
    stored: LineupSlots,
    found: FoundMembers<S>,
): Record<StreamSide, LineupTeam<S>> {
    const effective = effectiveLineupOf(match)

    const teamOf = (side: StreamSide): LineupTeam<S> => {
        const team = match.teams[side]
        const [leftSlot, rightSlot] = SIDE_SLOTS[side]
        const foundOn = (id: string) => found[side].find(entry => entry.discordId === id)?.servers ?? []
        const playerOf = (id: string): LineupPlayer<S> => {
            const member = team?.members.find(entry => entry.id === id)
            const person = match.lineup[leftSlot]?.id === id ? match.lineup[leftSlot] : match.lineup[rightSlot]
            return {
                id,
                displayName: member?.display_name ?? person?.display_name ?? null,
                title: member?.title ?? null,
                captain: member?.captain ?? false,
                foundOn: foundOn(id),
            }
        }
        const seatOf = (slot: LineupSlot): LineupSeat<S> | null => {
            const id = effective[slot]
            return id === null ? null : { ...playerOf(id), pinned: stored[slot] === id }
        }
        const roster = (team?.members ?? []).map(member => ({
            ...playerOf(member.id),
            slot: member.id === effective[leftSlot] ? 'left' as const : member.id === effective[rightSlot] ? 'right' as const : null,
        }))
        const left = seatOf(leftSlot)
        const right = seatOf(rightSlot)
        return {
            side,
            name: team?.name ?? null,
            left,
            right,
            roster,
            choosable: roster.length > 2,
            canSwap: left !== null && right !== null,
        }
    }

    return { a: teamOf('a'), b: teamOf('b') }
}
