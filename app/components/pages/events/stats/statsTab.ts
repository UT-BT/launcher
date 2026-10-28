import type { EventBracket } from '@/app/utils/api'
import { statsMode } from './statsView'

const SEEN_KEY = 'utbt:eventStatsSeen:v1'

export const STATS_TAB_NEW_UNTIL = Date.parse('2027-01-01T00:00:00Z')

export interface StatsTabView {
    label: string
    isNew: boolean
}

export function statsTabView(bracket: EventBracket | null, bracketLoaded: boolean, seen: boolean, now: number): StatsTabView {
    const stats = bracketLoaded && statsMode(bracket) === 'stats'
    return { label: stats ? 'Stats' : 'Teams', isNew: stats && !seen && now < STATS_TAB_NEW_UNTIL }
}

export function loadStatsTabSeen(): boolean {
    try {
        return window.localStorage.getItem(SEEN_KEY) === '1'
    } catch {
        return false
    }
}

export function saveStatsTabSeen(): boolean {
    try {
        window.localStorage.setItem(SEEN_KEY, '1')
        return true
    } catch {
        return false
    }
}
