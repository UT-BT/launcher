import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatCapTime, formatAddedDate } from '@/app/utils/format'
import { getMedalIcon } from '@/app/utils/medals'
import { computeMedalTier, TIER_LABELS, type MedalTier } from '@/app/components/pages/MapsPage'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
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
}

const TABS: { value: Tab; label: string }[] = [
    { value: 'verified', label: 'Verified' },
    { value: 'certified', label: 'Certified' },
    { value: 'all', label: 'All' },
]

const TIER_TEXT_COLOR: Record<Exclude<MedalTier, 'uncapped'>, string> = {
    casual: 'text-muted-foreground',
    verified: 'text-blue-300',
    bronze: 'text-amber-500',
    silver: 'text-slate-200',
    gold: 'text-yellow-300',
    champion: 'text-purple-300',
    world_record: 'text-red-300',
}

export function LeaderboardCard({ leaderboard, map, loading, currentUserId }: LeaderboardCardProps) {
    const [tab, setTab] = useState<Tab>('verified')
    const [sortBy, setSortBy] = useState<SortField>('rank')
    const [sortDir, setSortDir] = useState<SortDir>('asc')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

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
            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
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
                            align="center"
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
                        <DataTableHeaderCell
                            sortable
                            sortDirection={dir('time')}
                            onSort={() => handleSort('time')}
                            align="right"
                            width="8rem"
                        >
                            Time
                        </DataTableHeaderCell>
                        <DataTableHeaderCell align="center" width="9rem">Medal</DataTableHeaderCell>
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
                                <DataTableSkeletonRow key={i} columnCount={5} />
                            ))
                        ) : pageRows.length === 0 ? (
                            <DataTableEmpty colSpan={5} message="No caps yet." />
                        ) : (
                            pageRows.map(({ entry, rank }) => {
                                const tier = computeMedalTier(
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
                                const tierAccent = tier === 'uncapped' ? 'text-muted-foreground' : TIER_TEXT_COLOR[tier]
                                return (
                                    <DataTableRow key={entry.id} className={cn(isOwn && 'bg-emerald-500/[0.05]')}>
                                        <DataTableCell align="center">
                                            <span className={cn(
                                                'inline-flex items-center justify-center min-w-7 h-6 px-2 rounded font-mono tabular-nums text-xs font-bold',
                                                rank === 1 ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40' :
                                                    rank === 2 ? 'bg-slate-300/15 text-slate-200 border border-slate-300/30' :
                                                        rank === 3 ? 'bg-amber-600/15 text-amber-400 border border-amber-600/30' :
                                                            'bg-white/5 text-muted-foreground border border-white/5',
                                            )}>
                                                {rank}
                                            </span>
                                        </DataTableCell>
                                        <DataTableCell>
                                            <PlayerInfo
                                                userId={entry.user}
                                                alias={entry.alias}
                                                title={entry.active_title}
                                                size="sm"
                                                highlight={isOwn}
                                                showYouBadge={isOwn}
                                            />
                                        </DataTableCell>
                                        <DataTableCell align="right">
                                            <span className={cn(
                                                'text-sm font-mono tabular-nums font-bold',
                                                rank === 1 ? 'text-red-300' : 'text-white',
                                            )}>
                                                {formatCapTime(entry.cap_time_seconds)}
                                            </span>
                                        </DataTableCell>
                                        <DataTableCell align="center">
                                            <div className="inline-flex items-center gap-1.5">
                                                {medalIcon && <img src={medalIcon} alt="" className="size-4" />}
                                                <span className={cn('text-xs font-semibold', tierAccent)}>
                                                    {TIER_LABELS[tier]}
                                                </span>
                                            </div>
                                        </DataTableCell>
                                        <DataTableCell align="right">
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                {formatAddedDate(entry.added)}
                                            </span>
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
        </div>
    )
}
