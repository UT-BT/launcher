import { useMemo, useState, useEffect } from 'react'
import { Activity, AlertTriangle, RefreshCw } from 'lucide-react'
import {
    UserProfile, fetchSummary, Summary, SummaryWorldRecord, ActiveTitle,
} from '@/app/utils/api'
import { Button } from '@/app/components/ui/button'
import { Modal } from '@/app/components/ui/modal'
import { HistoryModal } from '@/app/components/modals/HistoryModal'
import { ReviewModal } from '@/app/components/modals/ReviewModal'
import { ChangeTitleModal } from '@/app/components/modals/ChangeTitleModal'
import { ReplayVideoModal } from '@/app/components/shared/ReplayVideoModal'
import { useReplayWatch } from '@/app/hooks/useReplayWatch'

import { ProfileHero } from './home/ProfileHero'
import { PatchBanner } from './home/PatchBanner'
import { RecentWorldRecords } from './home/RecentWorldRecords'
import { NewMapsCard } from './home/NewMapsCard'
import { RecentCapsCard } from './home/RecentCapsCard'
import { PendingReviewsCard } from './home/PendingReviewsCard'
import { SectionHeader } from './home/SectionHeader'

interface HomeProps {
    userProfile?: UserProfile
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
    onViewServers?: () => void
    onViewMaps?: () => void
    installationStatus?: 'valid' | 'no-install' | 'unsupported' | null
}

const EMPTY_SUMMARY: Summary = {
    playtime: { weekly: 0, weeklyTop: null, monthly: 0, monthlyTop: null, yearly: 0, yearlyTop: null },
    global: { newMaps: 0, newRecords: 0 },
    achievements: [],
    pendingReviews: [],
    topServers: [],
    recentWorldRecords: [],
    newMaps: [],
}

