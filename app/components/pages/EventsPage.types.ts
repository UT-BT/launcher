import type { EventSummary } from '@/app/utils/api'

export interface EventsPageState {
    scrollTop: number
    month: string
}

export interface EventsPageCaches {
    events: EventSummary[]
    loaded: boolean
    lastRefreshIso: string | null
}

export const DEFAULT_EVENTS_STATE: EventsPageState = {
    scrollTop: 0,
    month: new Date().toISOString().slice(0, 7),
}

export const DEFAULT_EVENTS_CACHES: EventsPageCaches = {
    events: [],
    loaded: false,
    lastRefreshIso: null,
}
