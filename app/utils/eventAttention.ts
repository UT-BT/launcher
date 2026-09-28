import { myTeamIdsByTournament } from '@/app/components/pages/events/schedule/scheduleShared'
import type { NavBadge } from '@/app/components/navigation/nav-items'
import type { EventTeam, MyTournamentMembership, ScheduleEntry } from './api'

export type EventTodo =
    | { kind: 'answer-times'; entry: ScheduleEntry }
    | { kind: 'propose-time'; entry: ScheduleEntry }
    | { kind: 'invitation'; team: EventTeam }

export interface EventAttention {
    answerTimes: number
    proposeTime: number
    invitations: number
    pickBanOpen: boolean
}

export type EventAttentionMap = Record<string, EventAttention>

const NO_ATTENTION: EventAttention = { answerTimes: 0, proposeTime: 0, invitations: 0, pickBanOpen: false }

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

export function eventAttentionOf(todos: EventTodo[], pickBanOpen: boolean): EventAttention {
    return {
        answerTimes: todos.filter(todo => todo.kind === 'answer-times').length,
        proposeTime: todos.filter(todo => todo.kind === 'propose-time').length,
        invitations: todos.filter(todo => todo.kind === 'invitation').length,
        pickBanOpen,
    }
}

export function computeEventAttention(
    schedule: ScheduleEntry[],
    memberships: MyTournamentMembership[],
    openPickBanSlugs: ReadonlySet<string>,
): EventAttentionMap {
    const myTeamIds = myTeamIdsByTournament(memberships)
    const invited = memberships.filter(membership => membership.membership_status === 'invited')
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
        const attention = eventAttentionOf(todos, openPickBanSlugs.has(slug))
        if (eventAttentionCount(attention) > 0 || attention.pickBanOpen) map[slug] = attention
    }

    return map
}

export function eventAttentionCount(attention: EventAttention): number {
    return attention.answerTimes + attention.proposeTime + attention.invitations
}

export function combinedEventAttention(map: EventAttentionMap): EventAttention {
    return Object.values(map).reduce((combined, attention) => ({
        answerTimes: combined.answerTimes + attention.answerTimes,
        proposeTime: combined.proposeTime + attention.proposeTime,
        invitations: combined.invitations + attention.invitations,
        pickBanOpen: combined.pickBanOpen || attention.pickBanOpen,
    }), NO_ATTENTION)
}

function matches(count: number): string {
    return `${count} match${count === 1 ? '' : 'es'}`
}

export function eventAttentionLines(attention: EventAttention): string[] {
    const lines: string[] = []

    if (attention.answerTimes > 0) {
        lines.push(`Respond to ${attention.answerTimes === 1 ? 'a time offer' : 'time offers'} for ${matches(attention.answerTimes)}`)
    }
    if (attention.proposeTime > 0) lines.push(`Propose a time for ${matches(attention.proposeTime)}`)
    if (attention.invitations > 0) {
        lines.push(`Answer ${attention.invitations} team invitation${attention.invitations === 1 ? '' : 's'}`)
    }
    if (attention.pickBanOpen) lines.push('Join your open Picks & Bans lobby')

    return lines
}

export function attentionNavBadge(attention: EventAttention = NO_ATTENTION, fallback: NavBadge | null = null): NavBadge | null {
    const count = eventAttentionCount(attention)
    const details = eventAttentionLines(attention)

    if (count > 0) return { count, live: attention.pickBanOpen, details }
    if (fallback) return { count: fallback.count, live: attention.pickBanOpen || fallback.live, details: [...details, ...fallback.details] }
    return attention.pickBanOpen ? { count: null, live: true, details } : null
}
