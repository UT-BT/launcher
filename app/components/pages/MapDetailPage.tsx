import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { requestLogin } from '@/app/components/shared/AuthRequiredModal'
import { AlertTriangle } from 'lucide-react'
import { useNavScrollRestore } from '@/app/components/navigation/useNavScrollRestore'
import {
    fetchMap,
    fetchMapLeaderboard,
    fetchTeamMapLeaderboard,
    fetchMapReviews,
    fetchPlaytimeForMap,
    fetchWorldRecordProgression,
    fetchUserCapCountForMap,
    fetchUserTeamMapStats,
    type LeaderboardEntry,
    type TeamLeaderboardEntry,
    type TeamMapUserStats,
    type MapMetadata,
    type MapReview,
    type Playtime,
    type WorldRecordProgressionEntry,
    type UserProfile,
} from '@/app/utils/api'
import { useRefreshCooldown } from '@/app/hooks/useRefreshCooldown'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import { useMapDownload } from '@/app/hooks/useMapDownload'
import { MapDownloadStatusModal } from '@/app/components/shared/MapDownloadStatusModal'
import { ReviewModal } from '@/app/components/modals/ReviewModal'
import { MapScreenshotModal } from '@/app/components/modals/MapScreenshotModal'
import { isStaff } from '@/app/utils/roles'
import { PlaytimeBreakdownModal } from '@/app/components/modals/PlaytimeBreakdownModal'
import { CapTimeDistributionModal } from '@/app/components/modals/CapTimeDistributionModal'
import { HeroSection } from './mapDetail/HeroSection'
import { StatsRow } from './mapDetail/StatsRow'
import { YourStatsCard } from './mapDetail/YourStatsCard'
import { MedalCard } from './mapDetail/MedalCard'
import { LeaderboardCard } from './mapDetail/LeaderboardCard'
import { ReviewsCard } from './mapDetail/ReviewsCard'

const ActivityChart = lazy(() => import('./mapDetail/ActivityChart'))
const WorldRecordProgressionModal = lazy(() => import('@/app/components/modals/WorldRecordProgressionModal').then(m => ({ default: m.WorldRecordProgressionModal })))

interface MapDetailPageProps {
    mapName: string
    userProfile?: UserProfile
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
}

const MAP_METADATA_COLUMNS = [
    'name', 'added', 'difficulty', 'active', 'tags', 'author', 'author_str', 'author_ref',
    'world_record', 'champion_medal', 'gold_medal', 'silver_medal', 'bronze_medal',
    'required_players', 'url', 'preceded_by', 'superseded_by', 'changelog',
    'has_screenshot', 'screenshot_updated',
]

