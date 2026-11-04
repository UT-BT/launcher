import { useCallback, useMemo, useState, lazy } from 'react'
import { LazyModalGate } from '@/app/components/shared/LazyModalGate'
import { Play, Download, MessageSquareOff, ShieldCheck, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavState } from '@/app/components/navigation/useNavState'
import { formatAddedDate, formatCapTime } from '@/app/utils/format'
import { getMedalIcon } from '@/app/utils/medals'
import { getTeamDisplay } from '@/app/utils/team'
import { medalIconForInt, medalLabelForInt } from '@/app/components/pages/capDetail/capStats'
import { CapTimeLink, openCap, openTeamCap } from '@/app/components/shared/CapTimeLink'
import { computeMedalTier, TIER_LABELS, type MedalTier } from '@/app/components/pages/maps/medals'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { IconActionButton } from '@/app/components/shared/IconActionButton'
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
    type ColumnTier,
    type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { PaginationBar } from '@/app/components/ui/pagination'
import type { LeaderboardEntry, TeamLeaderboardEntry, MapMetadata } from '@/app/utils/api'
import { isCertifiedCap } from '@/app/utils/capTypes'
import { teamRunStateLabel } from '@/app/utils/teamRunState'
import { canTick, soloCandidate, teamCandidate, toggled, type CompareCandidate, type CompareSelection } from './compareSelection'

const ReplayVideoModal = lazy(() => import('@/app/components/shared/ReplayVideoModal').then(m => ({ default: m.ReplayVideoModal })))
const DemoDownloadStatusModal = lazy(() => import('@/app/components/shared/DemoDownloadStatusModal').then(m => ({ default: m.DemoDownloadStatusModal })))

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
    compare: LeaderboardCompare
}

export interface LeaderboardCompare {
    selection: CompareSelection
    onChange: (ids: string[]) => void
}

