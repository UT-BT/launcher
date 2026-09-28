import type { EventBracket, EventBracketGroup, EventBracketStage, EventMatch, EventMatchStatus } from '@/app/utils/api'
import { formatZoned, parseApiInstant, startOfNextZonedDay, zonedDayKey } from '@/app/utils/timezone'

export interface PublicScheduleRow {
    match: EventMatch
    stage: Pick<EventBracketStage, 'name' | 'ordinal' | 'kind'>
    group: Pick<EventBracketGroup, 'name' | 'ordinal'> | null
    startsAt: number
}

export interface PublicScheduleBuckets {
    live: PublicScheduleRow[]
    upcoming: PublicScheduleRow[]
    played: PublicScheduleRow[]
}

export interface PublicScheduleDay {
    key: string
    label: string
    rows: PublicScheduleRow[]
}

const OFF_SCHEDULE_STATUSES: readonly EventMatchStatus[] = ['cancelled', 'bye']

const PLAYED_STATUSES: readonly EventMatchStatus[] = ['complete', 'forfeit']

const DAY_LABEL_FORMAT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }

function publishedMatches(bracket: EventBracket | null): Array<{ stage: EventBracketStage; match: EventMatch }> {
    if (!bracket?.published) return []

    return bracket.stages
        .filter(stage => stage.published)
        .flatMap(stage => stage.matches
            .filter(match => match.published !== false)
            .map(match => ({ stage, match })))
}

export function rows(bracket: EventBracket | null): PublicScheduleRow[] {
    return publishedMatches(bracket).flatMap(({ stage, match }) => {
        const startsAt = parseApiInstant(match.scheduled_at)
        if (startsAt === null || OFF_SCHEDULE_STATUSES.includes(match.status)) return []

        const group = stage.groups.find(entry => entry.id === match.group_id)
        return [{
            match,
            stage: { name: stage.name, ordinal: stage.ordinal, kind: stage.kind },
            group: group ? { name: group.name, ordinal: group.ordinal } : null,
            startsAt,
        }]
    })
}

function bracketOrder(left: PublicScheduleRow, right: PublicScheduleRow): number {
    return left.stage.ordinal - right.stage.ordinal
        || left.match.round_no - right.match.round_no
        || (left.group?.ordinal ?? -1) - (right.group?.ordinal ?? -1)
        || left.match.ordinal - right.match.ordinal
        || left.match.id.localeCompare(right.match.id)
}

function soonestFirst(left: PublicScheduleRow, right: PublicScheduleRow): number {
    return left.startsAt - right.startsAt || bracketOrder(left, right)
}

function mostRecentFirst(left: PublicScheduleRow, right: PublicScheduleRow): number {
    return right.startsAt - left.startsAt || bracketOrder(left, right)
}

export function partition(scheduled: PublicScheduleRow[]): PublicScheduleBuckets {
    const played = (row: PublicScheduleRow) => PLAYED_STATUSES.includes(row.match.status)
    const live = (row: PublicScheduleRow) => row.match.status === 'live'

    return {
        live: scheduled.filter(live).sort(soonestFirst),
        upcoming: scheduled.filter(row => !live(row) && !played(row)).sort(soonestFirst),
        played: scheduled.filter(played).sort(mostRecentFirst),
    }
}

export function byDay(scheduled: PublicScheduleRow[], timezone: string, now: number): PublicScheduleDay[] {
    const named = new Map([
        [zonedDayKey(now, timezone), 'Today'],
        [zonedDayKey(startOfNextZonedDay(now, timezone), timezone), 'Tomorrow'],
    ])
    const days = new Map<string, PublicScheduleDay>()

    for (const row of scheduled) {
        const key = zonedDayKey(row.startsAt, timezone)
        const day = days.get(key)
            ?? { key, label: named.get(key) ?? formatZoned(row.startsAt, timezone, DAY_LABEL_FORMAT), rows: [] }
        day.rows.push(row)
        days.set(key, day)
    }

    return [...days.values()]
}

export function unscheduledCount(bracket: EventBracket | null): number {
    return publishedMatches(bracket)
        .filter(({ match }) => match.status === 'pending' && !!match.team_a && !!match.team_b && !match.scheduled_at)
        .length
}

export function nextUp(scheduled: PublicScheduleRow[], now: number): PublicScheduleRow | null {
    return partition(scheduled).upcoming.find(row => row.startsAt > now) ?? null
}