export function MapDetailPage({
    mapName, userProfile, favoriteMapNames, onToggleFavorite, onMapSelect,
}: MapDetailPageProps) {
    const accessToken = userProfile?.accessToken
    const browseToken = accessToken ?? ''
    const currentUserId = userProfile?.id ?? undefined

    const [map, setMap] = useState<MapMetadata | null>(null)
    const requiredPlayers = map?.name === mapName ? map.required_players : undefined
    const isTeam = (requiredPlayers ?? 1) > 1
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [teamLeaderboard, setTeamLeaderboard] = useState<TeamLeaderboardEntry[]>([])
    const [reviews, setReviews] = useState<MapReview[]>([])
    const [playtime, setPlaytime] = useState<Playtime[]>([])
    const [wrProgression, setWrProgression] = useState<WorldRecordProgressionEntry[]>([])
    const [userCapCount, setUserCapCount] = useState<number | null>(null)
    const [teamStats, setTeamStats] = useState<TeamMapUserStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [reviewModalOpen, setReviewModalOpen] = useState(false)
    const [screenshotModalOpen, setScreenshotModalOpen] = useState(false)
    const [wrModalOpen, setWrModalOpen] = useState(false)
    const [playtimeModalOpen, setPlaytimeModalOpen] = useState(false)
    const [distributionModalOpen, setDistributionModalOpen] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)
    const refreshCooldown = useRefreshCooldown()
    const mapDownload = useMapDownload()

    useRegisterPageRefresh({
        onRefresh: () => refreshCooldown.trigger(() => setRefreshKey(k => k + 1)),
        refreshing: loading,
        disabled: !refreshCooldown.canRefresh,
        tooltip: refreshCooldown.canRefresh ? 'Refresh' : `Wait ${refreshCooldown.remainingSeconds}s`,
    })

    const wrHolder = wrProgression.length > 0 ? wrProgression[wrProgression.length - 1] : null

    useEffect(() => {
        let cancelled = false

        setLoading(true)
        setError(null)
        setUserCapCount(null)
        setTeamStats(null)
        ;(async () => {
            try {
                const matched = await fetchMap(browseToken, mapName, MAP_METADATA_COLUMNS)
                if (!matched) throw new Error(`Map metadata not found for ${mapName}`)
                const teamMap = matched.required_players > 1
                const [lb, teamLb, rv, pt, wr, capCount, teamUserStats] = await Promise.all([
                    fetchMapLeaderboard(browseToken, mapName, false),
                    teamMap
                        ? fetchTeamMapLeaderboard(browseToken, mapName)
                        : Promise.resolve([] as TeamLeaderboardEntry[]),
                    fetchMapReviews(browseToken, mapName),
                    fetchPlaytimeForMap(browseToken, mapName),
                    fetchWorldRecordProgression(browseToken, mapName),
                    currentUserId != null
                        ? fetchUserCapCountForMap(browseToken, currentUserId, mapName)
                        : Promise.resolve(0),
                    teamMap && currentUserId != null
                        ? fetchUserTeamMapStats(browseToken, currentUserId, mapName)
                        : Promise.resolve(null),
                ])
                if (cancelled) return
                setMap(matched)
                setLeaderboard(lb)
                setTeamLeaderboard(teamLb)
                setReviews(rv)
                setPlaytime(pt)
                setWrProgression(wr)
                setUserCapCount(capCount)
                setTeamStats(teamUserStats)
            } catch (e) {
                if (cancelled) return
                console.error('Failed to load map detail:', e)
                setError('Failed to load map data.')
            } finally {
                if (!cancelled) setLoading(false)
            }
        })()
        return () => { cancelled = true }
    }, [browseToken, mapName, currentUserId, refreshKey])

    const avgOverall = useMemo(() => {
        if (reviews.length === 0) return null
        return reviews.reduce((sum, r) => sum + r.overall, 0) / reviews.length
    }, [reviews])

    const myReview = useMemo(() => {
        if (!currentUserId) return undefined
        const idStr = String(currentUserId)
        return reviews.find(r => String(r.user) === idStr)
    }, [reviews, currentUserId])

    const initialReviewScores = myReview ? {
        aesthetics: myReview.aesthetics,
        learning: myReview.learning,
        luck: myReview.luck,
        difficulty: myReview.difficulty,
        overall: myReview.overall,
    } : undefined

    const isInactive = map?.active === false
    const isMapAuthor = currentUserId != null && map?.author_ref != null && String(map.author_ref) === String(currentUserId)
    const canEditScreenshot = !!accessToken && (isStaff(userProfile) || (isMapAuthor && !isInactive))

    const scrollRef = useRef<HTMLDivElement>(null)
    const onScroll = useNavScrollRestore(scrollRef, !loading)

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-0 duration-500">

            <HeroSection
                mapName={mapName}
                map={map}
                avgOverall={avgOverall}
                reviewCount={reviews.length}
                isFavorited={favoriteMapNames.has(mapName)}
                onToggleFavorite={onToggleFavorite}
                accessToken={accessToken}
                onMapSelect={onMapSelect}
                requiredPlayers={requiredPlayers}
                canEditScreenshot={canEditScreenshot}
                onEditScreenshot={() => setScreenshotModalOpen(true)}
                onDownload={() => mapDownload.start(mapName)}
                isDownloading={mapDownload.download?.status === 'downloading'}
                chart={
                    <Suspense fallback={<div className="h-full min-h-[100px] bg-hairline/[0.02] border border-hairline/5 rounded-lg animate-pulse" />}>
                        <ActivityChart leaderboard={leaderboard} playtime={playtime} />
                    </Suspense>
                }
            />

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm shrink-0">
                    {error}
                </div>
            )}

            {isInactive && (
                <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-200 text-sm shrink-0">
                    <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                    <div className="leading-snug">
                        <div className="font-semibold">This version is no longer in rotation.</div>
                        <div className="text-xs text-amber-200/80">
                            A newer version supersedes it. Records and reviews are read-only.
                        </div>
                    </div>
                </div>
            )}

            <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
                <StatsRow
                    leaderboard={leaderboard}
                    playtime={playtime}
                    loading={loading}
                    isTeam={isTeam}
                    teamLeaderboard={teamLeaderboard}
                    onShowPlaytimeBreakdown={() => setPlaytimeModalOpen(true)}
                    onShowCapDistribution={() => setDistributionModalOpen(true)}
                />

                {currentUserId != null && (
                    <YourStatsCard
                        currentUserId={currentUserId}
                        leaderboard={leaderboard}
                        playtime={playtime}
                        totalCaps={userCapCount}
                        loading={loading}
                        onShowPlaytimeBreakdown={() => setPlaytimeModalOpen(true)}
                        isTeamMap={isTeam}
                        teamStats={teamStats}
                    />
                )}                {currentUserId == null && (
                    <div className="rounded-xl border border-accent-500/25 bg-accent-500/[0.06] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold text-foreground">Your stats, right here</div>
                            <p className="mt-1 text-xs text-muted-foreground">Sign in to see your personal best, medal, playtime, and progress on this map.</p>
                        </div>
                        <button type="button" onClick={() => requestLogin({ feature: 'view your map stats' })} className="shrink-0 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer">Sign in</button>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-4 space-y-4">
                        <MedalCard
                            map={map}
                            loading={loading}
                            requiredPlayers={requiredPlayers}
                            teamLeaderboard={teamLeaderboard}
                        />
                        <ReviewsCard
                            reviews={reviews}
                            currentUserId={currentUserId ?? undefined}
                            loading={loading}
                            canSubmit={!isInactive}
                            onOpenReviewModal={() => accessToken ? setReviewModalOpen(true) : requestLogin({ feature: 'review maps' })}
                        />
                    </div>
                    <div className="lg:col-span-8 space-y-4">
                        <LeaderboardCard
                            leaderboard={leaderboard}
                            teamLeaderboard={teamLeaderboard}
                            requiredPlayers={requiredPlayers}
                            map={map}
                            loading={loading}
                            currentUserId={currentUserId ?? undefined}
                            wrCapId={wrHolder?.cap_id ?? null}
                            onShowWrHistory={wrProgression.length > 0 ? () => setWrModalOpen(true) : undefined}
                        />
                    </div>
                </div>
            </div>

            <ReviewModal
                open={reviewModalOpen}
                onOpenChange={setReviewModalOpen}
                accessToken={accessToken}
                mapName={mapName}
                initialScores={initialReviewScores}
                onSuccess={() => setRefreshKey(k => k + 1)}
            />

            <MapScreenshotModal
                open={screenshotModalOpen}
                onClose={() => setScreenshotModalOpen(false)}
                accessToken={accessToken}
                mapName={mapName}
                hasScreenshot={!!map?.has_screenshot}
                screenshotVersion={map?.screenshot_updated}
                onUploaded={updated => setMap(prev => prev ? {
                    ...prev,
                    has_screenshot: updated.has_screenshot,
                    screenshot_updated: updated.screenshot_updated,
                } : prev)}
            />

            <Suspense fallback={null}>
                <WorldRecordProgressionModal
                    isOpen={wrModalOpen}
                    onClose={() => setWrModalOpen(false)}
                    mapName={mapName}
                    entries={wrProgression}
                    currentUserId={currentUserId ?? undefined}
                />
            </Suspense>

            <PlaytimeBreakdownModal
                open={playtimeModalOpen}
                onClose={() => setPlaytimeModalOpen(false)}
                mapName={mapName}
                playtime={playtime}
                currentUserId={currentUserId ?? undefined}
            />

            <CapTimeDistributionModal
                open={distributionModalOpen}
                onClose={() => setDistributionModalOpen(false)}
                mapName={mapName}
                leaderboard={leaderboard}
                map={map}
                currentUserId={currentUserId ?? undefined}
                isTeam={isTeam}
                teamLeaderboard={teamLeaderboard}
            />

            <MapDownloadStatusModal
                state={mapDownload.download}
                onClose={mapDownload.clear}
            />
        </div>
    )
}