export function LeaderboardCard(props: LeaderboardCardProps) {
    const isTeam = props.requiredPlayers != null && props.requiredPlayers > 1
    if (isTeam) {
        return (
            <TeamLeaderboardTable
                teamLeaderboard={props.teamLeaderboard ?? []}
                loading={props.loading}
                currentUserId={props.currentUserId}
                compare={props.compare}
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

type LeaderboardColumnId = 'select' | 'rank' | 'player' | 'team' | 'medal' | 'time' | 'date' | 'watch' | 'download'

const LEADERBOARD_COLUMNS: LeaderboardColumnId[] = ['select', 'rank', 'player', 'medal', 'time', 'team', 'date', 'watch', 'download']

const COLUMN_WIDTH: Record<LeaderboardColumnId, string | undefined> = {
    select: '3rem',
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

const REQUIRED_COLUMNS = new Set<LeaderboardColumnId>(['select', 'player', 'rank', 'time'])

const COLUMN_TIER: Record<LeaderboardColumnId, ColumnTier> = {
    select: 'essential',
    rank: 'essential',
    player: 'essential',
    medal: 'essential',
    time: 'essential',
    team: 'detail',
    date: 'detail',
    watch: 'detail',
    download: 'detail',
}

const COLUMN_LABEL: Record<LeaderboardColumnId, string> = {
    select: 'Select',
    rank: 'Rank',
    player: 'Player',
    medal: 'Medal',
    time: 'Time',
    team: 'Team',
    date: 'Date',
    watch: 'Watch replay',
    download: 'Download demo',
}

const SORT_FIELD: Partial<Record<LeaderboardColumnId, SortField>> = {
    rank: 'rank',
    player: 'player',
    time: 'time',
    date: 'date',
}

type CellLayout = { align?: 'left' | 'center' | 'right'; className?: string }

const CELL_LAYOUT: Partial<Record<LeaderboardColumnId, CellLayout>> = {
    select: { align: 'center' },
    rank: { align: 'right' },
    medal: { align: 'center' },
    time: { align: 'right' },
    team: { align: 'center' },
    date: { align: 'right' },
    watch: { align: 'center', className: 'px-2' },
    download: { align: 'center', className: 'px-2' },
}

interface SoloRow {
    entry: LeaderboardEntry
    rank: number
}

const MEDAL_ICON_KEY: Partial<Record<MedalTier, string>> = {
    world_record: 'world record',
    champion: 'champion medal',
    gold: 'gold medal',
    silver: 'silver medal',
    bronze: 'bronze medal',
    verified: 'certified',
    casual: 'casual',
}

function exactTimestamp(added: string): string {
    const d = new Date(added)
    return isNaN(d.getTime()) ? added : d.toLocaleString()
}

function RankCell({ rank }: { rank: number }) {
    return (
        <span className="text-xs font-bold font-mono text-muted-foreground tabular-nums">
            #{rank}
        </span>
    )
}

function AddedDateCell({ added }: { added: string }) {
    return (
        <Tooltip content={exactTimestamp(added)} side="top">
            <span className="text-xs text-muted-foreground tabular-nums">
                {formatAddedDate(added)}
            </span>
        </Tooltip>
    )
}

function CompareTick({ candidate, label, compare }: { candidate: CompareCandidate; label: string; compare: LeaderboardCompare }) {
    const { selection, onChange } = compare
    return (
        <label className="-m-2 flex size-11 shrink-0 items-center justify-center cursor-pointer">
            <input
                type="checkbox"
                checked={selection.ids.includes(candidate.id)}
                disabled={!canTick(selection, candidate)}
                onChange={() => onChange(toggled(selection, candidate))}
                aria-label={label}
                style={{ colorScheme: 'dark' }}
                className="size-4 accent-accent-500 cursor-pointer"
            />
        </label>
    )
}

function CardSkeleton({ height }: { height: string }) {
    return Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className={cn('mx-3 my-2 rounded-lg bg-hairline/5 animate-pulse', height)} />
    ))
}

function SoloLeaderboardTable({
    leaderboard, map, loading, currentUserId, wrCapId, onShowWrHistory, compare,
}: LeaderboardCardProps) {
    const [tab, setTab] = useNavState<Tab>('leaderboard.tab', 'verified')
    const [sortBy, setSortBy] = useNavState<SortField>('leaderboard.sortBy', 'rank')
    const [sortDir, setSortDir] = useNavState<SortDir>('leaderboard.sortDir', 'asc')
    const [page, setPage] = useNavState('leaderboard.page', 1)
    const [pageSize, setPageSize] = useNavState('leaderboard.pageSize', 10)

    const replay = useReplayWatch()
    const demoDownload = useDemoDownload()

    const [resolved, setResolved] = useState<Set<LeaderboardColumnId> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => {
        setResolved(ids as Set<LeaderboardColumnId>)
    }, [])
    const isVisible = (id: LeaderboardColumnId) => !resolved || resolved.has(id)
    const visibleColumnCount = LEADERBOARD_COLUMNS.reduce((n, id) => n + (isVisible(id) ? 1 : 0), 0)

    const filtered = useMemo(() => {
        if (tab === 'verified') return leaderboard.filter(e => e.verified)
        if (tab === 'certified') return leaderboard.filter(isCertifiedCap)
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
    const isOwnEntry = (entry: LeaderboardEntry) => currentUserId != null && String(entry.user) === String(currentUserId)

    const soloCell = (id: LeaderboardColumnId, { entry, rank }: SoloRow): React.ReactNode => {
        switch (id) {
            case 'select':
                return (
                    <CompareTick
                        candidate={soloCandidate(entry)}
                        label={`Compare ${entry.alias ?? entry.user}, ${formatCapTime(entry.cap_time_seconds)}`}
                        compare={compare}
                    />
                )
            case 'rank':
                return <RankCell rank={rank} />
            case 'player':
                return (
                    <div className="flex items-center gap-1.5 min-w-0">
                        <PlayerInfo
                            userId={entry.user}
                            alias={entry.alias}
                            title={entry.active_title}
                            size="sm"
                            highlight={isOwnEntry(entry)}
                            showYouBadge={isOwnEntry(entry)}
                        />
                        {wrCapId && entry.id === wrCapId && onShowWrHistory && (
                            <WorldRecordHistoryTrigger onClick={onShowWrHistory} />
                        )}
                    </div>
                )
            case 'medal': {
                const tier: MedalTier = computeMedalTier(
                    { map: entry.map, cap_time_seconds: entry.cap_time_seconds, cap_type: entry.cap_type, verified: entry.verified },
                    map ?? undefined,
                )
                const medalIconKey = MEDAL_ICON_KEY[tier]
                const medalIcon = medalIconKey ? getMedalIcon(medalIconKey) : null
                return medalIcon && (
                    <Tooltip content={TIER_LABELS[tier]} side="top">
                        <img src={medalIcon} alt={TIER_LABELS[tier]} className="size-4 inline-block shrink-0 object-contain max-w-none" />
                    </Tooltip>
                )
            }
            case 'time':
                return (
                    <CapTimeLink
                        capId={entry.id}
                        seconds={entry.cap_time_seconds}
                        className={cn(
                            'text-sm font-mono tabular-nums font-bold',
                            rank === 1 ? 'text-red-300' : 'text-foreground',
                        )}
                    />
                )
            case 'team':
                return entry.team == null ? (
                    <span className="text-xs text-muted-foreground">—</span>
                ) : (
                    <span className={cn('text-xs font-medium', getTeamDisplay(entry.team).accent)}>
                        {getTeamDisplay(entry.team).name}
                    </span>
                )
            case 'date':
                return <AddedDateCell added={entry.added} />
            case 'watch':
                return (
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
                )
            case 'download':
                return (
                    <IconActionButton
                        variant="download"
                        icon={Download}
                        tooltip="Download demo"
                        onClick={() => demoDownload.start(entry, entry.map)}
                    />
                )
        }
    }

    const responsiveColumns: ResponsiveColumn<SoloRow>[] = LEADERBOARD_COLUMNS.map(id => ({
        id,
        width: COLUMN_WIDTH[id],
        priority: COLUMN_PRIORITY[id],
        required: REQUIRED_COLUMNS.has(id),
        tier: COLUMN_TIER[id],
        label: COLUMN_LABEL[id],
        sortKey: SORT_FIELD[id],
        cell: row => soloCell(id, row),
    }))

    const soloFace = (row: SoloRow) => (
        <div className="flex items-center gap-3">
            {soloCell('select', row)}
            <div className="grid min-w-0 flex-1 grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-3">
                <span className="text-right">{soloCell('rank', row)}</span>
                {soloCell('player', row)}
                <div className="flex items-center gap-1.5">
                    {soloCell('medal', row)}
                    {soloCell('time', row)}
                </div>
            </div>
        </div>
    )

    const soloPlaceholder = loading ? (
        <CardSkeleton height="h-10" />
    ) : pageRows.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">No caps yet.</div>
    ) : undefined

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
                        compactAriaLabel: 'Map leaderboard',
                        cards: {
                            rows: pageRows,
                            rowKey: row => row.entry.id,
                            face: soloFace,
                            onOpen: row => openCap(row.entry.id),
                            rowClassName: row => isOwnEntry(row.entry) ? 'bg-emerald-500/[0.05]' : undefined,
                            placeholder: soloPlaceholder,
                            sort: {
                                key: sortBy,
                                direction: sortDir,
                                onSort: key => handleSort(key as SortField),
                            },
                        },
                    }}
                >
                    <DataTableHeaderRow>
                        {isVisible('select') && (
                            <DataTableHeaderCell align="center" width="3rem"><span className="sr-only">Select</span></DataTableHeaderCell>
                        )}
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
                            pageRows.map(row => (
                                <DataTableRow key={row.entry.id} className={cn(isOwnEntry(row.entry) && 'bg-emerald-500/[0.05]')}>
                                    {LEADERBOARD_COLUMNS.filter(isVisible).map(id => (
                                        <DataTableCell key={id} align={CELL_LAYOUT[id]?.align} className={CELL_LAYOUT[id]?.className}>
                                            {soloCell(id, row)}
                                        </DataTableCell>
                                    ))}
                                </DataTableRow>
                            ))
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

            <LazyModalGate open={replay.video !== null}>
                <ReplayVideoModal state={replay.video} onClose={replay.clearVideo} />
            </LazyModalGate>

            <Modal
                isOpen={replay.error !== null}
                onClose={replay.clearError}
                title="Replay not available"
                className="w-[95%] sm:w-[440px] max-w-md"
                offsetSidebar
            >
                <p className="text-sm text-muted-foreground">{replay.error}</p>
            </Modal>

            <LazyModalGate open={demoDownload.download !== null}>
                <DemoDownloadStatusModal
                    state={demoDownload.download}
                    onClose={demoDownload.clear}
                />
            </LazyModalGate>
        </div>
    )
}

