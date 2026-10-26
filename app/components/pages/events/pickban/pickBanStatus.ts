import type { PickBanErrorCode, PickBanSessionStatus, PickBanSidePhase, PickBanVetoPhase } from '@/app/utils/api'
import type { PickBanViewPhase } from './pickBanView'

export type PickBanStatusTone = 'idle' | 'ready' | 'live' | 'paused' | 'done'

export interface PickBanStatusBadge {
    label: string
    tone: PickBanStatusTone
}

const STATUS_BADGES: Record<PickBanSessionStatus, PickBanStatusBadge> = {
    none: { label: 'Not Open', tone: 'idle' },
    lobby: { label: 'Lobby', tone: 'ready' },
    running: { label: 'Live', tone: 'live' },
    paused: { label: 'Paused', tone: 'paused' },
    complete: { label: 'Complete', tone: 'done' },
    cancelled: { label: 'Cancelled', tone: 'idle' },
    voided: { label: 'Voided', tone: 'idle' },
}

const UNKNOWN_BLOCKING_REASON = 'Not startable'

const BLOCKING_REASON_LABELS: Partial<Record<PickBanErrorCode, string>> = {
    no_session: 'No lobby open',
    teams_not_decided: 'Teams not decided',
    side_chooser_undetermined: 'No team to choose Red or Blue',
    pre_cup_seed_missing: 'A team is missing its pre-cup seed',
    sequence_mismatch: 'Sequence does not match the best-of',
    pool_too_small: 'Map pool is too small',
    results_present: 'Results already entered',
    match_finished: 'Match already finished',
}

const SIDE_PHASE_LABELS: Record<PickBanSidePhase, string> = {
    side_choice: 'Step 0 · Side choice',
    side_spotlight: 'Step 0 · Revealing',
}

const VETO_PHASE_LABELS: Record<PickBanVetoPhase, string> = {
    veto_choice: 'Map veto',
    veto_spotlight: 'Map veto · Revealing',
}

const WRONG_STATUS_LABELS: Partial<Record<PickBanSessionStatus, string>> = {
    running: 'Picks & Bans are already in progress',
    paused: 'Picks & Bans are paused',
    complete: 'Picks & Bans are already complete',
}

export function blockingReasonLabel(code: PickBanErrorCode | null, status: PickBanSessionStatus): string | null {
    if (code === null) return null
    const label = code === 'wrong_status' ? WRONG_STATUS_LABELS[status] : BLOCKING_REASON_LABELS[code]
    return label ?? UNKNOWN_BLOCKING_REASON
}

export function pickBanStatusBadge(status: PickBanSessionStatus): PickBanStatusBadge {
    return STATUS_BADGES[status]
}

export function sidePhaseLabel(phase: PickBanSidePhase): string {
    return SIDE_PHASE_LABELS[phase]
}

export function vetoPhaseLabel(phase: PickBanVetoPhase): string {
    return VETO_PHASE_LABELS[phase]
}

export function statusOfPhase(phase: PickBanViewPhase | PickBanSidePhase | PickBanVetoPhase): PickBanSessionStatus {
    if (
        phase === 'intro'
        || phase === 'awaiting'
        || phase === 'spotlight'
        || phase === 'side_choice'
        || phase === 'side_spotlight'
        || phase === 'veto_choice'
        || phase === 'veto_spotlight'
    ) return 'running'
    return phase
}
