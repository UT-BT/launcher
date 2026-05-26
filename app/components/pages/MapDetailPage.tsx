import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Tooltip } from '@/app/components/ui/tooltip'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { displayMapName } from '@/app/utils/format'
import {
    fetchMaps,
    fetchMapLeaderboard,
    fetchMapReviews,
    fetchPlaytimeForMap,
    type LeaderboardEntry,
    type MapMetadata,
    type MapReview,
    type Playtime,
    type UserProfile,
} from '@/app/utils/api'
import { ReviewModal } from '@/app/components/modals/ReviewModal'
import { HeroSection } from './mapDetail/HeroSection'
import { StatsRow } from './mapDetail/StatsRow'
import { MedalCard } from './mapDetail/MedalCard'
import { LeaderboardCard } from './mapDetail/LeaderboardCard'
import { ReviewsCard } from './mapDetail/ReviewsCard'

const ActivityChart = lazy(() => import('./mapDetail/ActivityChart'))

interface MapDetailPageProps {
    mapName: string
    onBack: () => void
    userProfile?: UserProfile
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
}

const MAP_METADATA_COLUMNS = [
    'name', 'added', 'difficulty', 'tags', 'author', 'author_str', 'author_ref',
    'world_record', 'champion_medal', 'gold_medal', 'silver_medal', 'bronze_medal',
    'url',
]

export function MapDetailPage({
    mapName, onBack, userProfile, favoriteMapNames, onToggleFavorite,
}: MapDetailPageProps) {
    const accessToken = userProfile?.accessToken
    const currentUserId = userProfile?.id ?? undefined

    const [map, setMap] = useState<MapMetadata | null>(null)
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
    const [reviews, setReviews] = useState<MapReview[]>([])
    const [playtime, setPlaytime] = useState<Playtime[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [reviewModalOpen, setReviewModalOpen] = useState(false)
    const [refreshKey, setRefreshKey] = useState(0)

    const load = useCallback(async () => {
        if (!accessToken) return
        setLoading(true)
        setError(null)
        try {
            const [maps, lb, rv, pt] = await Promise.all([
                fetchMaps(accessToken, { name: mapName, columns: MAP_METADATA_COLUMNS, active: undefined }),
                fetchMapLeaderboard(accessToken, mapName, false),
                fetchMapReviews(accessToken, mapName),
                fetchPlaytimeForMap(accessToken, mapName),
            ])
            const matched = maps.find(m => m.name === mapName) ?? maps[0] ?? null
            setMap(matched as MapMetadata | null)
            setLeaderboard(lb)
            setReviews(rv)
            setPlaytime(pt)
        } catch (e) {
            console.error('Failed to load map detail:', e)
            setError('Failed to load map data.')
        } finally {
            setLoading(false)
        }
    }, [accessToken, mapName])

    useEffect(() => {
        load()
    }, [load, refreshKey])

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

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-0 duration-500">
            <div className="flex items-center justify-between gap-3 shrink-0">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={onBack}
                    className="text-muted-foreground hover:text-white -ml-2"
                >
                    <ArrowLeft className="size-4 mr-1" />
                    Back
                </Button>
                <Tooltip content="Refresh" side="top">
                    <button
                        type="button"
                        onClick={() => setRefreshKey(k => k + 1)}
                        disabled={loading}
                        className="p-2 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        aria-label="Refresh"
                    >
                        <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </Tooltip>
            </div>

            <HeroSection
                mapName={mapName}
                map={map}
                avgOverall={avgOverall}
                reviewCount={reviews.length}
                isFavorited={favoriteMapNames.has(mapName)}
                onToggleFavorite={onToggleFavorite}
                chart={
                    <Suspense fallback={<div className="h-full min-h-[100px] bg-white/[0.02] border border-white/5 rounded-lg animate-pulse" />}>
                        <ActivityChart leaderboard={leaderboard} playtime={playtime} />
                    </Suspense>
                }
            />

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm shrink-0">
                    {error}
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
                <StatsRow leaderboard={leaderboard} playtime={playtime} loading={loading} />

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                    <div className="lg:col-span-4 space-y-4">
                        <MedalCard map={map} loading={loading} />
                        <ReviewsCard
                            reviews={reviews}
                            currentUserId={currentUserId ?? undefined}
                            loading={loading}
                            canSubmit={!!accessToken}
                            onOpenReviewModal={() => setReviewModalOpen(true)}
                        />
                    </div>
                    <div className="lg:col-span-8">
                        <LeaderboardCard
                            leaderboard={leaderboard}
                            map={map}
                            loading={loading}
                            currentUserId={currentUserId ?? undefined}
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
        </div>
    )
}
