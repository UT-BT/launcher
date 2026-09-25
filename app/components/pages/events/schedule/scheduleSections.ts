import type { EventMatch, EventMatchStatus, MatchPickBanStatus, MyMatchEntry, MyPickBanSession, ScheduleEntry } from '@/app/utils/api'
import { formatSlotTime, parseApiInstant } from '@/app/utils/timezone'

export interface ScheduleViewer {
    hasTeam: boolean
    canManageBracket: boolean
    isStreamer: boolean
}

export interface ScheduleSections {
    upcoming: MyMatchEntry[]
    needsTime: ScheduleEntry[]
    streaming: MyMatchEntry[]
    showPlayer: boolean
    showStreaming: boolean
}

export type PickBanCallToAction = 'join' | 'view' | 'page'

const BOOKED_STATUSES: readonly EventMatchStatus[] = ['scheduled', 'live']

const OPEN_PICK_BAN_STATUSES: readonly MatchPickBanStatus[] = ['lobby', 'running', 'paused']

function startsAt(entry: MyMatchEntry): number {
    return parseApiInstant(entry.match.scheduled_at) ?? Number.POSITIVE_INFINITY
}

function liveFirstThenSoonest(left: MyMatchEntry, right: MyMatchEntry): number {
    const live = Number(right.match.status === 'live') - Number(left.match.status === 'live')
    if (live !== 0) return live

    const leftAt = startsAt(left)
    const rightAt = startsAt(right)
    if (leftAt === rightAt) return 0

    return leftAt < rightAt ? -1 : 1
}

export function scheduleSections(
    pending: ScheduleEntry[] | null,
    mine: MyMatchEntry[] | null,
    viewer: ScheduleViewer,
): ScheduleSections {
    const matches = mine ?? []
    const upcoming = matches
        .filter(entry => entry.roles.includes('player') && BOOKED_STATUSES.includes(entry.match.status))
        .sort(liveFirstThenSoonest)
    const booked = new Set(upcoming.map(entry => entry.match.id))
    const needsTime = (pending ?? []).filter(entry => !booked.has(entry.match.id))
    const streaming = matches
        .filter(entry => entry.roles.includes('streamer'))
        .sort(liveFirstThenSoonest)

    return {
        upcoming,
        needsTime,
        streaming,
        showPlayer: viewer.hasTeam || viewer.canManageBracket || upcoming.length > 0 || needsTime.length > 0,
        showStreaming: viewer.isStreamer || streaming.length > 0,
    }
}

export function pickBanCallToAction(
    match: Pick<EventMatch, 'id' | 'pick_ban_status'>,
    session: MyPickBanSession | null,
): PickBanCallToAction {
    const status = session?.match_id === match.id ? session.status : match.pick_ban_status

    if (OPEN_PICK_BAN_STATUSES.includes(status)) return 'join'
    if (status === 'complete') return 'view'
    return 'page'
}

export function matchTimeLabel(match: Pick<EventMatch, 'status' | 'scheduled_at'>, timezone: string): string {
    if (match.status === 'live') return 'Live now'
    if (match.scheduled_at) return formatSlotTime(match.scheduled_at, timezone)
    return 'No time booked yet'
}

export function matchRoundLabel(match: Pick<EventMatch, 'round_label' | 'round_no'>): string {
    return match.round_label || `Round ${match.round_no}`
}
