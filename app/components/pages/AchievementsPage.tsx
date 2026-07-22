import { useCallback, useEffect, useRef, useState } from 'react'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import {
    fetchAchievementDefinitions,
    fetchMyAchievements,
    type AchievementDefinition,
    type AchievementProgress,
    type UserProfile,
} from '@/app/utils/api'
import {
    AchievementsShowcase,
    Segmented,
    STATUS_FILTERS,
    type AchievementStatusFilter,
} from './achievements/AchievementsShowcase'

export type { AchievementStatusFilter }

export interface AchievementsPageState {
    statusFilter: AchievementStatusFilter
    scrollTop: number
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
    scrollTop: 0,
}

export const DEFAULT_ACHIEVEMENTS_CACHES: AchievementsPageCaches = {
    definitions: [],
    progress: [],
    lastRefreshIso: null,
    status: 'idle',
}

interface AchievementsPageProps {
    userProfile?: UserProfile
    state: AchievementsPageState
    onStateChange: (updater: (prev: AchievementsPageState) => AchievementsPageState) => void
    caches: AchievementsPageCaches
    onCachesChange: (updater: (prev: AchievementsPageCaches) => AchievementsPageCaches) => void
}

export function AchievementsPage({
    userProfile, state, onStateChange, caches, onCachesChange,
}: AchievementsPageProps) {
    const accessToken = userProfile?.accessToken

    const [loading, setLoading] = useState(caches.definitions.length === 0)
    const [error, setError] = useState<string | null>(null)
    const scrollRef = useRef<HTMLDivElement | null>(null)

    const load = useCallback(async (background = false) => {

        if (!background) setLoading(true)
        setError(null)
        try {
            const definitions = await fetchAchievementDefinitions(accessToken ?? '')
            const mine = accessToken ? await fetchMyAchievements(accessToken) : { items: [] }
            onCachesChange(prev => ({
                ...prev,
                definitions,
                progress: mine.items,
                lastRefreshIso: new Date().toISOString(),
            }))
        } catch (e) {
            console.error('Failed to load achievements:', e)
            if (!background) setError('Failed to load achievements.')
        } finally {
            if (!background) setLoading(false)
        }
    }, [accessToken, onCachesChange])

    // Refetch on mount so the page reflects backend changes. If we already have
    // cached data, revalidate silently (no spinner) and keep showing it meanwhile.
    useEffect(() => {
        void load(caches.definitions.length > 0)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken])

    useEffect(() => {
        if (scrollRef.current && !loading) scrollRef.current.scrollTop = state.scrollTop
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading])

    useRegisterPageRefresh({
        onRefresh: () => void load(),
        refreshing: loading,
        tooltip: 'Refresh',
    })

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-0 duration-500">
            <div className="flex flex-wrap items-end justify-between gap-3 shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-foreground leading-tight">Achievements</h1>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-1 shrink-0">
                {(accessToken ? STATUS_FILTERS : STATUS_FILTERS.slice(0, 1)).map(s => (
                    <Segmented
                        key={s.id}
                        active={state.statusFilter === s.id}
                        label={s.label}
                        onClick={() => onStateChange(prev => ({ ...prev, statusFilter: s.id }))}
                    />
                ))}
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-sm shrink-0">
                    {error}
                </div>
            )}

            <div
                ref={scrollRef}
                onScroll={() => {
                    if (scrollRef.current) {
                        const top = scrollRef.current.scrollTop
                        onStateChange(prev => (prev.scrollTop === top ? prev : { ...prev, scrollTop: top }))
                    }
                }}
                className="flex-1 min-h-0 overflow-auto px-0.5 pt-2 pb-2 space-y-2.5"
            >
                <AchievementsShowcase
                    definitions={caches.definitions}
                    progress={caches.progress}
                    statusFilter={accessToken ? state.statusFilter : 'all'}
                    loading={loading}
                    anonymous={!accessToken}
                />
            </div>
        </div>
    )
}
