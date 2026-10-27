import type { EventCapCandidate, EventMatchCapLink, EventMatchMap, EventSide } from '@/app/utils/api'

export type CapLinkPicks = Record<string, EventSide>

export interface CapLinkPrefill {
    map?: string | null
    from?: string | null
    to?: string | null
}

export interface CapLinkSearchStart {
    map: string | null
    from: string | null
    to: string | null
}

export function capLinkSearchStart(
    row: Pick<EventMatchMap, 'map' | 'started_at' | 'ended_at'>,
    prefill: CapLinkPrefill = {},
): CapLinkSearchStart {
    return {
        map: prefill.map ?? row.map,
        from: prefill.from ?? row.started_at,
        to: prefill.to ?? row.ended_at,
    }
}

export function candidateKey(candidate: EventCapCandidate): string {
    return candidate.team_run_id ?? candidate.members[0]?.cap_id ?? ''
}

export function defaultPicks(candidates: EventCapCandidate[]): CapLinkPicks {
    return Object.fromEntries(
        candidates
            .filter(candidate => candidate.complete && candidate.side)
            .map(candidate => [candidateKey(candidate), candidate.side as EventSide]),
    )
}

function pickedSide(candidate: EventCapCandidate, picks: CapLinkPicks): EventSide | null {
    return candidate.complete ? picks[candidateKey(candidate)] ?? null : null
}

export function tallyPicks(candidates: EventCapCandidate[], picks: CapLinkPicks): Record<EventSide, number> {
    return candidates.reduce<Record<EventSide, number>>((totals, candidate) => {
        const side = pickedSide(candidate, picks)
        return side ? { ...totals, [side]: totals[side] + 1 } : totals
    }, { a: 0, b: 0 })
}

export function linkedCaps(
    candidates: EventCapCandidate[],
    picks: CapLinkPicks,
): Array<{ cap_id: string; side: EventSide }> {
    return candidates.flatMap(candidate => {
        const side = pickedSide(candidate, picks)
        return side ? candidate.members.map(member => ({ cap_id: member.cap_id, side })) : []
    })
}

export interface LinkedRunMember {
    capId: string
    user: string
    alias: string | null
}

export type LinkedCapRow =
    | { kind: 'run'; key: string; side: EventSide; teamCapId: string | null; seconds: number | null; members: LinkedRunMember[] }
    | { kind: 'cap'; key: string; cap: EventMatchCapLink }

function slowestMemberTime(caps: EventMatchCapLink[]): number | null {
    const times = caps.flatMap(cap => (cap.cap_time_seconds == null ? [] : [cap.cap_time_seconds]))
    return times.length ? Math.max(...times) : null
}

export function linkedCapRows(caps: EventMatchCapLink[]): LinkedCapRow[] {
    const runs = new Map<string, EventMatchCapLink[]>()
    const order: Array<string | EventMatchCapLink> = []

    for (const cap of caps) {
        if (!cap.team_run_id) {
            order.push(cap)
            continue
        }
        const key = `${cap.side}:${cap.team_run_id}`
        const entries = runs.get(key)
        if (entries) entries.push(cap)
        else {
            runs.set(key, [cap])
            order.push(key)
        }
    }

    return order.map(entry => {
        if (typeof entry !== 'string') return { kind: 'cap', key: entry.cap_id, cap: entry }

        const entries = runs.get(entry) ?? []
        const first = entries[0]
        return {
            kind: 'run',
            key: entry,
            side: first.side,
            teamCapId: entries.find(cap => cap.team_cap_id)?.team_cap_id ?? null,
            seconds: first.team_time_seconds ?? slowestMemberTime(entries),
            members: entries.map(cap => ({ capId: cap.cap_id, user: cap.user, alias: cap.alias })),
        }
    })
}
