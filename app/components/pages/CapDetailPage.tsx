import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { Tooltip } from '@/app/components/ui/tooltip'
import { Modal } from '@/app/components/ui/modal'
import { ReplayVideoModal } from '@/app/components/shared/ReplayVideoModal'
import { DemoDownloadStatusModal } from '@/app/components/shared/DemoDownloadStatusModal'
import { useAsync } from '@/app/hooks/useAsync'
import { useRefreshCooldown } from '@/app/hooks/useRefreshCooldown'
import { useReplayWatch } from '@/app/hooks/useReplayWatch'
import { useDemoDownload } from '@/app/hooks/useDemoDownload'
import { formatCapTime } from '@/app/utils/format'
import {
    fetchCapDetail,
    fetchCapCheckpoints,
    type CapDetail,
    type CapCompareCandidate,
    type LeaderboardEntry,
    type UserProfile,
} from '@/app/utils/api'
import { HeroSection } from './capDetail/HeroSection'
import { CheckpointSplitsCard } from './capDetail/CheckpointSplitsCard'
import { RankContextCard } from './capDetail/RankContextCard'
import { MedalThresholdsStrip } from './capDetail/MedalThresholdsStrip'
import { ClientSettingsGrid } from './capDetail/ClientSettingsGrid'
import { MovementAnalyticsCard } from './capDetail/MovementAnalyticsCard'

interface CapDetailPageProps {
    capId: string
    onBack: () => void
    userProfile?: UserProfile
    onMapSelect?: (mapName: string) => void
}

function nearestCandidate(cands: CapCompareCandidate[], capTime: number): CapCompareCandidate | null {
    let faster: CapCompareCandidate | null = null
    let slower: CapCompareCandidate | null = null
    for (const c of cands) {
        if (c.cap_time_seconds === capTime) return c
        if (c.cap_time_seconds < capTime) {
            if (!faster || c.cap_time_seconds > faster.cap_time_seconds) faster = c
        } else if (!slower || c.cap_time_seconds < slower.cap_time_seconds) {
            slower = c
        }
    }
    return faster ?? slower ?? cands[0] ?? null
}

