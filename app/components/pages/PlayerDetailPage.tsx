import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavState } from '@/app/components/navigation/useNavState'
import { useNavScrollRestore } from '@/app/components/navigation/useNavScrollRestore'
import {
    fetchUserSummary,
    fetchUserActivity,
    type UserSummary,
    type UserProfile,
    type UserActivityBucket,
} from '@/app/utils/api'
import { useRefreshCooldown } from '@/app/hooks/useRefreshCooldown'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import { useAsync } from '@/app/hooks/useAsync'
import { ChangeTitleModal } from '@/app/components/modals/ChangeTitleModal'
import { HeroSection } from './playerDetail/HeroSection'
import { MedalShowcaseCard } from './playerDetail/MedalShowcaseCard'
import { RecentCapsCard } from './playerDetail/RecentCapsCard'
import { DisallowedCapsCard } from './playerDetail/DisallowedCapsCard'
import { PersonalBestsCard } from './playerDetail/PersonalBestsCard'
import { WorldRecordsCard } from './playerDetail/WorldRecordsCard'
import { PlaytimeBreakdownCard } from './playerDetail/PlaytimeBreakdownCard'
import { ReviewsAuthoredCard } from './playerDetail/ReviewsAuthoredCard'
import { FavoriteMapsCard } from './playerDetail/FavoriteMapsCard'
import { UncappedMapsCard } from './playerDetail/UncappedMapsCard'
import { PlayerAchievementsCard } from './playerDetail/PlayerAchievementsCard'
import { MainSectionTabs, type PlayerDetailTab } from './playerDetail/MainSectionTabs'

const PlayerActivityChart = lazy(() => import('./playerDetail/PlayerActivityChart'))

interface PlayerDetailPageProps {
    userId: string | number
    userProfile?: UserProfile
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
}