export function Home({
    userProfile, favoriteMapNames, onToggleFavorite, onMapSelect,
    onViewServers, onViewMaps,
}: HomeProps) {
    const username = userProfile?.alias || userProfile?.username || 'Player'
    const [summary, setSummary] = useState<Summary | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [historyOpen, setHistoryOpen] = useState(false)
    const [reviewOpen, setReviewOpen] = useState(false)
    const [activeReviewMap, setActiveReviewMap] = useState<string | null>(null)
    const [pendingReviewsRefreshKey, setPendingReviewsRefreshKey] = useState(0)
    const [changeTitleOpen, setChangeTitleOpen] = useState(false)
    const [dismissedPatch, setDismissedPatch] = useState<string | null>(
        typeof window !== 'undefined' ? localStorage.getItem('dismissed-patch') : null,
    )
    const [installedPatch, setInstalledPatch] = useState<string | null>(null)

    const replay = useReplayWatch()

    const latestPatch = summary?.latestPatch
    const lastLoginIso = userProfile?.latest_activity?.created_at

    const showPatchBanner = useMemo(() => {
        if (!latestPatch || !lastLoginIso) return false
        if (dismissedPatch === latestPatch.tag) return false
        if (installedPatch === latestPatch.tag) return false
        try {
            return new Date(latestPatch.added) > new Date(lastLoginIso)
        } catch {
            return false
        }
    }, [latestPatch, lastLoginIso, dismissedPatch, installedPatch])

    const loadData = async () => {
        if (!userProfile?.accessToken) return
        setLoading(true)
        setError(null)
        try {
            const [summaryData, currentPatch] = await Promise.all([
                fetchSummary(userProfile.accessToken),
                window.conveyor.app.getInstalledPatch(),
            ])
            setSummary(summaryData)
            setInstalledPatch(currentPatch?.tag || null)
        } catch (err) {
            console.error('Failed to load summary:', err)
            setError('Failed to load personalized feed.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (userProfile?.accessToken) {
            loadData()
        } else {
            setLoading(false)
        }
    }, [userProfile?.accessToken])

    const handleDismissPatch = (tag: string) => {
        setDismissedPatch(tag)
        localStorage.setItem('dismissed-patch', tag)
    }

    const handleInstallPatch = () => {
        window.dispatchEvent(new CustomEvent('open-settings', { detail: { section: 'game-installation' } }))
    }

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

    if (!userProfile) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="text-center space-y-4">
                    <Activity className="size-12 text-muted-foreground/20 mx-auto" />
                    <p className="text-muted-foreground font-medium">Please log in to view your personalized feed.</p>
                </div>
            </div>
        )
    }

    if (loading && !summary) {
        return (
            <div className="space-y-6 pb-12 pt-2">
                <div className="h-28 bg-white/5 rounded-2xl animate-pulse" />
                <div className="h-14 bg-white/5 rounded-xl animate-pulse" />
                <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6">
                    <div className="2xl:col-span-6 h-[420px] bg-white/5 rounded-xl animate-pulse" />
                    <div className="2xl:col-span-6 h-[420px] bg-white/5 rounded-xl animate-pulse" />
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
                    <Button onClick={loadData} variant="outline" className="gap-2">
                        <RefreshCw className="size-4" /> Try Again
                    </Button>
                </div>
            </div>
        )
    }

    const data = summary ?? EMPTY_SUMMARY
    const topServers = data.topServers ?? []
    const recentWRs = data.recentWorldRecords ?? []
    const newMaps = data.newMaps ?? []

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-0 duration-500 pb-12 pt-2">
            {showPatchBanner && latestPatch && (
                <PatchBanner
                    tag={latestPatch.tag}
                    releaseNotesUrl={latestPatch.release_notes_url}
                    onInstall={handleInstallPatch}
                    onDismiss={() => handleDismissPatch(latestPatch.tag)}
                />
            )}

            <ProfileHero
                userId={userProfile.id ?? undefined}
                username={username}
                alias={userProfile.alias}
                title={(userProfile.active_title ?? null) as ActiveTitle | null}
                lastLoginIso={lastLoginIso}
                weekly={data.playtime.weekly}
                weeklyTop={data.playtime.weeklyTop}
                monthly={data.playtime.monthly}
                monthlyTop={data.playtime.monthlyTop}
                yearly={data.playtime.yearly}
                yearlyTop={data.playtime.yearlyTop}
                newMaps={data.global.newMaps}
                newRecords={data.global.newRecords}
                livePlayers={topServers.reduce((sum, s) => sum + s.player_count, 0)}
                onChangeTitle={() => setChangeTitleOpen(true)}
                onBrowseServers={onViewServers}
            />

            <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6 items-start">
                <section className="2xl:col-span-6 flex flex-col gap-3">
                    <SectionHeader
                        title="Your Recent Caps"
                        actionLabel="See More"
                        onAction={() => setHistoryOpen(true)}
                    />
                    <RecentCapsCard
                        achievements={data.achievements}
                        favoriteMapNames={favoriteMapNames}
                        onToggleFavorite={onToggleFavorite}
                        onMapSelect={onMapSelect}
                        onReview={handleReviewMap}
                    />
                </section>

                <section className="2xl:col-span-6 flex flex-col gap-3">
                    <SectionHeader title="Recent World Records" />
                    <RecentWorldRecords
                        records={recentWRs}
                        onMapSelect={onMapSelect}
                        onWatchReplay={handleWatchReplay}
                        loadingCapId={replay.loadingCapId}
                    />
                </section>
            </div>

            <div className="grid grid-cols-1 2xl:grid-cols-12 gap-6 items-start">
                <section className="2xl:col-span-6 flex flex-col gap-3">
                    <SectionHeader
                        title="Newest Maps"
                        actionLabel={onViewMaps ? 'See All' : undefined}
                        onAction={onViewMaps}
                    />
                    <NewMapsCard
                        maps={newMaps}
                        favoriteMapNames={favoriteMapNames}
                        onToggleFavorite={onToggleFavorite}
                        onMapSelect={onMapSelect}
                    />
                </section>

                <section className="2xl:col-span-6 flex flex-col gap-3">
                    <SectionHeader title="Pending Reviews" />
                    <PendingReviewsCard
                        accessToken={userProfile.accessToken}
                        refreshKey={pendingReviewsRefreshKey}
                        onReview={handleReviewMap}
                    />
                </section>
            </div>

            <HistoryModal
                open={historyOpen}
                onOpenChange={setHistoryOpen}
                accessToken={userProfile.accessToken}
                userAlias={userProfile.alias}
                favoriteMapNames={favoriteMapNames}
                onToggleFavorite={onToggleFavorite}
            />

            <ReviewModal
                open={reviewOpen}
                onOpenChange={setReviewOpen}
                accessToken={userProfile.accessToken}
                mapName={activeReviewMap}
                onSuccess={() => {
                    loadData()
                    setPendingReviewsRefreshKey(k => k + 1)
                }}
            />

            <ChangeTitleModal
                isOpen={changeTitleOpen}
                onClose={() => setChangeTitleOpen(false)}
                accessToken={userProfile.accessToken}
                userId={userProfile.id ?? undefined}
                currentTitleId={userProfile.active_title?.id ?? undefined}
                onTitleChanged={() => window.dispatchEvent(new CustomEvent('refresh-user-profile'))}
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
