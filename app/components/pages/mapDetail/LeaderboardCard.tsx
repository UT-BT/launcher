import { useCallback, useMemo, useState } from 'react'
import { Play, Download, MessageSquareOff, ShieldCheck, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavState } from '@/app/components/navigation/useNavState'
import { formatAddedDate } from '@/app/utils/format'
import { getMedalIcon } from '@/app/utils/medals'
import { getTeamDisplay } from '@/app/utils/team'
import { medalIconForInt, medalLabelForInt } from '@/app/components/pages/capDetail/capStats'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import { computeMedalTier, TIER_LABELS, type MedalTier } from '@/app/components/pages/MapsPage'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { IconActionButton } from '@/app/components/shared/IconActionButton'
import { ReplayVideoModal } from '@/app/components/shared/ReplayVideoModal'
import { DemoDownloadStatusModal } from '@/app/components/shared/DemoDownloadStatusModal'
import { WorldRecordHistoryTrigger } from '@/app/components/shared/WorldRecordHistoryTrigger'
import { useReplayWatch } from '@/app/hooks/useReplayWatch'
import { useDemoDownload } from '@/app/hooks/useDemoDownload'
import { Tooltip } from '@/app/components/ui/tooltip'
import { Modal } from '@/app/components/ui/modal'
import {
    DataTableShell,
    DataTableHeaderRow,
    DataTableHeaderCell,
    DataTableRow,
    DataTableCell,
    DataTableEmpty,
    DataTableSkeletonRow,
    type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { PaginationBar } from '@/app/components/ui/pagination'
import type { LeaderboardEntry, TeamLeaderboardEntry, MapMetadata } from '@/app/utils/api'

type Tab = 'verified' | 'certified' | 'all'
type SortField = 'rank' | 'player' | 'time' | 'date'
type SortDir = 'asc' | 'desc'

interface LeaderboardCardProps {
    leaderboard: LeaderboardEntry[]
    teamLeaderboard?: TeamLeaderboardEntry[]
    requiredPlayers?: number
    map: MapMetadata | null
    loading: boolean
    currentUserId?: string | number
    wrCapId?: string | null
    onShowWrHistory?: () => void
}

export function LeaderboardCard(props: LeaderboardCardProps) {
    const isTeam = props.requiredPlayers != null && props.requiredPlayers > 1
    if (isTeam) {
        return (
            <TeamLeaderboardTable
                teamLeaderboard={props.teamLeaderboard ?? []}
                loading={props.loading}
                currentUserId={props.currentUserId}
            />
        )
    }
    return <SoloLeaderboardTable {...props} />
}

const TABS: { value: Tab; label: string }[] = [
    { value: 'verified', label: 'Verified' },
    { value: 'certified', label: 'Certified' },
    { value: 'all', label: 'All' },
]

type LeaderboardColumnId = 'rank' | 'player' | 'team' | 'medal' | 'time' | 'date' | 'watch' | 'download'

const LEADERBOARD_COLUMNS: LeaderboardColumnId[] = ['rank', 'player', 'medal', 'time', 'team', 'date', 'watch', 'download']

const COLUMN_WIDTH: Record<LeaderboardColumnId, string | undefined> = {
    rank: '4rem',
    player: undefined,
    team: '5rem',
    medal: '3rem',
    time: '8rem',
    date: '8rem',
    watch: '3rem',
    download: '3rem',
}

const COLUMN_PRIORITY: Partial<Record<LeaderboardColumnId, number>> = {
    date: 40,
    team: 35,
    medal: 30,
    watch: 20,
    download: 10,
}

const REQUIRED_COLUMNS = new Set<LeaderboardColumnId>(['player', 'rank', 'time'])

function SoloLeaderboardTable({
    leaderboard, map, loading, currentUserId, wrCapId, onShowWrHistory,
}: LeaderboardCardProps) {
    const [tab, setTab] = useNavState<Tab>('leaderboard.tab', 'verified')
    const [sortBy, setSortBy] = useNavState<SortField>('leaderboard.sortBy', 'rank')
    const [sortDir, setSortDir] = useNavState<SortDir>('leaderboard.sortDir', 'asc')
    const [page, setPage] = useNavState('leaderboard.page', 1)
    const [pageSize, setPageSize] = useNavState('leaderboard.pageSize', 10)

    const replay = useReplayWatch()
    const demoDownload = useDemoDownload()

    const responsiveColumns = useMemo<ResponsiveColumn[]>(
        () => LEADERBOARD_COLUMNS.map(id => ({
            id,
            width: COLUMN_WIDTH[id],
            priority: COLUMN_PRIORITY[id],
            required: REQUIRED_COLUMNS.has(id),
        })),
        [],
    )
    const [resolved, setResolved] = useState<Set<LeaderboardColumnId> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => {
        setResolved(ids as Set<LeaderboardColumnId>)
    }, [])
    const isVisible = (id: LeaderboardColumnId) => !resolved || resolved.has(id)
    const visibleColumnCount = LEADERBOARD_COLUMNS.reduce((n, id) => n + (isVisible(id) ? 1 : 0), 0)

    const filtered = useMemo(() => {
        if (tab === 'verified') return leaderboard.filter(e => e.verified)
        if (tab === 'certified') return leaderboard.filter(e => e.cap_type === 2)
        return leaderboard
    }, [leaderboard, tab])

    const ranked = useMemo(() => {
        const byTime = [...filtered].sort((a, b) => a.cap_time_seconds - b.cap_time_seconds)
        return byTime.map((entry, i) => ({ entry, rank: i + 1 }))
    }, [filtered])

    const sorted = useMemo(() => {
        const arr = [...ranked]
        arr.sort((a, b) => {
            let cmp = 0
            switch (sortBy) {
                case 'rank':
                    cmp = a.rank - b.rank
                    break
                case 'player':
                    cmp = (a.entry.alias ?? '').localeCompare(b.entry.alias ?? '')
                    break
                case 'time':
                    cmp = a.entry.cap_time_seconds - b.entry.cap_time_seconds
                    break
                case 'date':
                    cmp = new Date(a.entry.added).getTime() - new Date(b.entry.added).getTime()
                    break
            }
            return sortDir === 'asc' ? cmp : -cmp
        })
        return arr
    }, [ranked, sortBy, sortDir])

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
    const safePage = Math.min(page, totalPages)
    const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

    const handleSort = (field: SortField) => {
        if (sortBy === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(field)
            setSortDir(field === 'player' ? 'asc' : (field === 'time' || field === 'rank') ? 'asc' : 'desc')
        }
        setPage(1)
    }

    const dir = (field: SortField): 'asc' | 'desc' | null => (sortBy === field ? sortDir : null)

    const compactRows = loading ? (
        Array.from({ length: 5 }).map((_, i) => (
            <div key={i} role="listitem" className="p-3 border-b border-hairline/5 last:border-0 animate-pulse">
                <div className="h-10 rounded bg-hairline/5" />
            </div>
        ))
    ) : pageRows.length === 0 ? (
        <div role="listitem" className="px-4 py-12 text-center text-sm text-muted-foreground">No caps yet.</div>
    ) : pageRows.map(({ entry, rank }) => {
        const tier: MedalTier = computeMedalTier(
            { map: entry.map, cap_time_seconds: entry.cap_time_seconds, cap_type: entry.cap_type, verified: entry.verified },
            map ?? undefined,
        )
        const isOwn = currentUserId != null && String(entry.user) === String(currentUserId)
        const medalIconKey = tier === 'world_record' ? 'world record' :
            tier === 'champion' ? 'champion medal' :
                tier === 'gold' ? 'gold medal' :
                    tier === 'silver' ? 'silver medal' :
                        tier === 'bronze' ? 'bronze medal' :
                            tier === 'verified' ? 'certified' :
                                tier === 'casual' ? 'casual' : ''
        const medalIcon = medalIconKey ? getMedalIcon(medalIconKey) : null
        return (
            <div
                key={entry.id}
                role="listitem"
                className={cn('grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 p-3 border-b border-hairline/5 last:border-0', isOwn && 'bg-emerald-500/[0.05]')}
            >
                <span className="text-xs font-bold font-mono text-muted-foreground tabular-nums w-8 text-right">
                    #{rank}
                </span>
                <div className="min-w-0">
                    <PlayerInfo
                        userId={entry.user}
                        alias={entry.alias}
                        title={entry.active_title}
                        size="sm"
                        highlight={isOwn}
                        showYouBadge={isOwn}
                    />
                </div>
                <div className="flex flex-col items-end gap-0.5">
                    <div className="flex items-center gap-1.5">
                        {medalIcon && (
                            <img src={medalIcon} alt={TIER_LABELS[tier]} className="size-4 inline-block shrink-0 object-contain max-w-none" />
                        )}
                        <CapTimeLink
                            capId={entry.id}
                            seconds={entry.cap_time_seconds}
                            className={cn(
                                'text-sm font-mono tabular-nums font-bold',
                                rank === 1 ? 'text-red-300' : 'text-foreground',
                            )}
                        />
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatAddedDate(entry.added)}</span>
                </div>
            </div>
        )
    })

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-hairline/5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Leaderboard
                </div>
                <div className="flex items-center gap-1">
                    {TABS.map(t => (
                        <button
                            key={t.value}
                            type="button"
                            onClick={() => { setTab(t.value); setPage(1) }}
                            className={cn(
                                'h-7 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer',
                                tab === t.value
                                    ? 'bg-accent-500/20 border-accent-500/50 text-accent-200'
                                    : 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20',
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col">
                <DataTableShell
                    className="!flex-none !min-h-0 !rounded-none !border-0"
                    responsive={{
                        columns: responsiveColumns,
                        onResolve: handleResolve,
                        compactContent: compactRows,
                        compactAriaLabel: 'Map leaderboard',
                    }}
                >
                    <DataTableHeaderRow>
                        {isVisible('rank') && (
                            <DataTableHeaderCell
                                sortable
                                sortDirection={dir('rank')}
                                onSort={() => handleSort('rank')}
                                width="4rem"
                                align="right"
                            >
                                #
                            </DataTableHeaderCell>
                        )}
                        {isVisible('player') && (
                            <DataTableHeaderCell
                                sortable
                                sortDirection={dir('player')}
                                onSort={() => handleSort('player')}
                            >
                                Player
                            </DataTableHeaderCell>
                        )}
                        {isVisible('medal') && (
                            <DataTableHeaderCell align="center" width="3rem"><span className="sr-only">Medal</span></DataTableHeaderCell>
                        )}
                        {isVisible('time') && (
                            <DataTableHeaderCell
                                sortable
                                sortDirection={dir('time')}
                                onSort={() => handleSort('time')}
                                align="right"
                                width="8rem"
                            >
                                Time
                            </DataTableHeaderCell>
                        )}
                        {isVisible('team') && (
                            <DataTableHeaderCell align="center" width="5rem">Team</DataTableHeaderCell>
                        )}
                        {isVisible('date') && (
                            <DataTableHeaderCell
                                sortable
                                sortDirection={dir('date')}
                                onSort={() => handleSort('date')}
                                align="right"
                                width="8rem"
                            >
                                Date
                            </DataTableHeaderCell>
                        )}
                        {isVisible('watch') && (
                            <DataTableHeaderCell align="center" width="3rem"><span className="sr-only">Watch</span></DataTableHeaderCell>
                        )}
                        {isVisible('download') && (
                            <DataTableHeaderCell align="center" width="3rem"><span className="sr-only">Download</span></DataTableHeaderCell>
                        )}
                    </DataTableHeaderRow>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <DataTableSkeletonRow key={i} columnCount={visibleColumnCount} />
                            ))
                        ) : pageRows.length === 0 ? (
                            <DataTableEmpty colSpan={visibleColumnCount} message="No caps yet." />
                        ) : (
                            pageRows.map(({ entry, rank }) => {
                                const tier: MedalTier = computeMedalTier(
                                    { map: entry.map, cap_time_seconds: entry.cap_time_seconds, cap_type: entry.cap_type, verified: entry.verified },
                                    map ?? undefined,
                                )
                                const isOwn = currentUserId != null && String(entry.user) === String(currentUserId)
                                const medalIconKey = tier === 'world_record' ? 'world record' :
                                    tier === 'champion' ? 'champion medal' :
                                        tier === 'gold' ? 'gold medal' :
                                            tier === 'silver' ? 'silver medal' :
                                                tier === 'bronze' ? 'bronze medal' :
                                                    tier === 'verified' ? 'certified' :
                                                        tier === 'casual' ? 'casual' : ''
                                const medalIcon = medalIconKey ? getMedalIcon(medalIconKey) : null
                                const exactTimestamp = (() => {
                                    const d = new Date(entry.added)
                                    return isNaN(d.getTime()) ? entry.added : d.toLocaleString()
                                })()
                                return (
                                    <DataTableRow key={entry.id} className={cn(isOwn && 'bg-emerald-500/[0.05]')}>
                                        {isVisible('rank') && (
                                            <DataTableCell align="right">
                                                <span className="text-xs font-bold font-mono text-muted-foreground tabular-nums">
                                                    #{rank}
                                                </span>
                                            </DataTableCell>
                                        )}
                                        {isVisible('player') && (
                                            <DataTableCell>
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    <PlayerInfo
                                                        userId={entry.user}
                                                        alias={entry.alias}
                                                        title={entry.active_title}
                                                        size="sm"
                                                        highlight={isOwn}
                                                        showYouBadge={isOwn}
                                                    />
                                                    {wrCapId && entry.id === wrCapId && onShowWrHistory && (
                                                        <WorldRecordHistoryTrigger onClick={onShowWrHistory} />
                                                    )}
                                                </div>
                                            </DataTableCell>
                                        )}
                                        {isVisible('medal') && (
                                            <DataTableCell align="center">
                                                {medalIcon && (
                                                    <Tooltip content={TIER_LABELS[tier]} side="top">
                                                        <img src={medalIcon} alt={TIER_LABELS[tier]} className="size-4 inline-block shrink-0 object-contain max-w-none" />
                                                    </Tooltip>
                                                )}
                                            </DataTableCell>
                                        )}
                                        {isVisible('time') && (
                                            <DataTableCell align="right">
                                                <CapTimeLink
                                                    capId={entry.id}
                                                    seconds={entry.cap_time_seconds}
                                                    className={cn(
                                                        'text-sm font-mono tabular-nums font-bold',
                                                        rank === 1 ? 'text-red-300' : 'text-foreground',
                                                    )}
                                                />
                                            </DataTableCell>
                                        )}
                                        {isVisible('team') && (
                                            <DataTableCell align="center">
                                                {entry.team == null ? (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                ) : (
                                                    <span className={cn('text-xs font-medium', getTeamDisplay(entry.team).accent)}>
                                                        {getTeamDisplay(entry.team).name}
                                                    </span>
                                                )}
                                            </DataTableCell>
                                        )}
                                        {isVisible('date') && (
                                            <DataTableCell align="right">
                                                <Tooltip content={exactTimestamp} side="top">
                                                    <span className="text-xs text-muted-foreground tabular-nums">
                                                        {formatAddedDate(entry.added)}
                                                    </span>
                                                </Tooltip>
                                            </DataTableCell>
                                        )}
                                        {isVisible('watch') && (
                                            <DataTableCell align="center" className="px-2">
                                                <IconActionButton
                                                    variant="replay"
                                                    icon={entry.verified ? Play : MessageSquareOff}
                                                    iconFill={entry.verified}
                                                    tooltip={entry.verified ? 'Watch run' : 'No replay — cap not verified'}
                                                    disabled={!entry.verified}
                                                    loading={replay.loadingCapId === entry.id}
                                                    onClick={() => replay.openReplay({
                                                        capId: entry.id,
                                                        mapName: entry.map,
                                                        time: entry.cap_time_seconds,
                                                        alias: entry.alias ?? undefined,
                                                    })}
                                                />
                                            </DataTableCell>
                                        )}
                                        {isVisible('download') && (
                                            <DataTableCell align="center" className="px-2">
                                                <IconActionButton
                                                    variant="download"
                                                    icon={Download}
                                                    tooltip="Download demo"
                                                    onClick={() => demoDownload.start(entry, entry.map)}
                                                />
                                            </DataTableCell>
                                        )}
                                    </DataTableRow>
                                )
                            })
                        )}
                    </tbody>
                </DataTableShell>

                {!loading && sorted.length > 0 && (
                    <div className="px-4 py-3 border-t border-hairline/5">
                        <PaginationBar
                            page={safePage}
                            totalPages={totalPages}
                            pageSize={pageSize}
                            totalForCount={sorted.length}
                            pageSizePreference={pageSize}
                            autoPageSize={pageSize}
                            onPageChange={setPage}
                            onPageSizeChange={(pref) => setPageSize(pref === 'auto' ? 10 : pref)}
                        />
                    </div>
                )}
            </div>

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

type TeamTab = 'verified' | 'all'
type TeamSortField = 'rank' | 'time' | 'date'

const TEAM_TABS: { value: TeamTab; label: string }[] = [
    { value: 'verified', label: 'Verified' },
    { value: 'all', label: 'All' },
]

const TEAM_LEADERBOARD_COLUMNS: ResponsiveColumn[] = [
    { id: 'rank', width: '4rem', required: true },
    { id: 'team', width: '10rem', required: true },
    { id: 'medal', width: '3rem', required: true },
    { id: 'time', width: '8rem', required: true },
    { id: 'status', width: '7rem', required: true },
    { id: 'date', width: '8rem', required: true },
]

interface TeamLeaderboardTableProps {
    teamLeaderboard: TeamLeaderboardEntry[]
    loading: boolean
    currentUserId?: string | number
    highlightTeamCapId?: string | null
    highlightMemberKey?: string | number | null
}

export function TeamLeaderboardTable({
    teamLeaderboard, loading, currentUserId, highlightTeamCapId, highlightMemberKey,
}: TeamLeaderboardTableProps) {
    const [tab, setTab] = useNavState<TeamTab>('teamLeaderboard.tab', 'verified')
    const [sortBy, setSortBy] = useNavState<TeamSortField>('teamLeaderboard.sortBy', 'rank')
    const [sortDir, setSortDir] = useNavState<SortDir>('teamLeaderboard.sortDir', 'asc')
    const [page, setPage] = useNavState('teamLeaderboard.page', 1)
    const [pageSize, setPageSize] = useNavState('teamLeaderboard.pageSize', 10)
    const activeTab: TeamTab = tab === 'verified' ? 'verified' : 'all'

    const filtered = useMemo(() => {
        if (activeTab === 'verified') return teamLeaderboard.filter(e => e.state === 'verified')
        return teamLeaderboard
    }, [teamLeaderboard, activeTab])

    const ranked = useMemo(() => {
        const byTime = [...filtered].sort((a, b) => a.cap_time_seconds - b.cap_time_seconds)
        return byTime.map((entry, i) => ({ entry, rank: i + 1 }))
    }, [filtered])

    const sorted = useMemo(() => {
        const arr = [...ranked]
        arr.sort((a, b) => {
            let cmp = 0
            switch (sortBy) {
                case 'rank':
                    cmp = a.rank - b.rank
                    break
                case 'time':
                    cmp = a.entry.cap_time_seconds - b.entry.cap_time_seconds
                    break
                case 'date':
                    cmp = new Date(a.entry.added).getTime() - new Date(b.entry.added).getTime()
                    break
            }
            return sortDir === 'asc' ? cmp : -cmp
        })
        return arr
    }, [ranked, sortBy, sortDir])

    const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
    const safePage = Math.min(page, totalPages)
    const pageRows = sorted.slice((safePage - 1) * pageSize, safePage * pageSize)

    const handleSort = (field: TeamSortField) => {
        if (sortBy === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
        } else {
            setSortBy(field)
            setSortDir('asc')
        }
        setPage(1)
    }

    const dir = (field: TeamSortField): 'asc' | 'desc' | null => (sortBy === field ? sortDir : null)
    const compactRows = loading ? (
        Array.from({ length: 5 }).map((_, i) => (
            <div key={i} role="listitem" className="p-3 border-b border-hairline/5 last:border-0 animate-pulse">
                <div className="h-14 rounded bg-hairline/5" />
            </div>
        ))
    ) : pageRows.length === 0 ? (
        <div role="listitem" className="px-4 py-12 text-center text-sm text-muted-foreground">No team runs yet.</div>
    ) : pageRows.map(({ entry, rank }) => {
        const medalIcon = entry.verified ? medalIconForInt(entry.medal) : null
        const medalLabel = medalLabelForInt(entry.medal)
        const isOwn = currentUserId != null && (entry.members ?? []).some(m => String(m.user) === String(currentUserId))
        const isCurrentRun =
            (highlightTeamCapId != null && String(entry.id) === String(highlightTeamCapId)) ||
            (highlightMemberKey != null && String(entry.user) === String(highlightMemberKey))
        const highlightRow = (highlightTeamCapId != null || highlightMemberKey != null) ? isCurrentRun : isOwn
        return (
            <div key={entry.id} role="listitem" className={cn('grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 p-3 border-b border-hairline/5 last:border-0', highlightRow && 'bg-emerald-500/[0.05]')}>
                <span className="pt-0.5 text-xs font-bold font-mono text-muted-foreground tabular-nums">#{rank}</span>
                <div className="min-w-0 space-y-1.5">
                    {(entry.members ?? []).map(member => (
                        <div key={member.cap_id} className="flex items-center gap-1.5 min-w-0">
                            <PlayerInfo
                                userId={member.user}
                                alias={member.alias}
                                size="sm"
                                highlight={currentUserId != null && String(member.user) === String(currentUserId)}
                            />
                            {!member.verified && <span className="text-[9px] uppercase tracking-wider text-amber-300/80">pending</span>}
                        </div>
                    ))}
                    <span className="block text-[10px] text-muted-foreground">{formatAddedDate(entry.added)}</span>
                </div>
                <div className="flex flex-col items-end justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                        {medalIcon && <img src={medalIcon} alt={medalLabel} className="size-4 object-contain" />}
                        <CapTimeLink teamCapId={entry.id} seconds={entry.cap_time_seconds} className="font-mono tabular-nums font-bold text-foreground" />
                    </div>
                    <span className={cn(
                        'inline-flex items-center gap-1 h-6 px-2 rounded-md border text-[10px] font-semibold',
                        entry.verified
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-hairline/5 border-hairline/10 text-muted-foreground',
                    )}>
                        {entry.verified ? <ShieldCheck className="size-3" /> : <ShieldAlert className="size-3" />}
                        {entry.state === 'incomplete' ? 'Incomplete' : entry.verified ? 'Verified' : 'Certified'}
                    </span>
                </div>
            </div>
        )
    })

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-hairline/5">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Team Leaderboard
                </div>
                <div className="flex items-center gap-1">
                    {TEAM_TABS.map(t => (
                        <button
                            key={t.value}
                            type="button"
                            onClick={() => { setTab(t.value); setPage(1) }}
                            className={cn(
                                'h-7 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer',
                                activeTab === t.value
                                    ? 'bg-accent-500/20 border-accent-500/50 text-accent-200'
                                    : 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20',
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col">
                <DataTableShell
                    className="!flex-none !min-h-0 !rounded-none !border-0"
                    responsive={{
                        columns: TEAM_LEADERBOARD_COLUMNS,
                        compactContent: compactRows,
                        compactAriaLabel: 'Team leaderboard',
                    }}
                >
                    <DataTableHeaderRow>
                        <DataTableHeaderCell
                            sortable
                            sortDirection={dir('rank')}
                            onSort={() => handleSort('rank')}
                            width="4rem"
                            align="right"
                        >
                            #
                        </DataTableHeaderCell>
                        <DataTableHeaderCell>Team</DataTableHeaderCell>
                        <DataTableHeaderCell align="center" width="3rem"><span className="sr-only">Medal</span></DataTableHeaderCell>
                        <DataTableHeaderCell
                            sortable
                            sortDirection={dir('time')}
                            onSort={() => handleSort('time')}
                            align="right"
                            width="8rem"
                        >
                            Team Time
                        </DataTableHeaderCell>
                        <DataTableHeaderCell align="center" width="7rem">Status</DataTableHeaderCell>
                        <DataTableHeaderCell
                            sortable
                            sortDirection={dir('date')}
                            onSort={() => handleSort('date')}
                            align="right"
                            width="8rem"
                        >
                            Date
                        </DataTableHeaderCell>
                    </DataTableHeaderRow>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <DataTableSkeletonRow key={i} columnCount={6} />
                            ))
                        ) : pageRows.length === 0 ? (
                            <DataTableEmpty colSpan={6} message="No team runs yet." />
                        ) : (
                            pageRows.map(({ entry, rank }) => {
                                const medalIcon = entry.verified ? medalIconForInt(entry.medal) : null
                                const medalLabel = medalLabelForInt(entry.medal)
                                const isOwn = currentUserId != null && (entry.members ?? []).some(m => String(m.user) === String(currentUserId))
                                const isCurrentRun =
                                    (highlightTeamCapId != null && String(entry.id) === String(highlightTeamCapId)) ||
                                    (highlightMemberKey != null && String(entry.user) === String(highlightMemberKey))
                                const highlightRow = (highlightTeamCapId != null || highlightMemberKey != null) ? isCurrentRun : isOwn
                                const exactTimestamp = (() => {
                                    const d = new Date(entry.added)
                                    return isNaN(d.getTime()) ? entry.added : d.toLocaleString()
                                })()
                                return (
                                    <DataTableRow key={entry.id} className={cn(highlightRow && 'bg-emerald-500/[0.05]')}>
                                        <DataTableCell align="right">
                                            <span className="text-xs font-bold font-mono text-muted-foreground tabular-nums">
                                                #{rank}
                                            </span>
                                        </DataTableCell>
                                        <DataTableCell>
                                            <div className="flex flex-col gap-1.5 py-0.5 min-w-0">
                                                {(entry.members ?? []).map(member => (
                                                    <div key={member.cap_id} className="flex items-center gap-1.5 min-w-0">
                                                        <PlayerInfo
                                                            userId={member.user}
                                                            alias={member.alias}
                                                            size="sm"
                                                            highlight={currentUserId != null && String(member.user) === String(currentUserId)}
                                                        />
                                                        {!member.verified && (
                                                            <span className="text-[9px] uppercase tracking-wider text-amber-300/80">
                                                                pending demo
                                                            </span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </DataTableCell>
                                        <DataTableCell align="center">
                                            {medalIcon && (
                                                <Tooltip content={medalLabel} side="top">
                                                    <img src={medalIcon} alt={medalLabel} className="size-4 inline-block shrink-0 object-contain max-w-none" />
                                                </Tooltip>
                                            )}
                                        </DataTableCell>
                                        <DataTableCell align="right">
                                            <CapTimeLink
                                                teamCapId={entry.id}
                                                seconds={entry.cap_time_seconds}
                                                className={cn(
                                                    'text-sm font-mono tabular-nums font-bold',
                                                    activeTab === 'verified' && rank === 1 ? 'text-red-300' : 'text-foreground',
                                                )}
                                            />
                                        </DataTableCell>
                                        <DataTableCell align="center">
                                            <span className={cn(
                                                'inline-flex items-center gap-1 h-6 px-2 rounded-md border text-[11px] font-semibold',
                                                entry.verified
                                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                                                    : 'bg-hairline/5 border-hairline/10 text-muted-foreground',
                                            )}>
                                                {entry.verified
                                                    ? <ShieldCheck className="size-3" />
                                                    : <ShieldAlert className="size-3" />}
                                                {entry.state === 'incomplete' ? 'Incomplete' : entry.verified ? 'Verified' : 'Certified'}
                                            </span>
                                        </DataTableCell>
                                        <DataTableCell align="right">
                                            <Tooltip content={exactTimestamp} side="top">
                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                    {formatAddedDate(entry.added)}
                                                </span>
                                            </Tooltip>
                                        </DataTableCell>
                                    </DataTableRow>
                                )
                            })
                        )}
                    </tbody>
                </DataTableShell>

                {!loading && sorted.length > 0 && (
                    <div className="px-4 py-3 border-t border-hairline/5">
                        <PaginationBar
                            page={safePage}
                            totalPages={totalPages}
                            pageSize={pageSize}
                            totalForCount={sorted.length}
                            pageSizePreference={pageSize}
                            autoPageSize={pageSize}
                            onPageChange={setPage}
                            onPageSizeChange={(pref) => setPageSize(pref === 'auto' ? 10 : pref)}
                        />
                    </div>
                )}
            </div>
        </div>
    )
}
