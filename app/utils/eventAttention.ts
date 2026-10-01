import type { EventTeam, MyTournamentMembership, ScheduleEntry } from './api'
import { signupsClosed } from './signupWindow'

export type EventTodo =
    | { kind: 'answer-times'; entry: ScheduleEntry }
    | { kind: 'propose-time'; entry: ScheduleEntry }
    | { kind: 'invitation'; team: EventTeam }

export interface TodoCounts {
    offersToAnswer: number
    matchesToSchedule: number
    invitations: number
}

export interface EventAttention extends TodoCounts {
    pickBanOpen: boolean
}

export interface ScheduleTodoSummary {
    count: number
    lines: string[]
}

export type EventAttentionMap = Record<string, EventAttention>

const NO_ATTENTION: EventAttention = { offersToAnswer: 0, matchesToSchedule: 0, invitations: 0, pickBanOpen: false }

function playsIn(entry: ScheduleEntry, teamId: string): boolean {
    return entry.match.team_a?.id === teamId || entry.match.team_b?.id === teamId
}

export function eventTodos(schedule: ScheduleEntry[], myTeamId: string | null, invitations: EventTeam[]): EventTodo[] {
    if (!myTeamId) return invitations.map((team): EventTodo => ({ kind: 'invitation', team }))

    const todos: EventTodo[] = []
    for (const entry of schedule) {
        if (entry.proposal && entry.whose_turn === myTeamId) todos.push({ kind: 'answer-times', entry })
        else if (!entry.proposal && entry.schedulable && playsIn(entry, myTeamId)) todos.push({ kind: 'propose-time', entry })
    }
    return todos
}

export function myTeamIdsByTournament(memberships: MyTournamentMembership[]): Map<string, string> {
    const byTournament = new Map<string, string>()

    for (const membership of memberships) {
        if (membership.membership_status === 'active') byTournament.set(membership.tournament.slug, membership.team.id)
    }

    return byTournament
}

export function openLobbySlugs(memberships: MyTournamentMembership[]): Set<string> {
    return new Set(
        memberships
            .filter(membership => membership.membership_status === 'active' && Boolean(membership.pick_ban_session))
            .map(membership => membership.tournament.slug),
    )
}

export function todoCountsByKind(todos: EventTodo[]): TodoCounts {
    return {
        offersToAnswer: todos.filter(todo => todo.kind === 'answer-times').length,
        matchesToSchedule: todos.filter(todo => todo.kind === 'propose-time').length,
        invitations: todos.filter(todo => todo.kind === 'invitation').length,
    }
}

export function computeEventAttention(schedule: ScheduleEntry[], memberships: MyTournamentMembership[], now = Date.now()): EventAttentionMap {
    const myTeamIds = myTeamIdsByTournament(memberships)
    const invited = memberships.filter(membership => membership.membership_status === 'invited' && !signupsClosed(membership.tournament, now))
    const openPickBanSlugs = openLobbySlugs(memberships)
    const slugs = new Set([
        ...schedule.map(entry => entry.tournament.slug),
        ...invited.map(membership => membership.tournament.slug),
        ...openPickBanSlugs,
    ])
    const map: EventAttentionMap = {}

    for (const slug of slugs) {
        const todos = eventTodos(
            schedule.filter(entry => entry.tournament.slug === slug),
            myTeamIds.get(slug) ?? null,
            invited.filter(membership => membership.tournament.slug === slug).map(membership => membership.team),
        )
        const attention: EventAttention = { ...todoCountsByKind(todos), pickBanOpen: openPickBanSlugs.has(slug) }
        if (eventAttentionCount(attention) > 0 || attention.pickBanOpen) map[slug] = attention
    }

    return map
}

export function eventAttentionCount(attention: EventAttention): number {
    return attention.offersToAnswer + attention.matchesToSchedule + attention.invitations
}

export function combinedEventAttention(map: EventAttentionMap): EventAttention {
    return Object.values(map).reduce((combined, attention) => ({
        offersToAnswer: combined.offersToAnswer + attention.offersToAnswer,
        matchesToSchedule: combined.matchesToSchedule + attention.matchesToSchedule,
        invitations: combined.invitations + attention.invitations,
        pickBanOpen: combined.pickBanOpen || attention.pickBanOpen,
    }), NO_ATTENTION)
}

function matchCountLabel(count: number): string {
    return `${count} match${count === 1 ? '' : 'es'}`
}

function offersToAnswerLine(count: number): string | null {
    return count > 0 ? `Respond to ${count === 1 ? 'a time offer' : 'time offers'} for ${matchCountLabel(count)}` : null
}

function matchesToScheduleLine(count: number): string | null {
    return count > 0 ? `Propose a time for ${matchCountLabel(count)}` : null
}

function invitationsLine(count: number): string | null {
    return count > 0 ? `Answer ${count} team invitation${count === 1 ? '' : 's'}` : null
}

function pickBanOpenLine(pickBanOpen: boolean): string | null {
    return pickBanOpen ? 'Join your open Picks & Bans lobby' : null
}

function presentLines(lines: (string | null)[]): string[] {
    return lines.filter((line): line is string => line !== null)
}

export function eventAttentionLines(attention: EventAttention): string[] {
    return presentLines([
        offersToAnswerLine(attention.offersToAnswer),
        matchesToScheduleLine(attention.matchesToSchedule),
        invitationsLine(attention.invitations),
        pickBanOpenLine(attention.pickBanOpen),
    ])
}

export function scheduleTodoSummary({ offersToAnswer, matchesToSchedule }: TodoCounts): ScheduleTodoSummary {
    return {
        count: offersToAnswer + matchesToSchedule,
        lines: presentLines([offersToAnswerLine(offersToAnswer), matchesToScheduleLine(matchesToSchedule)]),
    }
}
