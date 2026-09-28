import { myTeamIdsByTournament } from '@/app/components/pages/events/schedule/scheduleShared'
import type { MyTournamentMembership, ScheduleEntry } from './api'

export interface EventAttention {
    awaitingSchedule: number
    invitations: number
    pickBanOpen: number
}

export type EventAttentionMap = Record<string, EventAttention>

function emptyAttention(): EventAttention {
    return { awaitingSchedule: 0, invitations: 0, pickBanOpen: 0 }
}

export function computeEventAttention(
    schedule: ScheduleEntry[],
    memberships: MyTournamentMembership[],
    openPickBanSlugs: ReadonlySet<string>,
): EventAttentionMap {
    const myTeamIds = myTeamIdsByTournament(memberships)
    const map: EventAttentionMap = {}

    const ensure = (slug: string): EventAttention => {
        const existing = map[slug]
        if (existing) return existing
        const created = emptyAttention()
        map[slug] = created
        return created
    }

    for (const entry of schedule) {
        const slug = entry.tournament.slug
        const myTeamId = myTeamIds.get(slug)
        if (myTeamId && entry.proposal && entry.whose_turn === myTeamId) ensure(slug).awaitingSchedule += 1
    }

    for (const membership of memberships) {
        if (membership.membership_status === 'invited') ensure(membership.tournament.slug).invitations += 1
    }

    for (const slug of openPickBanSlugs) ensure(slug).pickBanOpen = 1

    return map
}

export function eventAttentionCount(attention: EventAttention): number {
    return attention.awaitingSchedule + attention.invitations + attention.pickBanOpen
}

export function totalEventAttentionCount(map: EventAttentionMap): number {
    return Object.values(map).reduce((sum, attention) => sum + eventAttentionCount(attention), 0)
}

export function combinedEventAttention(map: EventAttentionMap): EventAttention {
    return Object.values(map).reduce((combined, attention) => ({
        awaitingSchedule: combined.awaitingSchedule + attention.awaitingSchedule,
        invitations: combined.invitations + attention.invitations,
        pickBanOpen: combined.pickBanOpen + attention.pickBanOpen,
    }), emptyAttention())
}

export function eventAttentionTooltip(attention: EventAttention): string {
    const parts: string[] = []

    if (attention.awaitingSchedule > 0) {
        parts.push(`${attention.awaitingSchedule} match${attention.awaitingSchedule === 1 ? '' : 'es'} waiting on your team to pick a time`)
    }
    if (attention.invitations > 0) {
        parts.push(`${attention.invitations} team invitation${attention.invitations === 1 ? '' : 's'}`)
    }
    if (attention.pickBanOpen > 0) parts.push('Picks & Bans lobby open')

    return parts.join(' · ')
}
