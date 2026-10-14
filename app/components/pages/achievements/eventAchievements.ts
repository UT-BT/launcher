/**
 * Limited-time achievements: which are still winnable, and how their window reads.
 *
 * Pure on purpose — there is no component-rendering test setup in this repo, so
 * anything worth asserting has to live outside the JSX.
 */

import { parseApiInstant } from '@/app/components/pages/events/predictions/predictionsShared'
import type { AchievementDefinition, AchievementEventState } from '@/app/utils/api'

export const EVENT_CATEGORY = 'event'

export function eventOf(def: AchievementDefinition) {
    return def.category === EVENT_CATEGORY ? (def.event ?? null) : null
}

export function isEventAchievement(def: AchievementDefinition): boolean {
    return eventOf(def) !== null
}

export const AWARDED_AT_END_TEXT = 'Awarded when the event ends'

export function awardedAtEnd(def: AchievementDefinition): boolean {
    const event = eventOf(def)

    return event !== null && !def.unlocks_mid_event && !event.finalised_at
}

export function eventStateOf(def: AchievementDefinition): AchievementEventState | null {
    return eventOf(def)?.state ?? null
}

/** Only an ended event answers false: an upcoming one is still ahead of you. */
export function isStillWinnable(def: AchievementDefinition): boolean {
    return eventStateOf(def) !== 'ended'
}

/**
 * Event achievements lead while live and settle into history once they are not.
 * Putting a finished cup above the everyday ladders would shout about the past.
 */
export function eventSectionFirst(definitions: AchievementDefinition[]): boolean {
    return definitions.some(def => {
        const state = eventStateOf(def)
        return state === 'live' || state === 'upcoming'
    })
}

export interface EventWindowNotice {
    prefix: 'Opens' | 'Ends' | 'Ended'
    at: number | null
}

/** Data rather than a formatted string, so this is testable without a locale. */
export function eventWindowNotice(def: AchievementDefinition): EventWindowNotice | null {
    const event = eventOf(def)

    if (!event) return null

    if (event.state === 'upcoming') {
        return { prefix: 'Opens', at: parseApiInstant(event.opens_at) }
    }

    if (event.state === 'live') {
        return { prefix: 'Ends', at: parseApiInstant(event.closes_at) }
    }

    return { prefix: 'Ended', at: parseApiInstant(event.closes_at ?? event.finalised_at) }
}

/** Named after the event: "Limited time" tells a reader nothing, the cup does. */
export function eventSectionLabel(definitions: AchievementDefinition[]): string {
    for (const def of definitions) {
        const event = eventOf(def)

        if (event?.name) return event.name
    }

    return 'Limited time'
}
