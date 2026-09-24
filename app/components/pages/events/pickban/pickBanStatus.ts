import type { PickBanSessionStatus } from '@/app/utils/api'
import type { PickBanViewPhase } from './pickBanView'

export type PickBanStatusTone = 'idle' | 'ready' | 'live' | 'paused' | 'done'

export interface PickBanStatusBadge {
    label: string
    tone: PickBanStatusTone
}

const STATUS_BADGES: Record<PickBanSessionStatus, PickBanStatusBadge> = {
    none: { label: 'Not open', tone: 'idle' },
    lobby: { label: 'Lobby', tone: 'ready' },
    running: { label: 'Live', tone: 'live' },
    paused: { label: 'Paused', tone: 'paused' },
    complete: { label: 'Complete', tone: 'done' },
    cancelled: { label: 'Cancelled', tone: 'idle' },
    voided: { label: 'Voided', tone: 'idle' },
}

export function pickBanStatusBadge(status: PickBanSessionStatus): PickBanStatusBadge {
    return STATUS_BADGES[status]
}

export function statusOfPhase(phase: PickBanViewPhase): PickBanSessionStatus {
    if (phase === 'intro' || phase === 'awaiting' || phase === 'spotlight') return 'running'
    return phase
}
