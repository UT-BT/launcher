import { buildMatchLinks } from '@/app/components/navigation/matchLinks'
import type { PickBanErrorCode, PickBanQueueEntry, PickBanSessionStatus } from '@/app/utils/api'

export interface PickBanQueueRow {
    matchId: string
    stageName: string
    roundLabel: string
    scheduledAt: string | null
    teamAName: string
    teamBName: string
    status: PickBanSessionStatus
    readyCount: number
    onlineCount: number
    blockingReasonLabel: string | null
    canOpenLobby: boolean
    playerLink: string
    streamLink: string
}

const UNKNOWN_BLOCKING_REASON = 'Not startable'

const BLOCKING_REASON_LABELS: Partial<Record<PickBanErrorCode, string>> = {
    no_session: 'No lobby open',
    teams_not_decided: 'Teams not decided',
    a_undetermined: 'Team A undetermined',
    pre_cup_seed_missing: 'A team is missing its pre-cup seed',
    sequence_mismatch: 'Sequence does not match the best-of',
    pool_too_small: 'Map pool is too small',
    results_present: 'Results already entered',
    match_finished: 'Match already finished',
}

const WRONG_STATUS_LABELS: Partial<Record<PickBanSessionStatus, string>> = {
    running: 'Pick/ban already in progress',
    paused: 'Pick/ban is paused',
    complete: 'Pick/ban already complete',
}

export function blockingReasonLabel(code: PickBanErrorCode | null, status: PickBanSessionStatus): string | null {
    if (code === null) return null
    const label = code === 'wrong_status' ? WRONG_STATUS_LABELS[status] : BLOCKING_REASON_LABELS[code]
    return label ?? UNKNOWN_BLOCKING_REASON
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
        status: entry.session_status,
        readyCount: entry.ready_count,
        onlineCount: entry.online_count,
        blockingReasonLabel: blockingReasonLabel(entry.blocking_reason, entry.session_status),
        canOpenLobby: canOpenLobby(entry.session_status),
        playerLink: links.playerLink,
        streamLink: links.streamLink,
    }
}
