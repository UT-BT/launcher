import { formatCapTime } from '@/app/utils/format'
import type { CapCompareCandidate } from '@/app/utils/api'

export type CandidateTag = 'Replay' | 'Zones'

export function candidateTag(capHasReplay: boolean | undefined, candidate: Pick<CapCompareCandidate, 'has_ghost'>): CandidateTag {
    return capHasReplay === true && candidate.has_ghost === true ? 'Replay' : 'Zones'
}

export function candidateOptionLabel(candidate: CapCompareCandidate, tag: CandidateTag): string {
    return `${candidate.alias ?? candidate.user} — ${formatCapTime(candidate.cap_time_seconds)} · ${tag}`
}

function nearestFaster<T extends CapCompareCandidate>(candidates: T[], capTimeSeconds: number): T | null {
    let best: T | null = null
    for (const c of candidates) {
        if (c.cap_time_seconds < capTimeSeconds && (!best || c.cap_time_seconds > best.cap_time_seconds)) best = c
    }
    return best
}

function sameOrNearestSlower<T extends CapCompareCandidate>(candidates: T[], capTimeSeconds: number): T | null {
    const same = candidates.find(c => c.cap_time_seconds === capTimeSeconds)
    if (same) return same
    let slower: T | null = null
    for (const c of candidates) {
        if (c.cap_time_seconds > capTimeSeconds && (!slower || c.cap_time_seconds < slower.cap_time_seconds)) slower = c
    }
    return slower ?? candidates[0] ?? null
}

export function defaultCompareCandidate<T extends CapCompareCandidate>(
    capTimeSeconds: number,
    capHasReplay: boolean | undefined,
    candidates: T[],
): T | null {
    const replays = candidates.filter(c => candidateTag(capHasReplay, c) === 'Replay')
    return nearestFaster(replays, capTimeSeconds)
        ?? nearestFaster(candidates, capTimeSeconds)
        ?? sameOrNearestSlower(candidates, capTimeSeconds)
}
