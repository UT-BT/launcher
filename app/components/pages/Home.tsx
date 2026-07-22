import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Activity, AlertTriangle, RefreshCw } from 'lucide-react'
import {
    UserProfile, fetchSummary, fetchHotMaps, fetchNews, fetchNewsCategories,
    fetchUserSummary,
    Summary, SummaryWorldRecord, HotMap, NewsArticle, NewsCategoryDef,
    UserSummary, MedalHuntOpportunity, PendingReviewsPage,
} from '@/app/utils/api'
import type { AchievementsPageCaches } from '@/app/components/pages/AchievementsPage'
import { Button } from '@/app/components/ui/button'
import { Modal } from '@/app/components/ui/modal'
import { ReviewModal } from '@/app/components/modals/ReviewModal'
import { HistoryModal } from '@/app/components/modals/HistoryModal'
import { ReplayVideoModal } from '@/app/components/shared/ReplayVideoModal'
import { useReplayWatch } from '@/app/hooks/useReplayWatch'
import { useRefreshCooldown } from '@/app/hooks/useRefreshCooldown'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import type { Server } from '@/app/components/pages/ServerBrowserPage'
import {
    forgetRecentServer, readRecentServers, rememberRecentServer,
    type RecentServerEntry,
} from '@/app/utils/server-utils'

import { SpotlightSection, type SectionAccent } from './home/SpotlightSection'
import { CommunityStatsRow } from './home/CommunityStatsRow'
import { LatestRecordsCard } from './home/LatestRecordsCard'
import { HottestPosterGrid } from './home/HottestPosterGrid'
import { YouDoorway } from './home/YouDoorway'
import { NewestMapsCard } from './home/NewestMapsCard'
import { RecentCapsCard } from './home/RecentCapsCard'
import { MapsToReviewCard } from './home/MapsToReviewCard'
import { NewsCard } from './home/news/NewsCard'
import { PersonalProgressSnapshot } from './home/PersonalProgressSnapshot'
import { AchievementProgressPreview } from './home/AchievementProgressPreview'
import { RecentServersCard } from './home/RecentServersCard'
import { MedalHuntCard } from './home/MedalHuntCard'
import { capabilities, fetchGatewayServers } from '@/app/platform'

const NEWS_SEEN_KEY = 'utbt:newsSeen:v1'

const ACCENTS: Record<string, SectionAccent> = {
    worldRecords: { tick: 'bg-blue-400' },
    hotMaps: { tick: 'bg-accent-400' },
    newMaps: { tick: 'bg-accent-400' },
    news: { tick: 'bg-accent-400' },
    reviews: { tick: 'bg-orange-300' },
    caps: { tick: 'bg-amber-400' },
    personal: { tick: 'bg-amber-400' },
    medalHunt: { tick: 'bg-red-500 shadow-[0_0_10px_rgba(248,113,113,0.65)]' },
    achievements: { tick: 'bg-emerald-400' },
    recentServers: { tick: 'bg-violet-400' },
}

export interface HomePageCaches {
    summary: Summary | null
    hotMaps: HotMap[]
    news: NewsArticle[]
    newsCategories: NewsCategoryDef[]
    userSummary: UserSummary | null
    servers: Server[] | null
    medalHunt: MedalHuntOpportunity[] | null
    mapsCount: number | null
    playersCount: number | null
    pendingReviews: PendingReviewsPage | null
    lastRefreshIso: string | null
}

export const DEFAULT_HOME_CACHES: HomePageCaches = {
    summary: null,
    hotMaps: [],
    news: [],
    newsCategories: [],
    userSummary: null,
    servers: null,
    medalHunt: null,
    mapsCount: null,
    playersCount: null,
    pendingReviews: null,
    lastRefreshIso: null,
}