export function CapDetailPage({ capId, onBack, userProfile, onMapSelect }: CapDetailPageProps) {
    const accessToken = userProfile?.accessToken
    const currentUserId = userProfile?.id ?? undefined
    const refreshCooldown = useRefreshCooldown()
    const [refreshKey, setRefreshKey] = useState(0)

    const replay = useReplayWatch()
    const demoDownload = useDemoDownload()

    const { data: detail, loading, error } = useAsync<CapDetail | null>(
        () => fetchCapDetail(accessToken!, capId),
        [accessToken, capId, refreshKey],
        { enabled: !!accessToken && !!capId, errorMessage: 'Failed to load cap data.' },
    )

    const [compareCapId, setCompareCapId] = useState<string | null>(null)
    const [compareData, setCompareData] = useState<{ checkpoints: CapDetail['checkpoints']; cap_time_seconds: number; alias: string | null } | null>(null)
    const [comparing, setComparing] = useState(false)

    const defaultedFor = useRef<string | null>(null)
    useEffect(() => {
        defaultedFor.current = null
        setCompareCapId(null)
        setCompareData(null)
    }, [capId])

    useEffect(() => {
        // Only default once the loaded detail belongs to THIS cap — otherwise a
        // stale (previous cap's) detail would seed the wrong comparison.
        if (!detail || detail.cap.id !== capId || defaultedFor.current === capId) return
        defaultedFor.current = capId
        setCompareCapId(nearestCandidate(detail.compare_candidates, detail.cap.cap_time_seconds)?.id ?? null)
    }, [detail, capId])

    useEffect(() => {
        if (!compareCapId || !accessToken) {
            setCompareData(null)
            return
        }
        let cancelled = false
        setComparing(true)
        fetchCapCheckpoints(accessToken, compareCapId)
            .then(d => { if (!cancelled) setCompareData(d) })
            .finally(() => { if (!cancelled) setComparing(false) })
        return () => { cancelled = true }
    }, [compareCapId, accessToken])

    const compareOptions = useMemo(
        () => (detail?.compare_candidates ?? [])
            .map(c => ({ id: c.id, label: `${c.alias ?? c.user} — ${formatCapTime(c.cap_time_seconds)}` })),
        [detail],
    )

    const cap = detail?.cap
    const nextFaster = detail?.neighbors.above?.[0]
    const gapToNext = nextFaster && cap
        ? cap.cap_time_seconds - nextFaster.cap_time_seconds
        : null

    const isWr = !!detail && (detail.wr_cap_id === capId || detail.rank_on_map === 1)

    const baseline = compareData ? compareData.checkpoints : []
    const baselineTime = compareData ? compareData.cap_time_seconds : null
    const baselineLabel = compareData ? (compareData.alias ?? 'Run') : ''

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
                <Tooltip content={refreshCooldown.canRefresh ? 'Refresh' : `Wait ${refreshCooldown.remainingSeconds}s`} side="top">
                    <button
                        type="button"
                        onClick={() => refreshCooldown.trigger(() => setRefreshKey(k => k + 1))}
                        disabled={loading || !refreshCooldown.canRefresh}
                        className="p-2 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        aria-label="Refresh"
                    >
                        <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </Tooltip>
            </div>

            {loading && !detail ? (
                <div className="bg-card/30 border border-white/5 rounded-xl h-56 animate-pulse shrink-0" />
            ) : !detail || !cap ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                        <div className="text-lg font-semibold text-white mb-1">Cap not found</div>
                        <div className="text-sm">{error ?? 'This run could not be loaded.'}</div>
                    </div>
                </div>
            ) : (
                <>
                    <HeroSection
                        cap={cap}
                        mapName={cap.map}
                        rank={detail.rank_on_map}
                        total={detail.total_on_map}
                        deltaWr={detail.deltas.wr}
                        gapToNext={gapToNext}
                        isWr={isWr}
                        onMapSelect={onMapSelect}
                        onWatch={() => replay.openReplay({
                            capId: cap.id,
                            mapName: cap.map,
                            time: cap.cap_time_seconds,
                            alias: cap.alias ?? undefined,
                        })}
                        watching={replay.loadingCapId === cap.id}
                        canWatch={cap.verified}
                        onDownload={() => demoDownload.start(
                            {
                                id: cap.id,
                                alias: cap.alias ?? '',
                                cap_time_seconds: cap.cap_time_seconds,
                                map: cap.map,
                            } as LeaderboardEntry,
                            cap.map,
                        )}
                    />

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm shrink-0">
                            {error}
                        </div>
                    )}

                    <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
                        <ClientSettingsGrid cap={cap} server={detail.server} />

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                            <RankContextCard
                                rank={detail.rank_on_map}
                                total={detail.total_on_map}
                                capTime={cap.cap_time_seconds}
                                capUser={cap.user}
                                capAlias={cap.alias}
                                capTitle={cap.active_title}
                                neighbors={detail.neighbors}
                                currentUserId={currentUserId}
                            />
                            <MovementAnalyticsCard cap={cap} />
                        </div>

                        <MedalThresholdsStrip medals={detail.medals} deltas={detail.deltas} />

                        <CheckpointSplitsCard
                            hasCheckpoints={detail.has_checkpoints}
                            checkpoints={detail.checkpoints}
                            capTime={cap.cap_time_seconds}
                            baseline={baseline}
                            baselineTime={baselineTime}
                            baselineLabel={baselineLabel}
                            compareOptions={compareOptions}
                            selectedCompareId={compareCapId}
                            onSelectCompare={setCompareCapId}
                            comparing={comparing}
                        />
                    </div>
                </>
            )}

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

            <DemoDownloadStatusModal
                state={demoDownload.download}
                onClose={demoDownload.clear}
            />
        </div>
    )
}
