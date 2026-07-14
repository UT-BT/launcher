import { useMemo, useRef, useState } from 'react'
import {
    Loader2, ShieldAlert, ShieldCheck, Play, Download, Calendar,
    Users, BadgeCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavScrollRestore } from '@/app/components/navigation/useNavScrollRestore'
import { Modal } from '@/app/components/ui/modal'
import { ReplayVideoModal } from '@/app/components/shared/ReplayVideoModal'
import { DemoDownloadStatusModal } from '@/app/components/shared/DemoDownloadStatusModal'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { TeamHolders } from '@/app/components/shared/TeamHolders'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
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
    fetchTeamMapLeaderboard,
    type TeamCapDetail,
    type TeamLeaderboardEntry,
    type LeaderboardEntry,
    type UserProfile,
} from '@/app/utils/api'

interface TeamCapDetailPageProps {
    teamCapId: string
    userProfile?: UserProfile
    onMapSelect?: (mapName: string) => void
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(items.length)
    let next = 0
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (next < items.length) {
            const index = next++
            results[index] = await fn(items[index])
        }
    })
    await Promise.all(workers)
    return results
}

type CompareState = 'idle' | 'resolving' | 'ready' | 'insufficient'

const ROSTER_GRID_COLS: Record<number, string> = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 lg:grid-cols-2',
    3: 'grid-cols-1 lg:grid-cols-3',
    4: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5',
    6: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-6',
}

function rosterColumnCount(n: number): number {
    if (n <= 1) return 1
    if (n <= 3) return n
    return Math.ceil(Math.sqrt(n))
}

interface TeamRankContextRow {
    entry: TeamLeaderboardEntry
    rank: number
    isCurrent: boolean
}

