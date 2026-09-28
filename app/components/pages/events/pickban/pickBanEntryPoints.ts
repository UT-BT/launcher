import type { MatchPickBanStatus } from '@/app/utils/api'

export type PickBanAction = 'join' | 'live' | 'view' | null

export type PickBanCardAffordance = Exclude<PickBanAction, 'view'>

const OPEN_PICK_BAN_STATUSES: readonly MatchPickBanStatus[] = ['lobby', 'running', 'paused']

export function pickBanAction(status: MatchPickBanStatus, isRostered: boolean): PickBanAction {
    if (OPEN_PICK_BAN_STATUSES.includes(status)) return isRostered ? 'join' : 'live'
    if (status === 'complete') return 'view'
    return null
}

export function pickBanCardAffordance(status: MatchPickBanStatus, isRostered: boolean): PickBanCardAffordance {
    const action = pickBanAction(status, isRostered)
    return action === 'view' ? null : action
}
