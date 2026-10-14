import { formatCoins, formatSigned } from '@/app/components/pages/events/predictions/predictionsShared'
import type {
    EventAchievementBoard,
    EventAchievementBoardEntry,
    EventAchievementPlayer,
} from '@/app/utils/api'

export const LIST_PREVIEW = 8

export function measureText(entry: EventAchievementBoardEntry, value: number | null): string | null {
    if (value === null) return null

    switch (entry.measure.kind) {
        case 'coins': return formatCoins(value)
        case 'signed_coins': return formatSigned(value)
        case 'percent': return `${value}%`
        case 'signed_percent': return `${value > 0 ? '+' : ''}${value}%`
        case 'count': return value.toLocaleString()
        default: return null
    }
}

export function measureTone(entry: EventAchievementBoardEntry, value: number | null): 'up' | 'down' | null {
    if (value === null || (entry.measure.kind !== 'signed_coins' && entry.measure.kind !== 'signed_percent')) return null
    if (value > 0) return 'up'
    if (value < 0) return 'down'
    return null
}

export function holdersHeading(entry: EventAchievementBoardEntry, finalised: boolean): string {
    if (finalised) return 'Awarded'
    return entry.unlocks_mid_event ? 'Earned' : 'Qualifying now'
}

export function awardRule(entry: EventAchievementBoardEntry, finalised: boolean): string | null {
    if (finalised) return null
    return entry.unlocks_mid_event ? 'Unlocks when earned' : 'Awarded when the event ends'
}

export function emptyHoldersText(entry: EventAchievementBoardEntry, finalised: boolean): string {
    if (entry.awaiting_final) return 'Opens once the final is drawn'

    if (entry.names_hidden) {
        return entry.qualifying_count === 0
            ? 'Nobody has backed the final yet'
            : `${entry.qualifying_count.toLocaleString()} backed the final · names show once it starts`
    }

    return finalised ? 'Nobody earned this one' : 'Nobody yet'
}

export function chaseHint(entry: EventAchievementBoardEntry, player: EventAchievementPlayer): string | null {
    if (entry.min_settled !== null && player.settled < entry.min_settled) {
        return `${(entry.min_settled - player.settled).toLocaleString()} more settled`
    }

    if (player.value === null) return null

    const leader = entry.qualifying[0]?.value ?? null

    switch (entry.measure.kind) {
        case 'count': return `${Math.max(0, entry.threshold - player.value).toLocaleString()} to go`
        case 'percent': return `needs ${entry.threshold}%`
        case 'signed_coins': return `${formatCoins(Math.max(1, 1 - player.value))} short`
        case 'coins': return leader === null ? null : `${formatCoins(leader - player.value)} behind`
        case 'signed_percent': return leader === null ? null : `${(leader - player.value).toFixed(1)} pts behind`
        default: return null
    }
}

export function youLine(entry: EventAchievementBoardEntry, finalised: boolean): string | null {
    const you = entry.you

    if (!you) return null

    const earned = you.awarded || (you.qualifies && (entry.unlocks_mid_event || finalised))
    const status = earned ? 'Earned' : you.qualifies ? 'On track' : 'Not yet'
    const parts = [measureText(entry, you.value)]

    if (entry.min_settled !== null) parts.push(`${you.settled.toLocaleString()} settled`)

    return [...parts.filter((part): part is string => part !== null), status].join(' · ')
}

export function boardSummary(board: EventAchievementBoard): string {
    const people = `${board.participants.toLocaleString()} ${board.participants === 1 ? 'predictor' : 'predictors'}`

    if (board.finalised) return `Final standings across ${people}. These titles have been awarded.`

    const midEvent = board.achievements.filter(entry => entry.unlocks_mid_event).length
    const atEnd = board.achievements.length - midEvent

    return `Live standings across ${people}. ${midEvent} unlock as soon as they are earned; ${atEnd} are awarded when the event ends.`
}
