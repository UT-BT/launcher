import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { CapTimeLink, openCap } from '@/app/components/shared/CapTimeLink'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
    DataTableEmpty, DataTableSkeletonRow, type ResponsiveColumn, type SortDirection,
} from '@/app/components/shared/DataTable'
import { useNavState } from '@/app/components/navigation/useNavState'
import { cn } from '@/lib/utils'
import { displayMapName, formatAddedDate } from '@/app/utils/format'
import { difficultyTextColor } from '@/app/utils/scoreColors'
import { fetchWorldRecords, fetchWorldRecordsCount, type Record as WorldRecordRow } from '@/app/utils/api'
import { SectionHeader, teamErrorMessage } from './teamsShared'

const PAGE_SIZE = 8

type WrSortField = 'holder' | 'map' | 'difficulty' | 'time' | 'date'

const COLUMNS: ResponsiveColumn[] = [
    { id: 'holder', width: '15rem', priority: 55, required: true },
    { id: 'map', width: '10rem', priority: 60, required: true },
    { id: 'difficulty', width: '5rem', priority: 40 },
    { id: 'time', width: '6rem', priority: 70 },
    { id: 'date', width: '6.5rem', priority: 30 },
]

const DEFAULT_DIR: Record<WrSortField, 'asc' | 'desc'> = { holder: 'asc', map: 'asc', difficulty: 'desc', time: 'asc', date: 'desc' }

interface TeamWorldRecordsPanelProps {
    accessToken: string
    teamId: string
    memberIds: string[]
    selfUserId?: string
}

export function TeamWorldRecordsPanel({ accessToken, teamId, memberIds, selfUserId }: TeamWorldRecordsPanelProps) {
    const users = useMemo(() => memberIds.join(','), [memberIds])
    const [page, setPage] = useNavState(`team-wr-page-${teamId}`, 1)
    const [sort, setSort] = useNavState<{ by: WrSortField; dir: 'asc' | 'desc' }>(`team-wr-sort-${teamId}`, { by: 'date', dir: 'desc' })
    const [records, setRecords] = useState<WorldRecordRow[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const [resolved, setResolved] = useState<Set<string> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => setResolved(ids), [])
    const isVisible = (id: string) => !resolved || resolved.has(id)
    const visibleCount = COLUMNS.filter(c => isVisible(c.id)).length

    useEffect(() => {
        if (!users) {
            setRecords([])
            setTotal(0)
            setLoading(false)
            return
        }
        let cancelled = false
        setLoading(true)
        setError(null)
        Promise.all([
            fetchWorldRecords(accessToken, { users, sortBy: sort.by, sort: sort.dir, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
            fetchWorldRecordsCount(accessToken, { users }),
        ])
            .then(([rows, count]) => {
                if (cancelled) return
                setRecords(rows)
                setTotal(count)
            })
            .catch(e => { if (!cancelled) setError(teamErrorMessage(e)) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [accessToken, users, page, sort.by, sort.dir])

    const handleSort = (field: WrSortField) => {
        setPage(1)
        setSort(sort.by === field ? { by: field, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { by: field, dir: DEFAULT_DIR[field] })
    }
    const dirFor = (field: WrSortField): SortDirection => (sort.by === field ? sort.dir : null)

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    return (
        <section>
            <SectionHeader
                title="World Records"
                subtitle={total > 0 ? `${total} held by this team` : undefined}
                accentClass="bg-blue-400"
            />

            {error && <div className="mb-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs">{error}</div>}

            <DataTableShell className="!flex-none" responsive={{ columns: COLUMNS, onResolve: handleResolve }}>
                <DataTableHeaderRow>
                    <DataTableHeaderCell width="15rem" sortable sortDirection={dirFor('holder')} onSort={() => handleSort('holder')}>Holder</DataTableHeaderCell>
                    <DataTableHeaderCell width="10rem" sortable sortDirection={dirFor('map')} onSort={() => handleSort('map')}>Map</DataTableHeaderCell>
                    {isVisible('difficulty') && <DataTableHeaderCell align="center" width="5rem" sortable sortDirection={dirFor('difficulty')} onSort={() => handleSort('difficulty')}>Diff</DataTableHeaderCell>}
                    {isVisible('time') && <DataTableHeaderCell align="right" width="6rem" sortable sortDirection={dirFor('time')} onSort={() => handleSort('time')}>Time</DataTableHeaderCell>}
                    {isVisible('date') && <DataTableHeaderCell align="right" width="6.5rem" sortable sortDirection={dirFor('date')} onSort={() => handleSort('date')}>Date</DataTableHeaderCell>}
                </DataTableHeaderRow>
                <tbody>
                    {loading ? (
                        Array.from({ length: PAGE_SIZE }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={visibleCount} />)
                    ) : records.length === 0 ? (
                        <DataTableEmpty colSpan={visibleCount} message="This team holds no world records yet." />
                    ) : (
                        records.map(r => {
                            const isOwn = selfUserId != null && String(r.user_id) === String(selfUserId)
                            return (
                                <DataTableRow key={r.cap_id} className={cn('cursor-pointer', isOwn && 'bg-emerald-500/[0.05]')} onClick={() => openCap(r.cap_id)}>
                                    <DataTableCell>
                                        <PlayerInfo userId={r.user_id} alias={r.alias} title={r.active_title} size="sm" highlight={isOwn} showYouBadge={isOwn} />
                                    </DataTableCell>
                                    <DataTableCell>
                                        <span className="text-foreground truncate block">{displayMapName(r.map)}</span>
                                    </DataTableCell>
                                    {isVisible('difficulty') && (
                                        <DataTableCell align="center">
                                            {r.difficulty != null ? (
                                                <span className={cn('font-mono tabular-nums text-sm font-bold', difficultyTextColor(r.difficulty))}>{r.difficulty}</span>
                                            ) : (
                                                <span className="text-muted-foreground/50">—</span>
                                            )}
                                        </DataTableCell>
                                    )}
                                    {isVisible('time') && (
                                        <DataTableCell align="right">
                                            <CapTimeLink capId={r.cap_id} seconds={r.cap_time_seconds} className="font-mono tabular-nums font-bold text-blue-300" />
                                        </DataTableCell>
                                    )}
                                    {isVisible('date') && (
                                        <DataTableCell align="right">
                                            <span className="text-xs text-muted-foreground tabular-nums">{r.added ? formatAddedDate(r.added) : '—'}</span>
                                        </DataTableCell>
                                    )}
                                </DataTableRow>
                            )
                        })
                    )}
                </tbody>
            </DataTableShell>

            {totalPages > 1 && (
                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground pt-2">
                    <span className="tabular-nums">Page {page} of {totalPages}</span>
                    <div className="flex items-center gap-1.5">
                        <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(Math.max(1, page - 1))} className="text-muted-foreground hover:text-foreground px-2">
                            <ChevronLeft className="size-4" />
                        </Button>
                        <Button size="sm" variant="ghost" disabled={page >= totalPages} onClick={() => setPage(Math.min(totalPages, page + 1))} className="text-muted-foreground hover:text-foreground px-2">
                            <ChevronRight className="size-4" />
                        </Button>
                    </div>
                </div>
            )}
        </section>
    )
}
