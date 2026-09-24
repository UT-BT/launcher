import { buildMatchLinks } from '@/app/components/navigation/matchLinks'
import type { PickBanErrorCode, PickBanQueueEntry, PickBanSessionStatus } from '@/app/utils/api'

export type PickBanQueueStatusTone = 'idle' | 'ready' | 'live' | 'paused' | 'done'

export interface PickBanQueueRow {
    matchId: string
    stageName: string
    roundLabel: string
    scheduledAt: string | null
    teamAName: string
    teamBName: string
    statusLabel: string
    statusTone: PickBanQueueStatusTone
    readyCount: number
    onlineCount: number
    startable: boolean
    blockingReasonLabel: string | null
    canOpenLobby: boolean
    playerLink: string
    streamLink: string
}

const STATUS_LABELS: Record<PickBanSessionStatus, string> = {
    none: 'Not opened',
    lobby: 'Lobby',
    running: 'Live',
    paused: 'Paused',
    complete: 'Complete',
    cancelled: 'Cancelled',
    voided: 'Voided',
}

const STATUS_TONES: Record<PickBanSessionStatus, PickBanQueueStatusTone> = {
    none: 'idle',
    lobby: 'ready',
    running: 'live',
    paused: 'paused',
    complete: 'done',
    cancelled: 'idle',
    voided: 'idle',
}

const BLOCKING_REASON_LABELS: Partial<Record<PickBanErrorCode, string>> = {
    no_session: 'No lobby open',
    wrong_status: 'A pick/ban is already in progress',
    teams_not_decided: 'Teams not decided',
    a_undetermined: 'Team A undetermined',
    pre_cup_seed_missing: 'A team is missing its pre-cup seed',
    sequence_mismatch: 'Sequence does not match the best-of',
    pool_too_small: 'Map pool is too small',
    results_present: 'Results already entered',
    match_finished: 'Match already finished',
}

export function statusLabel(status: PickBanSessionStatus): string {
    return STATUS_LABELS[status]
}

export function statusTone(status: PickBanSessionStatus): PickBanQueueStatusTone {
    return STATUS_TONES[status]
}

export function blockingReasonLabel(code: PickBanErrorCode | null): string | null {
    if (code === null) return null
    return BLOCKING_REASON_LABELS[code] ?? 'Not startable'
}

export function canOpenLobby(status: PickBanSessionStatus): boolean {
    return status === 'none' || status === 'cancelled' || status === 'voided'
}

export function toQueueRow(entry: PickBanQueueEntry, eventSlug: string): PickBanQueueRow {
    const links = buildMatchLinks(eventSlug, entry.match_id)

    return {
        matchId: entry.match_id,
        stageName: entry.stage_name,
        roundLabel: entry.round_label || (entry.round_no !== null ? `Round ${entry.round_no}` : ''),
        scheduledAt: entry.scheduled_at,
        teamAName: entry.teams.team_a?.name ?? 'TBD',
        teamBName: entry.teams.team_b?.name ?? 'TBD',
        statusLabel: statusLabel(entry.session_status),
        statusTone: statusTone(entry.session_status),
        readyCount: entry.ready_count,
        onlineCount: entry.online_count,
        startable: entry.startable,
        blockingReasonLabel: blockingReasonLabel(entry.blocking_reason),
        canOpenLobby: canOpenLobby(entry.session_status),
        playerLink: links.playerLink,
        streamLink: links.streamLink,
    }
}
