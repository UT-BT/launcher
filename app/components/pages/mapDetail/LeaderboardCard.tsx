import { useMemo } from 'react'
import { Play, Download, MessageSquareOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavState } from '@/app/components/navigation/useNavState'
import { formatAddedDate } from '@/app/utils/format'
import { getMedalIcon } from '@/app/utils/medals'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import { computeMedalTier, TIER_LABELS, type MedalTier } from '@/app/components/pages/MapsPage'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { IconActionButton } from '@/app/components/shared/IconActionButton'
import { ReplayVideoModal } from '@/app/components/shared/ReplayVideoModal'
import { DemoDownloadStatusModal } from '@/app/components/shared/DemoDownloadStatusModal'
import { WorldRecordHistoryTrigger } from '@/app/components/modals/WorldRecordProgressionModal'
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
} from '@/app/components/shared/DataTable'
import { PaginationBar } from '@/app/components/ui/pagination'
import type { LeaderboardEntry, MapMetadata } from '@/app/utils/api'

type Tab = 'verified' | 'certified' | 'all'
type SortField = 'rank' | 'player' | 'time' | 'date'
type SortDir = 'asc' | 'desc'

interface LeaderboardCardProps {
    leaderboard: LeaderboardEntry[]
    map: MapMetadata | null
    loading: boolean
    currentUserId?: string | number
    wrCapId?: string | null
    onShowWrHistory?: () => void
}

const TABS: { value: Tab; label: string }[] = [
    { value: 'verified', label: 'Verified' },
    { value: 'certified', label: 'Certified' },
    { value: 'all', label: 'All' },
]

const SKELETON_COL_COUNT = 7

export function LeaderboardCard({
    leaderboard, map, loading, currentUserId, wrCapId, onShowWrHistory,
}: LeaderboardCardProps) {
    const [tab, setTab] = useNavState<Tab>('leaderboard.tab', 'verified')
    const [sortBy, setSortBy] = useNavState<SortField>('leaderboard.sortBy', 'rank')
    const [sortDir, setSortDir] = useNavState<SortDir>('leaderboard.sortDir', 'asc')
    const [page, setPage] = useNavState('leaderboard.page', 1)
    const [pageSize, setPageSize] = useNavState('leaderboard.pageSize', 10)

    const replay = useReplayWatch()
    const demoDownload = useDemoDownload()

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

    return (
        <div className="bg-card/30 border border-white/5 rounded-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5">
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
                                    ? 'bg-blue-500/20 border-blue-500/50 text-blue-200'
                                    : 'bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20',
                            )}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex flex-col">
                <DataTableShell className="!flex-none !min-h-0 !overflow-visible !rounded-none !border-0">
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
                        <DataTableHeaderCell
                            sortable
                            sortDirection={dir('player')}
                            onSort={() => handleSort('player')}
                        >
                            Player
                        </DataTableHeaderCell>
                        <DataTableHeaderCell align="center" width="3rem"><span className="sr-only">Medal</span></DataTableHeaderCell>
                        <DataTableHeaderCell
                            sortable
                            sortDirection={dir('time')}
                            onSort={() => handleSort('time')}
                            align="right"
                            width="8rem"
                        >
                            Time
                        </DataTableHeaderCell>
                        <DataTableHeaderCell
                            sortable
                            sortDirection={dir('date')}
                            onSort={() => handleSort('date')}
                            align="right"
                            width="8rem"
                        >
                            Date
                        </DataTableHeaderCell>
                        <DataTableHeaderCell align="center" width="3rem"><span className="sr-only">Watch</span></DataTableHeaderCell>
                        <DataTableHeaderCell align="center" width="3rem"><span className="sr-only">Download</span></DataTableHeaderCell>
                    </DataTableHeaderRow>
                    <tbody>
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <DataTableSkeletonRow key={i} columnCount={SKELETON_COL_COUNT} />
                            ))
                        ) : pageRows.length === 0 ? (
                            <DataTableEmpty colSpan={SKELETON_COL_COUNT} message="No caps yet." />
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
                                        <DataTableCell align="right">
                                            <span className="text-xs font-bold font-mono text-muted-foreground tabular-nums">
                                                #{rank}
                                            </span>
                                        </DataTableCell>
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
                                        <DataTableCell align="center">
                                            {medalIcon && (
                                                <Tooltip content={TIER_LABELS[tier]} side="top">
                                                    <img src={medalIcon} alt={TIER_LABELS[tier]} className="size-4 inline-block shrink-0 object-contain max-w-none" />
                                                </Tooltip>
                                            )}
                                        </DataTableCell>
                                        <DataTableCell align="right">
                                            <CapTimeLink
                                                capId={entry.id}
                                                seconds={entry.cap_time_seconds}
                                                className={cn(
                                                    'text-sm font-mono tabular-nums font-bold',
                                                    rank === 1 ? 'text-red-300' : 'text-white',
                                                )}
                                            />
                                        </DataTableCell>
                                        <DataTableCell align="right">
                                            <Tooltip content={exactTimestamp} side="top">
                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                    {formatAddedDate(entry.added)}
                                                </span>
                                            </Tooltip>
                                        </DataTableCell>
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
                                        <DataTableCell align="center" className="px-2">
                                            <IconActionButton
                                                variant="download"
                                                icon={Download}
                                                tooltip="Download demo"
                                                onClick={() => demoDownload.start(entry, entry.map)}
                                            />
                                        </DataTableCell>
                                    </DataTableRow>
                                )
                            })
                        )}
                    </tbody>
                </DataTableShell>

                {!loading && sorted.length > 0 && (
                    <div className="px-4 py-3 border-t border-white/5">
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
