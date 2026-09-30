import type { EventCapCandidate, EventSide } from '@/app/utils/api'

export type CapLinkPicks = Record<string, EventSide>

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