export function PlayerDetailPage({
    userId, userProfile, favoriteMapNames, onToggleFavorite, onMapSelect,
}: PlayerDetailPageProps) {
    const accessToken = userProfile?.accessToken ?? ''
    const currentUserId = userProfile?.id ?? undefined
    const isSelf = currentUserId != null && String(currentUserId) === String(userId)

    const [refreshKey, setRefreshKey] = useState(0)
    const refreshCooldown = useRefreshCooldown()

    const [activeTab, setActiveTab] = useNavState<PlayerDetailTab>('player.activeTab', 'caps')
    const [changeTitleOpen, setChangeTitleOpen] = useState(false)

    const [activity, setActivity] = useState<UserActivityBucket[]>([])
    const [chartLoading, setChartLoading] = useState(true)

    const scrollRef = useRef<HTMLDivElement>(null)

    const { data: summaryData, loading, error } = useAsync<UserSummary>(
        () => fetchUserSummary(accessToken, userId),
        [accessToken, userId, refreshKey],
        { enabled: true, errorMessage: 'Failed to load player data.' },
    )
    const summary = summaryData ?? null

    useRegisterPageRefresh({
        onRefresh: () => refreshCooldown.trigger(() => setRefreshKey(k => k + 1)),
        refreshing: loading,
        disabled: !refreshCooldown.canRefresh,
        tooltip: refreshCooldown.canRefresh ? 'Refresh' : `Wait ${refreshCooldown.remainingSeconds}s`,
    })

    const onScroll = useNavScrollRestore(scrollRef, !loading)

    // Lazy-load aggregated lifetime activity once initial summary is in.
    useEffect(() => {
        let cancelled = false
        if (!summary) return
        setChartLoading(true)
        fetchUserActivity(accessToken, userId)
            .then(rows => { if (!cancelled) setActivity(rows) })
            .catch(err => console.error('Failed to load activity chart data:', err))
            .finally(() => { if (!cancelled) setChartLoading(false) })
        return () => { cancelled = true }
    }, [accessToken, userId, summary, refreshKey])

    const counts = summary?.counts ?? null
    const medals = summary?.medals ?? null

    const tabs: { value: PlayerDetailTab; label: string; count?: number; hidden?: boolean }[] = [
        { value: 'caps', label: 'All Caps', count: counts?.total_caps },
        { value: 'disallowed', label: 'Disallowed', count: counts?.disallowed_caps, hidden: !counts?.disallowed_caps },
        { value: 'pbs', label: 'Personal Bests', count: counts?.unique_maps },
        { value: 'wrs', label: 'World Records', count: counts?.wr_count },
        { value: 'playtime', label: 'Playtime by Map' },
        { value: 'uncapped', label: 'Uncapped Maps', count: counts?.uncapped_maps },
        { value: 'achievements', label: 'Achievements' },
    ]

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-0 duration-500">

            <HeroSection
                userId={userId}
                summary={summary}
                loading={loading}
                isSelf={isSelf}
                onChangeTitle={isSelf ? () => setChangeTitleOpen(true) : undefined}
                chart={
                    <Suspense fallback={<div className="h-full min-h-[140px] bg-hairline/[0.02] border border-hairline/5 rounded-lg animate-pulse" />}>
                        <PlayerActivityChart activity={activity} loading={chartLoading} />
                    </Suspense>
                }
            />

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm shrink-0">
                    {error}
                </div>
            )}

            <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-4 space-y-4">
                        <MedalShowcaseCard medals={medals} loading={loading} />
                        <ReviewsAuthoredCard
                            accessToken={accessToken}
                            userId={userId}
                            isSelf={isSelf}
                            totalCount={counts?.map_review_count}
                            onMapSelect={onMapSelect}
                        />
                        <FavoriteMapsCard
                            accessToken={accessToken}
                            userId={userId}
                            isSelf={isSelf}
                            favoriteMapNames={favoriteMapNames}
                            onToggleFavorite={isSelf ? onToggleFavorite : undefined}
                            onMapSelect={onMapSelect}
                            totalCount={counts?.favorite_count}
                        />
                    </div>

                    <div className="lg:col-span-8">
                        {activeTab === 'caps' && (
                            <RecentCapsCard
                                accessToken={accessToken}
                                userId={userId}
                                favoriteMapNames={favoriteMapNames}
                                onToggleFavorite={isSelf ? onToggleFavorite : undefined}
                                canEditFavorites={isSelf}
                                onMapSelect={onMapSelect}
                                tabsSlot={<MainSectionTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />}
                            />
                        )}

                        {activeTab === 'disallowed' && (
                            <DisallowedCapsCard
                                accessToken={accessToken}
                                userId={userId}
                                onMapSelect={onMapSelect}
                                tabsSlot={<MainSectionTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />}
                            />
                        )}

                        {activeTab === 'pbs' && (
                            <PersonalBestsCard
                                accessToken={accessToken}
                                userId={userId}
                                favoriteMapNames={favoriteMapNames}
                                onToggleFavorite={isSelf ? onToggleFavorite : undefined}
                                canEditFavorites={isSelf}
                                onMapSelect={onMapSelect}
                                tabsSlot={<MainSectionTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />}
                            />
                        )}

                        {activeTab === 'wrs' && (
                            <WorldRecordsCard
                                accessToken={accessToken}
                                userId={userId}
                                totalCount={counts?.wr_count ?? 0}
                                onMapSelect={onMapSelect}
                                tabsSlot={<MainSectionTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />}
                            />
                        )}

                        {activeTab === 'playtime' && (
                            <PlaytimeBreakdownCard
                                accessToken={accessToken}
                                userId={userId}
                                onMapSelect={onMapSelect}
                                tabsSlot={<MainSectionTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />}
                            />
                        )}

                        {activeTab === 'uncapped' && (
                            <UncappedMapsCard
                                accessToken={accessToken}
                                userId={userId}
                                onMapSelect={onMapSelect}
                                tabsSlot={<MainSectionTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />}
                            />
                        )}

                        {activeTab === 'achievements' && (
                            <PlayerAchievementsCard
                                accessToken={accessToken}
                                userId={userId}
                                tabsSlot={<MainSectionTabs tabs={tabs} active={activeTab} onChange={setActiveTab} />}
                            />
                        )}
                    </div>
                </div>
            </div>

            <ChangeTitleModal
                isOpen={changeTitleOpen}
                onClose={() => setChangeTitleOpen(false)}
                accessToken={accessToken}
                userId={currentUserId != null ? String(currentUserId) : undefined}
                currentTitleId={userProfile?.active_title?.id ?? undefined}
                onTitleChanged={() => {
                    window.dispatchEvent(new CustomEvent('refresh-user-profile'))
                    setRefreshKey(k => k + 1)
                }}
            />
        </div>
    )
}
