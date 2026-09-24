import type { MatchPickBanStatus, MyPickBanSession } from '@/app/utils/api'

export type PickBanCardAffordance = 'live' | 'join' | null

const OPEN_PICK_BAN_STATUSES: readonly MatchPickBanStatus[] = ['lobby', 'running', 'paused']

/**
 * What a match card shows for pick/ban: nothing while there is no open or
 * running session, a "Join" pill for a rostered viewer while there is one,
 * and a "Pick/Ban live" pill for everyone else. Both reach the same page —
 * the caller decides who is rostered on this match.
 */
export function pickBanCardAffordance(status: MatchPickBanStatus, isRostered: boolean): PickBanCardAffordance {
    if (!OPEN_PICK_BAN_STATUSES.includes(status)) return null

    return isRostered ? 'join' : 'live'
}

/**
 * The event-page "Pick/Ban open – Join" banner: visible exactly while the
 * `me` payload carries the caller's team's open or running session, and
 * gone once it is `null` — completion included, since `me` stops reporting
 * a session the moment it completes.
 */
export function pickBanJoinBannerVisible(session: MyPickBanSession | null): boolean {
    return session !== null
}
