import { useRef, useState } from 'react'
import {
    Loader2, ShieldAlert, ShieldCheck, Play, Download, Calendar,
    Users, Trophy, ListOrdered, MapPin,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavScrollRestore } from '@/app/components/navigation/useNavScrollRestore'
import { Modal } from '@/app/components/ui/modal'
import { ReplayVideoModal } from '@/app/components/shared/ReplayVideoModal'
import { DemoDownloadStatusModal } from '@/app/components/shared/DemoDownloadStatusModal'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { Tooltip } from '@/app/components/ui/tooltip'
import { useAsync } from '@/app/hooks/useAsync'
import { useRefreshCooldown } from '@/app/hooks/useRefreshCooldown'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import { useReplayWatch } from '@/app/hooks/useReplayWatch'
import { useDemoDownload } from '@/app/hooks/useDemoDownload'
import { resolveCompareVideoUrl } from '@/app/hooks/useVideoCompareAvailability'
import { formatCapTime, displayMapName, formatAddedDate } from '@/app/utils/format'
import { medalIconForInt, medalLabelForInt, formatSignedDelta, deltaClass } from './capDetail/capStats'
import { MedalThresholdsStrip } from './capDetail/MedalThresholdsStrip'
import { ClientSettingsGrid } from './capDetail/ClientSettingsGrid'
import { MovementAnalyticsCard } from './capDetail/MovementAnalyticsCard'
import { VideoCompareModal, type CompareRun } from './capDetail/videoCompare/VideoCompareModal'
import {
    fetchTeamCapDetail,
    fetchCapCheckpoints,
    type TeamCapDetail,
    type LeaderboardEntry,
    type UserProfile,
} from '@/app/utils/api'

interface TeamCapDetailPageProps {
    teamCapId: string
    userProfile?: UserProfile
    onMapSelect?: (mapName: string) => void
}

type CompareState = 'idle' | 'resolving' | 'ready' | 'insufficient'

