import { buildMatchLinks } from '@/app/components/navigation/matchLinks'
import { blockingReasonLabel } from '@/app/components/pages/events/pickban/pickBanStatus'
import type { PickBanQueueEntry, PickBanSessionStatus } from '@/app/utils/api'

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