type TeamTab = 'verified' | 'all'
type TeamSortField = 'rank' | 'time' | 'date'

const TEAM_TABS: { value: TeamTab; label: string }[] = [
    { value: 'verified', label: 'Verified' },
    { value: 'all', label: 'All' },
]

type TeamColumnId = 'select' | 'rank' | 'team' | 'medal' | 'time' | 'status' | 'date'

const TEAM_LEADERBOARD_COLUMNS: (Omit<ResponsiveColumn, 'id'> & { id: TeamColumnId; align?: CellLayout['align'] })[] = [
    { id: 'select', width: '3rem', required: true, tier: 'essential', label: 'Select', align: 'center' },
    { id: 'rank', width: '4rem', required: true, tier: 'essential', label: 'Rank', sortKey: 'rank', align: 'right' },
    { id: 'team', width: '10rem', required: true, tier: 'essential', label: 'Team' },
    { id: 'medal', width: '3rem', required: true, tier: 'essential', label: 'Medal', align: 'center' },
    { id: 'time', width: '8rem', required: true, tier: 'essential', label: 'Team Time', sortKey: 'time', align: 'right' },
    { id: 'status', width: '7rem', required: true, tier: 'detail', label: 'Status', align: 'center' },
    { id: 'date', width: '8rem', required: true, tier: 'detail', label: 'Date', sortKey: 'date', align: 'right' },
]