function TeamRankContextCard({
    rank, total, rows, loading, currentUserId,
}: {
    rank: number | null
    total: number | null
    rows: TeamRankContextRow[]
    loading: boolean
    currentUserId?: string | null
}) {
    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl">
            <div className="px-4 py-3 border-b border-hairline/5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-center">
                Rank
            </div>

            <div className="px-4 py-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono tabular-nums text-foreground">
                    {rank == null ? 'Unranked' : `#${rank}`}
                </span>
                {rank != null && total != null && <span className="text-sm text-muted-foreground">of {total.toLocaleString()}</span>}
            </div>

            <div className="px-2 pb-3 space-y-1">
                {loading && rows.length === 0 ? (
                    Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-11 rounded-lg bg-hairline/[0.03] animate-pulse" />
                    ))
                ) : rows.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                        No ranked team runs yet.
                    </div>
                ) : (
                    rows.map(({ entry, rank: rowRank, isCurrent }) => (
                        <div
                            key={entry.id}
                            className={cn(
                                'flex items-center gap-2 px-3 py-2 rounded-lg',
                                isCurrent ? 'bg-accent-500/10 border border-accent-500/30' : 'hover:bg-hairline/[0.03]',
                            )}
                        >
                            <span className="w-8 text-xs font-bold font-mono text-muted-foreground tabular-nums shrink-0">#{rowRank}</span>
                            <div className="min-w-0 flex-1">
                                <TeamHolders
                                    members={entry.members.map(m => ({
                                        userId: m.user,
                                        alias: m.alias,
                                        activeTitle: m.active_title ?? null,
                                    }))}
                                    size="sm"
                                    currentUserId={currentUserId}
                                />
                            </div>
                            <span className="text-sm font-mono tabular-nums font-bold text-foreground shrink-0">
                                <CapTimeLink teamCapId={entry.id} seconds={entry.cap_time_seconds} />
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

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

    const { data: teamLeaderboardData, loading: leaderboardLoading } = useAsync<TeamLeaderboardEntry[]>(
        (signal) => fetchTeamMapLeaderboard(accessToken!, detail!.map, { signal }),
        [accessToken, detail?.map, refreshKey],
        { enabled: !!accessToken && !!detail?.map, errorMessage: 'Failed to load team leaderboard.' },
    )

    const gapToNext = useMemo(() => {
        if (!detail || detail.rank_on_map == null || detail.rank_on_map <= 1 || detail.team_time_seconds == null) return null
        let nextTime: number | null = null
        for (const entry of teamLeaderboardData ?? []) {
            if (entry.id === detail.team_cap_id) continue
            if (entry.cap_time_seconds < detail.team_time_seconds
                && (nextTime == null || entry.cap_time_seconds > nextTime)) {
                nextTime = entry.cap_time_seconds
            }
        }
        return nextTime == null ? null : detail.team_time_seconds - nextTime
    }, [detail, teamLeaderboardData])

    const rankContextRows = useMemo<TeamRankContextRow[]>(() => {
        if (!detail) return []
        const ranked = (teamLeaderboardData ?? [])
            .filter(entry => entry.verified === true)
            .sort((a, b) => a.cap_time_seconds - b.cap_time_seconds)
            .map((entry, i) => ({ entry, rank: i + 1 }))
        if (ranked.length === 0) return []
        let currentIndex = ranked.findIndex(r => String(r.entry.id) === String(detail.team_cap_id))
        if (currentIndex === -1) {
            currentIndex = ranked.findIndex(r => String(r.entry.user) === String(detail.member_key))
        }
        const windowSize = 5
        let start = Math.max(0, currentIndex - 2)
        let end = start + windowSize - 1
        if (end > ranked.length - 1) {
            end = ranked.length - 1
            start = Math.max(0, end - windowSize + 1)
        }
        return ranked.slice(start, end + 1).map(r => ({
            entry: r.entry,
            rank: r.rank,
            isCurrent: currentIndex !== -1 && r.rank === currentIndex + 1,
        }))
    }, [detail, teamLeaderboardData])

    const [compareState, setCompareState] = useState<CompareState>('idle')
    const [compareRuns, setCompareRuns] = useState<CompareRun[] | null>(null)
    const compareReqRef = useRef(0)

    const [selectedCapId, setSelectedCapId] = useState<string | null>(null)
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
        const eligible = detail.members.filter(member => member.has_demo)
        const resolved = await mapWithConcurrency(eligible, 3, async member => {
            if (member.cap_time_seconds == null) return null
            const url = await resolveCompareVideoUrl(member.cap_id)
            if (!url) return null
            const cps = await fetchCapCheckpoints(accessToken, member.cap_id)
            return {
                capId: member.cap_id,
                alias: member.alias,
                userId: member.user,
                title: member.active_title,
                capTime: member.cap_time_seconds,
                checkpoints: cps?.checkpoints ?? [],
                url,
            } as CompareRun
        })
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

    const members = detail?.members ?? []
    const membersWithDemos = members.filter(m => m.has_demo)
    const anchorMemberId = detail
        ? (members.find(m => m.cap_time_seconds === detail.team_time_seconds)?.cap_id ?? members[0]?.cap_id ?? null)
        : (members[0]?.cap_id ?? null)
    const selectedMemberId = (selectedCapId && members.some(m => m.cap_id === selectedCapId))
        ? selectedCapId
        : anchorMemberId
    const selectedMember = members.find(m => m.cap_id === selectedMemberId) ?? null

    const rosterColsClass = ROSTER_GRID_COLS[rosterColumnCount(members.length)] ?? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'

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
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <Users className="size-4 shrink-0" />
                                    <span className="font-semibold text-foreground">{detail.team_size} player run</span>
                                </div>

                                <div className="flex items-stretch gap-5 pt-3 border-t border-hairline/5 flex-wrap">
                                    <div className="flex flex-col justify-between">
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Team Time</div>
                                        <div className="text-4xl font-bold font-mono tabular-nums text-foreground leading-none">
                                            {detail.team_time_seconds == null ? '—' : formatCapTime(detail.team_time_seconds)}
                                        </div>
                                    </div>
                                    <div className="self-stretch w-px bg-hairline/10" />
                                    <div className="flex flex-col justify-between text-left">
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Rank</div>
                                        <div className="text-lg font-bold font-mono tabular-nums leading-none">
                                            <span className="text-foreground">{detail.rank_on_map == null ? '—' : `#${detail.rank_on_map}`}</span>{' '}
                                            {detail.total_on_map != null && (
                                                <span className="text-[10px] text-muted-foreground font-normal">
                                                    of {detail.total_on_map.toLocaleString()}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="self-stretch w-px bg-hairline/10" />
                                    <div className="flex flex-col justify-between text-left">
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Δ WR</div>
                                        <div className="text-lg font-bold font-mono tabular-nums leading-none">
                                            <span className={detail.is_world_record ? 'text-muted-foreground' : deltaClass(detail.deltas?.world_record ?? null)}>
                                                {detail.is_world_record ? 'WR' : formatSignedDelta(detail.deltas?.world_record ?? null)}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="self-stretch w-px bg-hairline/10" />
                                    <div className="flex flex-col justify-between text-left">
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Gap to Next</div>
                                        <div className="text-lg font-bold font-mono tabular-nums leading-none">
                                            <span className={detail.is_world_record || gapToNext == null ? 'text-muted-foreground' : 'text-red-300'}>
                                                {detail.is_world_record || gapToNext == null ? '—' : formatSignedDelta(gapToNext)}
                                            </span>
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
                                            detail.state === 'verified'
                                                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                                : detail.state === 'pending'
                                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                                    : 'bg-hairline/5 border-hairline/10 text-muted-foreground',
                                        )}>
                                            <ShieldCheck className="size-3.5" />
                                            {detail.state === 'verified'
                                                ? 'Verified'
                                                : detail.state === 'pending'
                                                    ? 'Certified'
                                                    : 'Incomplete'}
                                        </span>
                                    )}
                                    <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border text-xs font-semibold bg-blue-500/15 border-blue-500/40 text-blue-300">
                                        <BadgeCheck className="size-3.5" />
                                        Certified
                                    </span>
                                    {(detail.completed_at || detail.added) && (
                                        <span className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md bg-hairline/5 border border-hairline/5 text-xs text-muted-foreground">
                                            <Calendar className="size-3.5" />
                                            {formatAddedDate((detail.completed_at ?? detail.added) as string)}
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
                        {members.length > 0 && (
                            <div className="bg-card/30 border border-hairline/5 rounded-xl">
                                <div className="px-4 py-3 border-b border-hairline/5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-center">
                                    Roster
                                </div>
                                <div className="p-3">
                                    <div className={cn('grid gap-2 items-stretch', rosterColsClass)}>
                                        {members.map(member => {
                                            const isSelected = member.cap_id === selectedMemberId
                                            return (
                                                <div
                                                    key={member.cap_id}
                                                    role="button"
                                                    tabIndex={0}
                                                    aria-pressed={isSelected}
                                                    onClick={() => setSelectedCapId(member.cap_id)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter' || e.key === ' ') {
                                                            e.preventDefault()
                                                            setSelectedCapId(member.cap_id)
                                                        }
                                                    }}
                                                    className={cn(
                                                        'flex flex-col gap-2 rounded-lg border p-3 text-left transition-colors cursor-pointer outline-none',
                                                        'focus-visible:ring-2 focus-visible:ring-accent-500/50',
                                                        isSelected
                                                            ? 'bg-accent-500/[0.12] border-accent-500/50 ring-1 ring-accent-500/30'
                                                            : 'bg-hairline/[0.02] border-hairline/5 hover:border-hairline/20 hover:bg-hairline/[0.04]',
                                                    )}
                                                >
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        <PlayerInfo
                                                            userId={member.user}
                                                            alias={member.alias}
                                                            title={member.active_title}
                                                            size="sm"
                                                        />
                                                        {member.disallowed ? (
                                                            <Tooltip content="Disallowed" side="top">
                                                                <ShieldAlert className="size-3.5 text-red-300 shrink-0" />
                                                            </Tooltip>
                                                        ) : (
                                                            <Tooltip content={member.verified ? 'Verified' : 'Pending demo'} side="top">
                                                                {member.verified
                                                                    ? <ShieldCheck className="size-3.5 text-emerald-300 shrink-0" />
                                                                    : <ShieldAlert className="size-3.5 text-amber-300 shrink-0" />}
                                                            </Tooltip>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="text-base font-mono tabular-nums font-bold text-foreground leading-none">
                                                            {member.cap_time_seconds == null ? '—' : formatCapTime(member.cap_time_seconds)}
                                                        </span>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <button
                                                                type="button"
                                                                onClick={e => {
                                                                    e.stopPropagation()
                                                                    replay.openReplay({
                                                                        capId: member.cap_id,
                                                                        mapName: detail.map,
                                                                        time: member.cap_time_seconds ?? undefined,
                                                                        alias: member.alias ?? undefined,
                                                                    })
                                                                }}
                                                                disabled={!member.verified || replay.loadingCapId === member.cap_id}
                                                                className={cn(
                                                                    'inline-flex items-center gap-1 px-2 py-1 rounded-md border transition-colors text-xs font-semibold cursor-pointer',
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
                                                            {member.has_demo && member.cap_time_seconds != null && (
                                                                <button
                                                                    type="button"
                                                                    onClick={e => {
                                                                        e.stopPropagation()
                                                                        demoDownload.start(
                                                                            {
                                                                                id: member.cap_id,
                                                                                alias: member.alias ?? '',
                                                                                cap_time_seconds: member.cap_time_seconds,
                                                                                map: detail.map,
                                                                            } as LeaderboardEntry,
                                                                            detail.map,
                                                                        )
                                                                    }}
                                                                    className="inline-flex items-center justify-center size-7 rounded-md bg-hairline/[0.03] border border-hairline/10 text-muted-foreground hover:text-foreground hover:bg-hairline/[0.06] hover:border-hairline/20 transition-colors cursor-pointer"
                                                                    title="Download demo"
                                                                >
                                                                    <Download className="size-3.5" />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {members.length > 0 && (
                            selectedMember?.cap ? (
                                <ClientSettingsGrid cap={selectedMember.cap} server={detail.server} />
                            ) : (
                                <div className="bg-card/30 border border-hairline/5 rounded-xl px-6 py-10 text-center text-sm text-muted-foreground">
                                    No client or server data is available for this player yet.
                                </div>
                            )
                        )}

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                            <TeamRankContextCard
                                rank={detail.rank_on_map}
                                total={detail.total_on_map}
                                rows={rankContextRows}
                                loading={leaderboardLoading}
                                currentUserId={userProfile?.id ?? null}
                            />
                            {selectedMember?.cap ? (
                                <MovementAnalyticsCard cap={selectedMember.cap} />
                            ) : (
                                <div className="bg-card/30 border border-hairline/5 rounded-xl px-6 py-10 text-center text-sm text-muted-foreground">
                                    No movement data is available for this player yet.
                                </div>
                            )}
                        </div>

                        {detail.medals && detail.deltas && (
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
                        )}
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
