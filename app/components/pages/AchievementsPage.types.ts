import type { AchievementDefinition, AchievementProgress } from '@/app/utils/api'
import type { AchievementStatusFilter } from './achievements/AchievementsShowcase'

export interface AchievementsPageState {
    statusFilter: AchievementStatusFilter
}

export type AchievementsCacheStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface AchievementsPageCaches {
    definitions: AchievementDefinition[]
    progress: AchievementProgress[]
    lastRefreshIso: string | null
    status: AchievementsCacheStatus
}

export const DEFAULT_ACHIEVEMENTS_STATE: AchievementsPageState = {
    statusFilter: 'all',
}

export const DEFAULT_ACHIEVEMENTS_CACHES: AchievementsPageCaches = {
    definitions: [],
    progress: [],
    lastRefreshIso: null,
    status: 'idle',
}