interface HomeProps {
    userProfile?: UserProfile
    installationStatus?: 'valid' | 'no-install' | 'unsupported' | null
    favoriteMapNames: Set<string>
    caches: HomePageCaches
    onCachesChange: (updater: (prev: HomePageCaches) => HomePageCaches) => void
    achievementsCaches: AchievementsPageCaches
    onEnsureAchievements: (force?: boolean) => void
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
    userProfile, installationStatus, favoriteMapNames,
    caches, onCachesChange, achievementsCaches, onEnsureAchievements,
    onToggleFavorite, onMapSelect,
    onViewServers, onViewMaps, onViewNewMaps, onViewWorldRecords, onViewPlayers, onViewNews,
}: HomeProps) {
    const refreshCooldown = useRefreshCooldown()
    const { summary, hotMaps, news, newsCategories, userSummary, servers } = caches
    const hasCachedData = summary !== null
    const [newsSeen] = useState<string | null>(() => localStorage.getItem(NEWS_SEEN_KEY))
    const [loading, setLoading] = useState(!hasCachedData)
    const [error, setError] = useState<string | null>(null)
    const [reviewOpen, setReviewOpen] = useState(false)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [launchError, setLaunchError] = useState<string | null>(null)
    const [activeReviewMap, setActiveReviewMap] = useState<string | null>(null)
    const [recentServers, setRecentServers] = useState<RecentServerEntry[]>(() => readRecentServers())
    const [reviewsRefreshKey, setReviewsRefreshKey] = useState(0)
    const [refreshKey, setRefreshKey] = useState(0)
    const mountedRef = useRef(true)

    const replay = useReplayWatch()

    const loadData = useCallback(async (isActive: () => boolean = () => true) => {
        if (!userProfile?.accessToken) return
        setLoading(true)
        setError(null)
        try {
            const [summaryData, hotMapsData, newsData, newsCategoryData, serverData, userSummaryData] = await Promise.all([
                fetchSummary(userProfile.accessToken),
                fetchHotMaps(userProfile.accessToken).catch(() => [] as HotMap[]),
                fetchNews(userProfile.accessToken).catch(() => [] as NewsArticle[]),
                fetchNewsCategories(userProfile.accessToken).catch(() => [] as NewsCategoryDef[]),
                fetchGatewayServers<Server[]>().catch(() => [] as Server[]),
                userProfile.id
                    ? fetchUserSummary(userProfile.accessToken, userProfile.id).catch(() => null as UserSummary | null)
                    : Promise.resolve(null),
            ])
            if (!isActive()) return
            onCachesChange(prev => ({
                ...prev,
                summary: summaryData,
                hotMaps: hotMapsData,
                news: newsData,
                newsCategories: newsCategoryData,
                servers: serverData,
                userSummary: userSummaryData,
                lastRefreshIso: new Date().toISOString(),
            }))
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
    }, [userProfile?.accessToken, userProfile?.id, onCachesChange])

    useEffect(() => {
        if (!userProfile?.accessToken) {
            setLoading(false)
            return
        }
        if (hasCachedData) {
            setLoading(false)
            return
        }
        let cancelled = false
        loadData(() => !cancelled)
        return () => { cancelled = true }
    }, [userProfile?.accessToken, hasCachedData, loadData])

    useEffect(() => {
        if (!userProfile?.accessToken) return
        onEnsureAchievements()
    }, [userProfile?.accessToken, onEnsureAchievements])

    useEffect(() => () => { mountedRef.current = false }, [])

    const handleMedalHuntLoaded = useCallback((rows: MedalHuntOpportunity[]) => {
        onCachesChange(prev => ({ ...prev, medalHunt: rows }))
    }, [onCachesChange])

    const handleCountsLoaded = useCallback((counts: { mapsCount: number | null; playersCount: number | null }) => {
        onCachesChange(prev => ({ ...prev, mapsCount: counts.mapsCount, playersCount: counts.playersCount }))
    }, [onCachesChange])

    const handlePendingReviewsLoaded = useCallback((page: PendingReviewsPage) => {
        onCachesChange(prev => ({ ...prev, pendingReviews: page }))
    }, [onCachesChange])

    useRegisterPageRefresh({
        onRefresh: () => refreshCooldown.trigger(() => {
            onCachesChange(prev => ({
                ...prev,
                medalHunt: null,
                mapsCount: null,
                playersCount: null,
                pendingReviews: null,
            }))
            loadData(() => mountedRef.current)
            onEnsureAchievements(true)
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

    const handleJoinServer = async (server: Server | RecentServerEntry, asSpectator: boolean) => {
        if (!capabilities.game) return
        try {
            if (window.conveyor?.ini) {
                if (asSpectator) {
                    await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'OverrideClass', 'Botpack.CHSpectator')
                } else {
                    const currentClass = await window.conveyor.ini.readIniValue('User.ini', 'DefaultPlayer', 'Class')
                    if (currentClass === 'Botpack.CHSpectator') {
                        await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'Class', '')
                    }
                    await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'OverrideClass', '')
                }
            }
            await window.conveyor.game.launchGame(server.ip, server.hostport)
            setRecentServers(rememberRecentServer(server))
        } catch (err) {
            console.error('Failed to launch game:', err)
            setLaunchError(err instanceof Error ? err.message : 'Failed to launch the game.')
        }
    }

    const newsFeed = useMemo(() => news.slice(0, 5), [news])
    const newsCategoryMap = useMemo(() => new Map(newsCategories.map(c => [c.key, c])), [newsCategories])
    const achievementDefinitionMap = useMemo(
        () => new Map(achievementsCaches.definitions.map(d => [d.code, d])),
        [achievementsCaches.definitions],
    )

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
                    className="lg:col-span-6"
                    userId={userProfile.id ?? undefined}
                    alias={userProfile.alias}
                    title={userProfile.active_title ?? null}
                    worldRecords={userSummary?.medals.world_records ?? null}
                />
                <CommunityStatsRow
                    className="lg:col-span-6"
                    accessToken={userProfile.accessToken}
                    playersOnline={playersOnline}
                    newMaps={data.global.newMaps}
                    totalMaps={caches.mapsCount}
                    totalPlayers={caches.playersCount}
                    onCountsLoaded={handleCountsLoaded}
                    onViewPlayers={onViewPlayers}
                    onViewServers={onViewServers}
                    onViewMaps={onViewMaps}
                    onViewNewMaps={onViewNewMaps}
                    refreshKey={refreshKey}
                />
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    {newsFeed.length > 0 && (
                        <SpotlightSection
                            title="Latest News"
                            accent={ACCENTS.news}
                            actionLabel={onViewNews ? 'See All' : undefined}
                            onAction={onViewNews}
                            className="lg:col-span-6"
                        >
                            <NewsCard
                                articles={newsFeed}
                                categories={newsCategoryMap}
                                newSince={newsSeen}
                                className="grid grid-cols-1 md:grid-cols-1 gap-3 space-y-0 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.25)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-hairline/20"
                            />
                        </SpotlightSection>
                    )}

                    <SpotlightSection
                        title="Your Recent Servers"
                        accent={ACCENTS.recentServers}
                        actionLabel="See All"
                        onAction={onViewServers}
                        className="lg:col-span-6"
                    >
                        <RecentServersCard
                            recentServers={recentServers}
                            liveServers={servers ?? []}
                            installationStatus={installationStatus}
                            onJoin={handleJoinServer}
                            onHide={(serverId) => setRecentServers(forgetRecentServer(serverId))}
                        />
                    </SpotlightSection>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    <SpotlightSection title="Your Progress" accent={ACCENTS.personal} className="lg:col-span-6">
                        <PersonalProgressSnapshot summary={userSummary} />
                    </SpotlightSection>
                    <SpotlightSection title="Achievement Progress" accent={ACCENTS.achievements} className="lg:col-span-6">
                        <AchievementProgressPreview
                            achievements={achievementsCaches.progress}
                            definitions={achievementDefinitionMap}
                        />
                    </SpotlightSection>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                    <SpotlightSection title="Medal Hunt" accent={ACCENTS.medalHunt} className="lg:col-span-6">
                        <MedalHuntCard
                            accessToken={userProfile.accessToken}
                            userId={userProfile.id}
                            refreshKey={refreshKey}
                            rows={caches.medalHunt}
                            onRowsLoaded={handleMedalHuntLoaded}
                            favoriteMapNames={favoriteMapNames}
                            onToggleFavorite={onToggleFavorite}
                            onMapSelect={onMapSelect}
                        />
                    </SpotlightSection>
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
                </div>

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
                            firstPage={caches.pendingReviews}
                            onFirstPageLoaded={handlePendingReviewsLoaded}
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

            <Modal
                isOpen={launchError !== null}
                onClose={() => setLaunchError(null)}
                title="Launch Error"
                className="w-[95%] sm:w-[440px] max-w-md"
                offsetSidebar
            >
                <p className="text-sm text-muted-foreground">{launchError}</p>
            </Modal>
        </div>
    )
}
