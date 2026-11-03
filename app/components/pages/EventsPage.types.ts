import type { EventSummary } from '@/app/utils/api'

export type EventsPageState = Record<string, never>

export interface EventsPageCaches {
    events: EventSummary[]
    loaded: boolean
    lastRefreshIso: string | null
}

export const DEFAULT_EVENTS_STATE: EventsPageState = {}

export const DEFAULT_EVENTS_CACHES: EventsPageCaches = {
    events: [],
    loaded: false,
    lastRefreshIso: null,
}
