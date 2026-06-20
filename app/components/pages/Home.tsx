import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Activity, AlertTriangle, RefreshCw } from 'lucide-react'
import {
    UserProfile, fetchSummary, fetchHotMaps, fetchNews, fetchNewsCategories,
    Summary, SummaryWorldRecord, HotMap, NewsArticle, NewsCategoryDef,
} from '@/app/utils/api'
import { Button } from '@/app/components/ui/button'
import { Modal } from '@/app/components/ui/modal'
import { ReviewModal } from '@/app/components/modals/ReviewModal'
import { HistoryModal } from '@/app/components/modals/HistoryModal'
import { ReplayVideoModal } from '@/app/components/shared/ReplayVideoModal'
import { useReplayWatch } from '@/app/hooks/useReplayWatch'
import { useRefreshCooldown } from '@/app/hooks/useRefreshCooldown'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import type { Server } from '@/app/components/pages/ServerBrowserPage'

import { SpotlightSection, type SectionAccent } from './home/SpotlightSection'
import { CommunityStatsRow } from './home/CommunityStatsRow'
import { LatestRecordsCard } from './home/LatestRecordsCard'
import { HottestPosterGrid } from './home/HottestPosterGrid'
import { YouDoorway } from './home/YouDoorway'
import { NewestMapsCard } from './home/NewestMapsCard'
import { RecentCapsCard } from './home/RecentCapsCard'
import { MapsToReviewCard } from './home/MapsToReviewCard'
import { NewsCard } from './home/news/NewsCard'

const NEWS_SEEN_KEY = 'utbt:newsSeen:v1'

const ACCENTS: Record<string, SectionAccent> = {
    worldRecords: { tick: 'bg-blue-400' },
    hotMaps: { tick: 'bg-accent-400' },
    newMaps: { tick: 'bg-accent-400' },
    news: { tick: 'bg-accent-400' },
    reviews: { tick: 'bg-orange-300' },
    caps: { tick: 'bg-amber-400' },
}

interface HomeProps {
    userProfile?: UserProfile
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
    onViewServers?: () => void
    onViewMaps?: () => void
    onViewNewMaps?: () => void
    onViewWorldRecords?: () => void
    onViewPlayers?: () => void
    onViewNews?: () => void
}

const EMPTY_SUMMARY: Summary = {
    global: { newMaps: 0, newRecords: 0 },
    achievements: [],
    recentWorldRecords: [],
    newMaps: [],
}

