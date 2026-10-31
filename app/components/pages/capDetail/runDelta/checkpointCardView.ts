import type { CapCompareCandidate, CapComparison } from '@/app/utils/api'
import { candidateTag } from './compareCandidates'
import {
    buildRunDeltaCard,
    type ReplayCard,
    type RoutesDifferCard,
    type RunDeltaCardInput,
    type ZonesCard,
} from './runDeltaCard'

export interface ComparisonResult {
    runnerId: string
    referenceId: string
    comparison: CapComparison | null
}

export interface CheckpointCardViewInput {
    capId: string
    capHasReplay: boolean | undefined
    target: CapCompareCandidate | null
    result: ComparisonResult | null
    zonetimesLoading: boolean
}

export interface NoTargetView {
    kind: 'none'
}

export interface LoadingView {
    kind: 'loading'
    chip: 'REPLAY'
}

export type CheckpointCardView = NoTargetView | LoadingView | ReplayCard | RoutesDifferCard | ZonesCard

const LOADING: LoadingView = { kind: 'loading', chip: 'REPLAY' }

export function wantsComparison(capHasReplay: boolean | undefined, target: CapCompareCandidate | null): boolean {
    return !!target && candidateTag(capHasReplay, target) === 'Replay'
}

function zonesFallback(input: RunDeltaCardInput): ZonesCard {
    const card = buildRunDeltaCard({ ...input, comparison: null })
    return card.kind === 'zones'
        ? card
        : { kind: 'zones', chip: 'ZONES', note: 'The replay comparison is unavailable, so this uses zone checkpoints.' }
}

export function checkpointCardView({ capId, capHasReplay, target, result, zonetimesLoading }: CheckpointCardViewInput): CheckpointCardView {
    if (!target) return { kind: 'none' }
    const input: RunDeltaCardInput = {
        comparison: result?.comparison ?? null,
        capHasReplay,
        reference: { alias: target.alias, hasReplay: target.has_ghost },
    }
    if (!wantsComparison(capHasReplay, target)) return zonesFallback(input)
    if (!result || result.runnerId !== capId || result.referenceId !== target.id) return LOADING
    const card = buildRunDeltaCard(input)
    if (card.kind !== 'zones') return card
    return zonetimesLoading ? LOADING : zonesFallback(input)
}
