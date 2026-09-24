import type { MatchPickBanStatus } from '@/app/utils/api'

export type PickBanCardAffordance = 'live' | 'join' | null

const OPEN_PICK_BAN_STATUSES: readonly MatchPickBanStatus[] = ['lobby', 'running', 'paused']

export function pickBanCardAffordance(status: MatchPickBanStatus, isRostered: boolean): PickBanCardAffordance {
    if (!OPEN_PICK_BAN_STATUSES.includes(status)) return null

    return isRostered ? 'join' : 'live'
}