interface TeamRow {
    entry: TeamLeaderboardEntry
    rank: number
}

interface TeamLeaderboardTableProps {
    teamLeaderboard: TeamLeaderboardEntry[]
    loading: boolean
    currentUserId?: string | number
    highlightTeamCapId?: string | null
    highlightMemberKey?: string | number | null
    compare: LeaderboardCompare
}

export function TeamLeaderboardTable({
    teamLeaderboard, loading, currentUserId, highlightTeamCapId, highlightMemberKey, compare,
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

    const isHighlighted = (entry: TeamLeaderboardEntry) => {
        if (highlightTeamCapId == null && highlightMemberKey == null) {
            return currentUserId != null && (entry.members ?? []).some(m => String(m.user) === String(currentUserId))
        }
        return (highlightTeamCapId != null && String(entry.id) === String(highlightTeamCapId)) ||
            (highlightMemberKey != null && String(entry.user) === String(highlightMemberKey))
    }

    const teamCell = (id: TeamColumnId, { entry, rank }: TeamRow): React.ReactNode => {
        switch (id) {
            case 'select':
                return (
                    <CompareTick
                        candidate={teamCandidate(entry)}
                        label={`Compare ${(entry.members ?? []).map(member => member.alias ?? member.user).join(' & ')}, ${formatCapTime(entry.cap_time_seconds)}`}
                        compare={compare}
                    />
                )
            case 'rank':
                return <RankCell rank={rank} />
            case 'team':
                return (
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
                )
            case 'medal': {
                const medalIcon = entry.verified ? medalIconForInt(entry.medal) : null
                const medalLabel = medalLabelForInt(entry.medal)
                return medalIcon && (
                    <Tooltip content={medalLabel} side="top">
                        <img src={medalIcon} alt={medalLabel} className="size-4 inline-block shrink-0 object-contain max-w-none" />
                    </Tooltip>
                )
            }
            case 'time':
                return (
                    <CapTimeLink
                        teamCapId={entry.id}
                        seconds={entry.cap_time_seconds}
                        className={cn(
                            'text-sm font-mono tabular-nums font-bold',
                            activeTab === 'verified' && rank === 1 ? 'text-red-300' : 'text-foreground',
                        )}
                    />
                )
            case 'status':
                return (
                    <span className={cn(
                        'inline-flex items-center gap-1 h-6 px-2 rounded-md border text-[11px] font-semibold',
                        entry.verified
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-hairline/5 border-hairline/10 text-muted-foreground',
                    )}>
                        {entry.verified
                            ? <ShieldCheck className="size-3" />
                            : <ShieldAlert className="size-3" />}
                        {teamRunStateLabel(entry.state)}
                    </span>
                )
            case 'date':
                return <AddedDateCell added={entry.added} />
        }
    }

    const teamColumns: ResponsiveColumn<TeamRow>[] = TEAM_LEADERBOARD_COLUMNS.map(({ align: _align, ...column }) => ({
        ...column,
        cell: row => teamCell(column.id, row),
    }))

    const teamFace = (row: TeamRow) => (
        <div className="flex items-start gap-3">
            {teamCell('select', row)}
            <div className="grid min-w-0 flex-1 grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3">
                <span className="pt-1 text-right">{teamCell('rank', row)}</span>
                {teamCell('team', row)}
                <div className="flex items-center gap-1.5 pt-0.5">
                    {teamCell('medal', row)}
                    {teamCell('time', row)}
                </div>
            </div>
        </div>
    )

    const teamPlaceholder = loading ? (
        <CardSkeleton height="h-14" />
    ) : pageRows.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">No team runs yet.</div>
    ) : undefined

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
                        columns: teamColumns,
                        compactAriaLabel: 'Team leaderboard',
                        cards: {
                            rows: pageRows,
                            rowKey: row => String(row.entry.id),
                            face: teamFace,
                            onOpen: row => openTeamCap(row.entry.id),
                            rowClassName: row => isHighlighted(row.entry) ? 'bg-emerald-500/[0.05]' : undefined,
                            placeholder: teamPlaceholder,
                            sort: {
                                key: sortBy,
                                direction: sortDir,
                                onSort: key => handleSort(key as TeamSortField),
                            },
                        },
                    }}
                >
                    <DataTableHeaderRow>
                        <DataTableHeaderCell align="center" width="3rem"><span className="sr-only">Select</span></DataTableHeaderCell>
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
                                <DataTableSkeletonRow key={i} columnCount={TEAM_LEADERBOARD_COLUMNS.length} />
                            ))
                        ) : pageRows.length === 0 ? (
                            <DataTableEmpty colSpan={TEAM_LEADERBOARD_COLUMNS.length} message="No team runs yet." />
                        ) : (
                            pageRows.map(row => (
                                <DataTableRow key={row.entry.id} className={cn(isHighlighted(row.entry) && 'bg-emerald-500/[0.05]')}>
                                    {TEAM_LEADERBOARD_COLUMNS.map(column => (
                                        <DataTableCell key={column.id} align={column.align}>
                                            {teamCell(column.id, row)}
                                        </DataTableCell>
                                    ))}
                                </DataTableRow>
                            ))
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