export function TeamCapDetailPage({ teamCapId, userProfile, onMapSelect }: TeamCapDetailPageProps) {
    const accessToken = userProfile?.accessToken
    const refreshCooldown = useRefreshCooldown()
    const [refreshKey, setRefreshKey] = useState(0)

    const replay = useReplayWatch()
    const demoDownload = useDemoDownload()

    const { data: detail, loading, error } = useAsync<TeamCapDetail | null>(
        (signal) => fetchTeamCapDetail(accessToken!, teamCapId, signal),
        [accessToken, teamCapId, refreshKey],
        { enabled: !!accessToken && !!teamCapId, errorMessage: 'Failed to load team run data.' },
    )

    useRegisterPageRefresh({
        onRefresh: () => refreshCooldown.trigger(() => setRefreshKey(k => k + 1)),
        refreshing: loading,
        disabled: !refreshCooldown.canRefresh,
        tooltip: refreshCooldown.canRefresh ? 'Refresh' : `Wait ${refreshCooldown.remainingSeconds}s`,
    })

    const [compareState, setCompareState] = useState<CompareState>('idle')
    const [compareRuns, setCompareRuns] = useState<CompareRun[] | null>(null)
    const compareReqRef = useRef(0)

    const [activeMemberTab, setActiveMemberTab] = useState<string | null>(null)
    const [demoBatch, setDemoBatch] = useState<{ total: number; done: number } | null>(null)

    const downloadAllDemos = async () => {
        if (!detail || demoBatch) return
        const withDemos = detail.members.filter(m => m.has_demo)
        if (withDemos.length === 0) return
        setDemoBatch({ total: withDemos.length, done: 0 })
        for (const member of withDemos) {
            await demoDownload.start(
                {
                    id: member.cap_id,
                    alias: member.alias ?? '',
                    cap_time_seconds: member.cap_time_seconds,
                    map: detail.map,
                } as LeaderboardEntry,
                detail.map,
            )
            setDemoBatch(prev => (prev ? { ...prev, done: prev.done + 1 } : prev))
        }
        setDemoBatch(null)
    }

    const startCompare = async () => {
        if (!detail || !accessToken) return
        const req = ++compareReqRef.current
        setCompareState('resolving')
        const resolved = await Promise.all(detail.members.map(async member => {
            const [url, cps] = await Promise.all([
                resolveCompareVideoUrl(member.cap_id),
                fetchCapCheckpoints(accessToken, member.cap_id),
            ])
            if (!url) return null
            return {
                capId: member.cap_id,
                alias: member.alias,
                userId: member.user,
                title: member.active_title,
                capTime: member.cap_time_seconds,
                checkpoints: cps?.checkpoints ?? [],
                url,
            } as CompareRun
        }))
        if (compareReqRef.current !== req) return
        const runs = resolved.filter((r): r is CompareRun => r != null)
        if (runs.length < 2) {
            setCompareRuns(null)
            setCompareState('insufficient')
            return
        }
        setCompareRuns(runs)
        setCompareState('ready')
    }

    const closeCompare = () => {
        compareReqRef.current++
        setCompareState('idle')
        setCompareRuns(null)
    }

    const scrollRef = useRef<HTMLDivElement>(null)
    const onScroll = useNavScrollRestore(scrollRef, !loading && !!detail)

    const showMedal = detail != null && detail.medal >= 1
    const medalIcon = detail ? medalIconForInt(detail.medal) : null
    const medalLabel = detail ? medalLabelForInt(detail.medal) : ''

    const isCombinationBest = !!detail && (detail.is_combination_best_verified || detail.is_combination_best_unverified)

    const members = detail?.members ?? []
    const membersWithDemos = members.filter(m => m.has_demo)
    const activeMemberId = (activeMemberTab && members.some(m => m.cap_id === activeMemberTab))
        ? activeMemberTab
        : (members[0]?.cap_id ?? null)
    const activeMember = members.find(m => m.cap_id === activeMemberId) ?? null

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-0 duration-500">

            {loading && !detail ? (
                <div className="bg-card/30 border border-hairline/5 rounded-xl h-56 animate-pulse shrink-0" />
            ) : !detail ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center text-muted-foreground">
                        <div className="text-lg font-semibold text-foreground mb-1">Team run not found</div>
                        <div className="text-sm">{error ?? 'This team run could not be loaded.'}</div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="bg-card/30 border border-hairline/5 rounded-xl overflow-hidden shrink-0">
                        <div className="flex flex-col lg:flex-row items-stretch">
                            <div className="lg:w-64 lg:h-64 shrink-0 p-2">
                                <button
                                    type="button"
                                    onClick={() => onMapSelect?.(detail.map)}
                                    className="block w-full h-full cursor-pointer"
                                    title={`Open ${displayMapName(detail.map)}`}
                                >
                                    <MapThumbnail
                                        mapName={detail.map}
                                        className="w-full h-full aspect-video lg:aspect-square rounded-lg border border-hairline/10"
                                    />
                                </button>
                            </div>

                            <div className="flex-1 p-4 flex flex-col justify-center gap-4 min-w-0">
                                <div className="flex items-start justify-between gap-3">
                                    <button
                                        type="button"
                                        onClick={() => onMapSelect?.(detail.map)}
                                        className="text-3xl font-bold text-foreground leading-tight truncate hover:underline decoration-dotted underline-offset-4 cursor-pointer text-left min-w-0"
                                    >
                                        {displayMapName(detail.map)}
                                    </button>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <button
                                            type="button"
                                            onClick={startCompare}
                                            disabled={compareState === 'resolving'}
                                            className={cn(
                                                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-colors text-xs font-semibold cursor-pointer',
                                                'bg-accent-500/15 border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:text-foreground hover:border-accent-500/60',
                                                'disabled:opacity-50 disabled:cursor-not-allowed',
                                            )}
                                            title="Watch every member's replay together"
                                        >
                                            {compareState === 'resolving'
                                                ? <Loader2 className="size-3.5 animate-spin" />
                                                : <Play className="size-3.5" />}
                                            Watch Team Replay
                                        </button>
                                        <button
                                            type="button"
                                            onClick={downloadAllDemos}
                                            disabled={membersWithDemos.length === 0 || demoBatch !== null}
                                            className={cn(
                                                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border transition-colors text-xs font-semibold cursor-pointer',
                                                'bg-hairline/[0.03] border-hairline/10 text-muted-foreground hover:text-foreground hover:bg-hairline/[0.06] hover:border-hairline/20',
                                                'disabled:opacity-50 disabled:cursor-not-allowed',
                                            )}
                                            title={membersWithDemos.length === 0 ? 'No demos available yet' : 'Download every available member demo'}
                                        >
                                            {demoBatch !== null
                                                ? <Loader2 className="size-3.5 animate-spin" />
                                                : <Download className="size-3.5" />}
                                            {demoBatch !== null ? `Downloading ${demoBatch.done}/${demoBatch.total}…` : 'Download Demos'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => onMapSelect?.(detail.map)}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-hairline/[0.03] border border-hairline/10 text-muted-foreground hover:text-foreground hover:bg-hairline/[0.06] hover:border-hairline/20 transition-colors text-xs font-semibold cursor-pointer"
                                        >
                                            <ListOrdered className="size-3.5" />
                                            Leaderboard
                                        </button>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Users className="size-4 shrink-0" />
                                    <span className="font-semibold text-foreground">{detail.team_size}-player team run</span>
                                </div>

                                <div className="flex items-stretch gap-5 pt-3 border-t border-hairline/5 flex-wrap">
                                    <div className="flex flex-col justify-between">
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Team Time</div>
                                        <div className="text-4xl font-bold font-mono tabular-nums text-foreground leading-none">
                                            {formatCapTime(detail.team_time_seconds)}
                                        </div>
                                    </div>
                                    <div className="self-stretch w-px bg-hairline/10" />
                                    <div className="flex flex-col justify-between text-left">
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Rank</div>
                                        <div className="text-lg font-bold font-mono tabular-nums leading-none">
                                            <span className="text-foreground">#{detail.rank_on_map}</span>{' '}
                                            <span className="text-[10px] text-muted-foreground font-normal">
                                                of {detail.total_on_map.toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="self-stretch w-px bg-hairline/10" />
                                    <div className="flex flex-col justify-between text-left">
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Standing</div>
                                        <div className="text-lg font-bold leading-none">
                                            {detail.is_world_record ? (
                                                <span className="inline-flex items-center gap-1.5 text-yellow-300">
                                                    <Trophy className="size-4" />
                                                    World Record
                                                </span>
                                            ) : isCombinationBest ? (
                                                <span className="text-emerald-300">Combination Best</span>
                                            ) : (
                                                <span className={cn('font-mono tabular-nums', deltaClass(detail.deltas.world_record))}>
                                                    Δ WR {formatSignedDelta(detail.deltas.world_record)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 flex-wrap">
                                    {showMedal && medalIcon && (
                                        <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-hairline/5 border border-hairline/10 text-xs font-semibold text-foreground">
                                            <img src={medalIcon} alt={medalLabel} className="size-4 object-contain" />
                                            {medalLabel}
                                        </span>
                                    )}
                                    {detail.disallowed ? (
                                        <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border text-xs font-semibold bg-red-500/15 border-red-500/40 text-red-300">
                                            <ShieldAlert className="size-3.5" />
                                            Disallowed
                                        </span>
                                    ) : (
                                        <span className={cn(
                                            'inline-flex items-center gap-1.5 h-7 px-2 rounded-md border text-xs font-semibold',
                                            detail.verified
                                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                                : 'bg-hairline/5 border-hairline/10 text-muted-foreground',
                                        )}>
                                            <ShieldCheck className="size-3.5" />
                                            {detail.verified ? 'Verified' : 'Unverified'}
                                        </span>
                                    )}
                                    <span className={cn(
                                        'inline-flex items-center gap-1.5 h-7 px-2 rounded-md border text-xs font-semibold',
                                        detail.complete
                                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                            : 'bg-hairline/5 border-hairline/10 text-muted-foreground',
                                    )}>
                                        <ShieldCheck className="size-3.5" />
                                        {detail.complete ? 'Complete' : 'Pending demos'}
                                    </span>
                                    {(detail.completed_at || detail.added) && (
                                        <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-hairline/5 border border-hairline/5 text-xs text-muted-foreground">
                                            <Calendar className="size-3.5" />
                                            {formatAddedDate((detail.completed_at ?? detail.added) as string)}
                                        </span>
                                    )}
                                    {detail.server.name && (
                                        <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-hairline/5 border border-hairline/5 text-xs text-muted-foreground">
                                            <MapPin className="size-3.5" />
                                            {detail.server.name}
                                            {detail.server.region ? ` · ${detail.server.region}` : ''}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {detail.disallowed && (
                        <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-300 shrink-0">
                            <ShieldAlert className="size-5 shrink-0 mt-0.5" />
                            <div className="space-y-1 min-w-0">
                                <div className="font-bold uppercase tracking-wider text-xs">Disallowed run</div>
                                <p className="text-sm text-red-200/90 leading-relaxed">
                                    This team run has been disallowed by staff. It no longer counts toward leaderboards, medals, or world records.
                                </p>
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm shrink-0">
                            {error}
                        </div>
                    )}

                    <div ref={scrollRef} onScroll={onScroll} className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
                        <div className="bg-card/30 border border-hairline/5 rounded-xl">
                            <div className="px-4 py-3 border-b border-hairline/5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                Roster
                            </div>
                            <div className="p-3 flex flex-col gap-2">
                                {detail.members.map(member => {
                                    const isAnchor = member.cap_time_seconds === detail.team_time_seconds
                                    return (
                                        <div
                                            key={member.cap_id}
                                            className={cn(
                                                'flex items-center justify-between gap-3 min-w-0 rounded-lg border px-3 py-2.5',
                                                isAnchor
                                                    ? 'bg-accent-500/[0.06] border-accent-500/30'
                                                    : 'bg-hairline/[0.02] border-hairline/5',
                                            )}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <PlayerInfo
                                                    userId={member.user}
                                                    alias={member.alias}
                                                    title={member.active_title}
                                                    size="md"
                                                />
                                                {isAnchor && (
                                                    <span className="shrink-0 inline-flex items-center h-5 px-1.5 rounded-full bg-accent-500/20 border border-accent-500/40 text-accent-200 text-[9px] font-bold uppercase tracking-wider">
                                                        Anchor
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3 shrink-0">
                                                <span className="text-sm font-mono tabular-nums font-bold text-foreground">
                                                    {formatCapTime(member.cap_time_seconds)}
                                                </span>
                                                {member.disallowed ? (
                                                    <Tooltip content="Disallowed" side="top">
                                                        <ShieldAlert className="size-4 text-red-300" />
                                                    </Tooltip>
                                                ) : (
                                                    <Tooltip content={member.verified ? 'Verified' : 'Pending demo'} side="top">
                                                        {member.verified
                                                            ? <ShieldCheck className="size-4 text-emerald-300" />
                                                            : <ShieldAlert className="size-4 text-amber-300" />}
                                                    </Tooltip>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => replay.openReplay({
                                                        capId: member.cap_id,
                                                        mapName: detail.map,
                                                        time: member.cap_time_seconds,
                                                        alias: member.alias ?? undefined,
                                                    })}
                                                    disabled={!member.verified || replay.loadingCapId === member.cap_id}
                                                    className={cn(
                                                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors text-xs font-semibold cursor-pointer',
                                                        'bg-accent-500/15 border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:text-foreground hover:border-accent-500/60',
                                                        'disabled:opacity-50 disabled:cursor-not-allowed',
                                                    )}
                                                    title={member.verified ? 'Watch Replay' : 'No replay — cap not verified'}
                                                >
                                                    {replay.loadingCapId === member.cap_id
                                                        ? <Loader2 className="size-3.5 animate-spin" />
                                                        : <Play className="size-3.5" />}
                                                    Watch
                                                </button>
                                                {member.has_demo && (
                                                    <button
                                                        type="button"
                                                        onClick={() => demoDownload.start(
                                                            {
                                                                id: member.cap_id,
                                                                alias: member.alias ?? '',
                                                                cap_time_seconds: member.cap_time_seconds,
                                                                map: detail.map,
                                                            } as LeaderboardEntry,
                                                            detail.map,
                                                        )}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-hairline/[0.03] border border-hairline/10 text-muted-foreground hover:text-foreground hover:bg-hairline/[0.06] hover:border-hairline/20 transition-colors text-xs font-semibold cursor-pointer"
                                                        title="Download demo"
                                                    >
                                                        <Download className="size-3.5" />
                                                        Demo
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {members.length > 0 && (
                            <div className="space-y-4">
                                <div className="bg-card/30 border border-hairline/5 rounded-xl">
                                    <div className="px-4 py-3 border-b border-hairline/5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                                        Player Breakdown
                                    </div>
                                    <div className="p-3 flex flex-wrap gap-1.5">
                                        {members.map(member => {
                                            const isActive = member.cap_id === activeMemberId
                                            return (
                                                <button
                                                    key={member.cap_id}
                                                    type="button"
                                                    onClick={() => setActiveMemberTab(member.cap_id)}
                                                    className={cn(
                                                        'inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-lg border transition-colors cursor-pointer',
                                                        isActive
                                                            ? 'bg-accent-500/[0.12] border-accent-500/40'
                                                            : 'bg-hairline/[0.02] border-hairline/5 hover:border-hairline/20 hover:bg-hairline/[0.04]',
                                                    )}
                                                >
                                                    <PlayerInfo
                                                        userId={member.user}
                                                        alias={member.alias}
                                                        title={member.active_title}
                                                        size="sm"
                                                        interactive={false}
                                                    />
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                {activeMember?.cap ? (
                                    <>
                                        <ClientSettingsGrid cap={activeMember.cap} server={detail.server} />
                                        <MovementAnalyticsCard cap={activeMember.cap} />
                                    </>
                                ) : (
                                    <div className="bg-card/30 border border-hairline/5 rounded-xl px-6 py-10 text-center text-sm text-muted-foreground">
                                        No client, server, or movement data is available for this player yet.
                                    </div>
                                )}
                            </div>
                        )}

                        <MedalThresholdsStrip
                            medals={detail.medals}
                            deltas={{
                                wr: detail.deltas.world_record,
                                champion: detail.deltas.champion,
                                gold: detail.deltas.gold,
                                silver: detail.deltas.silver,
                                bronze: detail.deltas.bronze,
                            }}
                        />
                    </div>
                </>
            )}

            <ReplayVideoModal state={replay.video} onClose={replay.clearVideo} />

            <Modal
                isOpen={compareState === 'resolving' || compareState === 'insufficient'}
                onClose={closeCompare}
                title="Watch Team Replay"
                className="w-[95%] sm:w-[440px] max-w-md"
                offsetSidebar
            >
                {compareState === 'resolving' ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="size-4 animate-spin" />
                        Resolving replays…
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground py-2">
                        Not enough replays have finished processing yet — try again later.
                    </p>
                )}
            </Modal>

            {compareState === 'ready' && compareRuns && detail && (
                <VideoCompareModal
                    open
                    onClose={closeCompare}
                    mapName={detail.map}
                    runs={compareRuns}
                />
            )}

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