export function Home({
    userProfile, favoriteMapNames, onToggleFavorite, onMapSelect,
    onViewServers, onViewMaps, onViewNewMaps, onViewWorldRecords, onViewPlayers, onViewNews,
}: HomeProps) {
    const refreshCooldown = useRefreshCooldown()
    const [summary, setSummary] = useState<Summary | null>(null)
    const [hotMaps, setHotMaps] = useState<HotMap[]>([])
    const [news, setNews] = useState<NewsArticle[]>([])
    const [newsCategories, setNewsCategories] = useState<NewsCategoryDef[]>([])
    const [newsSeen] = useState<string | null>(() => localStorage.getItem(NEWS_SEEN_KEY))
    const [servers, setServers] = useState<Server[] | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [reviewOpen, setReviewOpen] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [activeReviewMap, setActiveReviewMap] = useState<string | null>(null)
    const [reviewsRefreshKey, setReviewsRefreshKey] = useState(0)
    const [refreshKey, setRefreshKey] = useState(0)
    const mountedRef = useRef(true)

    const replay = useReplayWatch()

    const loadData = useCallback(async (isActive: () => boolean = () => true) => {
        if (!userProfile?.accessToken) return
        setLoading(true)
        setError(null)
        try {
            const [summaryData, hotMapsData, newsData, newsCategoryData, serverData] = await Promise.all([
                fetchSummary(userProfile.accessToken),
                fetchHotMaps(userProfile.accessToken).catch(() => [] as HotMap[]),
                fetchNews(userProfile.accessToken).catch(() => [] as NewsArticle[]),
                fetchNewsCategories(userProfile.accessToken).catch(() => [] as NewsCategoryDef[]),
                window.conveyor.game.fetchServers().catch(() => [] as Server[]) as Promise<Server[]>,
            ])
            if (!isActive()) return
            setSummary(summaryData)
            setHotMaps(hotMapsData)
            setNews(newsData)
            setNewsCategories(newsCategoryData)
            setServers(serverData)
            window.dispatchEvent(new CustomEvent('summary-badges', {
                detail: {
                    maps: {
                        count: summaryData.global.newMaps,
                        newestIso: summaryData.newMaps?.[0]?.added ?? null,
                    },
                    worldRecords: {
                        count: summaryData.global.newRecords,
                        newestIso: summaryData.recentWorldRecords?.[0]?.added ?? null,
                    },
                },
            }))
        } catch (err) {
            if (!isActive()) return
            console.error('Failed to load summary:', err)
            setError('Failed to load the community feed.')
        } finally {
            if (isActive()) setLoading(false)
        }
    }, [userProfile?.accessToken])

    useEffect(() => {
        if (!userProfile?.accessToken) {
            setLoading(false)
            return
        }
        let cancelled = false
        loadData(() => !cancelled)
        return () => { cancelled = true }
    }, [userProfile?.accessToken, loadData])

    useEffect(() => () => { mountedRef.current = false }, [])

    useRegisterPageRefresh({
        onRefresh: () => refreshCooldown.trigger(() => {
            loadData(() => mountedRef.current)
            setReviewsRefreshKey(k => k + 1)
            setRefreshKey(k => k + 1)
        }),
        refreshing: loading,
        disabled: !refreshCooldown.canRefresh,
        tooltip: refreshCooldown.canRefresh ? 'Refresh' : `Wait ${refreshCooldown.remainingSeconds}s`,
    })

    const handleReviewMap = (mapName: string) => {
        setActiveReviewMap(mapName)
        setReviewOpen(true)
    }

    const handleWatchReplay = (record: SummaryWorldRecord) => {
        replay.openReplay({
            capId: record.id,
            mapName: record.mapName,
            time: record.time,
            alias: record.alias ?? undefined,
        })
    }

    const handleWatchAchievement = (cap: Summary['achievements'][number]) => {
        replay.openReplay({
            capId: cap.id,
            mapName: cap.mapName,
            time: cap.time,
            alias: userProfile?.alias ?? undefined,
        })
    }

    const newsFeed = useMemo(() => news.slice(0, 3), [news])
    const newsCategoryMap = useMemo(() => new Map(newsCategories.map(c => [c.key, c])), [newsCategories])

    useEffect(() => {
        if (news.length === 0) return
        const newest = news.reduce((max, a) => (a.publishedAt > max ? a.publishedAt : max), '')
        if (newest) localStorage.setItem(NEWS_SEEN_KEY, newest)
    }, [news])

    if (!userProfile) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center space-y-4">
                    <Activity className="size-12 text-muted-foreground/20 mx-auto" />
                    <p className="text-muted-foreground font-medium">Please log in to view the community feed.</p>
                </div>
            </div>
        )
    }

    if (loading && !summary) {
        return (
            <div className="space-y-6 pb-12 pt-2">
                <div className="h-64 bg-hairline/5 rounded-2xl animate-pulse" />
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-16 bg-hairline/5 rounded-xl animate-pulse" />
                    ))}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-4 h-72 bg-hairline/5 rounded-xl animate-pulse" />
                    <div className="lg:col-span-8 h-72 bg-hairline/5 rounded-xl animate-pulse" />
                </div>
            </div>
        )
    }

    if (error && !summary) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center space-y-4">
                    <AlertTriangle className="size-12 text-red-500/50 mx-auto" />
                    <p className="text-red-400 font-medium">{error}</p>
                    <Button onClick={() => loadData()} variant="outline" className="gap-2">
                        <RefreshCw className="size-4" /> Try Again
                    </Button>
                </div>
            </div>
        )
    }

    const data = summary ?? EMPTY_SUMMARY
    const recentWRs = data.recentWorldRecords ?? []
    const newMaps = data.newMaps ?? []
    const playersOnline = servers === null ? null : servers.reduce((sum, s) => sum + s.player_count, 0)

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-0 duration-500 pb-12 pt-2">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                <YouDoorway
                    className="lg:col-span-5"
                    userId={userProfile.id ?? undefined}
                    alias={userProfile.alias}
                    title={userProfile.active_title ?? null}
                    accessToken={userProfile.accessToken}
                    refreshKey={refreshKey}
                />
                <CommunityStatsRow
                    className="lg:col-span-7"
                    accessToken={userProfile.accessToken}
                    playersOnline={playersOnline}
                    newMaps={data.global.newMaps}
                    onViewPlayers={onViewPlayers}
                    onViewServers={onViewServers}
                    onViewMaps={onViewMaps}
                    onViewNewMaps={onViewNewMaps}
                    refreshKey={refreshKey}
                />
            </div>

            <div className="space-y-4">
                {(newsFeed.length > 0 || hotMaps.length > 0) && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                        {newsFeed.length > 0 && (
                            <SpotlightSection
                                title="Latest News"
                                accent={ACCENTS.news}
                                actionLabel={onViewNews ? 'See All' : undefined}
                                onAction={onViewNews}
                                className="lg:col-span-6"
                            >
                                <NewsCard articles={newsFeed} categories={newsCategoryMap} newSince={newsSeen} />
                            </SpotlightSection>
                        )}

                        {hotMaps.length > 0 && (
                            <SpotlightSection
                                title="Hottest Maps"
                                accent={ACCENTS.hotMaps}
                                actionLabel={onViewMaps ? 'See All' : undefined}
                                onAction={onViewMaps}
                                className="lg:col-span-6"
                            >
                                <HottestPosterGrid
                                    maps={hotMaps}
                                    favoriteMapNames={favoriteMapNames}
                                    onToggleFavorite={onToggleFavorite}
                                    onMapSelect={onMapSelect}
                                />
                            </SpotlightSection>
                        )}
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    <SpotlightSection
                        title="Newest Maps"
                        accent={ACCENTS.newMaps}
                        actionLabel={onViewMaps ? 'See All' : undefined}
                        onAction={onViewMaps}
                        className="lg:col-span-6"
                    >
                        <NewestMapsCard
                            maps={newMaps}
                            favoriteMapNames={favoriteMapNames}
                            onToggleFavorite={onToggleFavorite}
                            onMapSelect={onMapSelect}
                        />
                    </SpotlightSection>
                    <SpotlightSection title="Maps to Review" accent={ACCENTS.reviews} className="lg:col-span-6">
                        <MapsToReviewCard
                            accessToken={userProfile.accessToken}
                            refreshKey={reviewsRefreshKey}
                            favoriteMapNames={favoriteMapNames}
                            onToggleFavorite={onToggleFavorite}
                            onReview={handleReviewMap}
                            onMapSelect={onMapSelect}
                        />
                    </SpotlightSection>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    <SpotlightSection
                        title="Latest World Records"
                        accent={ACCENTS.worldRecords}
                        actionLabel={onViewWorldRecords ? 'See All' : undefined}
                        onAction={onViewWorldRecords}
                        className="lg:col-span-6"
                    >
                        <LatestRecordsCard
                            records={recentWRs}
                            currentUserId={userProfile.id ?? undefined}
                            favoriteMapNames={favoriteMapNames}
                            onToggleFavorite={onToggleFavorite}
                            onMapSelect={onMapSelect}
                            onWatchReplay={handleWatchReplay}
                            loadingCapId={replay.loadingCapId}
                        />
                    </SpotlightSection>

                    <SpotlightSection
                        title="Your Latest Caps"
                        accent={ACCENTS.caps}
                        actionLabel="See More"
                        onAction={() => setHistoryOpen(true)}
                        className="lg:col-span-6"
                    >
                        <RecentCapsCard
                            caps={data.achievements}
                            playerUserId={userProfile.id ?? undefined}
                            playerAlias={userProfile.alias}
                            playerTitle={userProfile.active_title ?? null}
                            favoriteMapNames={favoriteMapNames}
                            onToggleFavorite={onToggleFavorite}
                            onMapSelect={onMapSelect}
                            onWatchReplay={handleWatchAchievement}
                            loadingCapId={replay.loadingCapId}
                        />
                    </SpotlightSection>
                </div>
            </div>

            <HistoryModal
                open={historyOpen}
                onOpenChange={setHistoryOpen}
                accessToken={userProfile.accessToken}
                userAlias={userProfile.alias}
                favoriteMapNames={favoriteMapNames}
                onToggleFavorite={onToggleFavorite}
                onReview={handleReviewMap}
                onMapSelect={onMapSelect}
            />

            <ReviewModal
                open={reviewOpen}
                onOpenChange={setReviewOpen}
                accessToken={userProfile.accessToken}
                userId={userProfile.id ?? undefined}
                mapName={activeReviewMap}
                onSuccess={() => {
                    loadData()
                    setReviewsRefreshKey(k => k + 1)
                }}
            />

            <ReplayVideoModal state={replay.video} onClose={replay.clearVideo} />

            <Modal
                isOpen={replay.error !== null}
                onClose={replay.clearError}
                title="Replay not available"
                className="w-[95%] sm:w-[440px] max-w-md"
                offsetSidebar
            >
                <p className="text-sm text-muted-foreground">{replay.error}</p>
            </Modal>
        </div>
    )
}
