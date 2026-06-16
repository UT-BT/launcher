import { useEffect, useState } from 'react'
import { History, Search } from 'lucide-react'
import { fetchUserWorldRecords, fetchWorldRecordProgression, type Record, type WorldRecordProgressionEntry } from '@/app/utils/api'
import { usePaginatedQuery } from '@/app/hooks/useAsync'
import { useNavState } from '@/app/components/navigation/useNavState'
import { formatAddedDate, displayMapName } from '@/app/utils/format'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { Tooltip } from '@/app/components/ui/tooltip'
import { WorldRecordProgressionModal } from '@/app/components/modals/WorldRecordProgressionModal'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell,
    DataTableRow, DataTableCell, DataTableEmpty, DataTableSkeletonRow,
    type SortDirection,
} from '@/app/components/shared/DataTable'
import { PaginationBar } from '@/app/components/ui/pagination'

interface WorldRecordsCardProps {
    accessToken: string | undefined
    userId: string | number
    totalCount: number
    onMapSelect?: (mapName: string) => void
    tabsSlot?: React.ReactNode
}

const SKELETON_COL_COUNT = 4
const DEBOUNCE_MS = 250

type SortField = 'added' | 'time' | 'map'

export function WorldRecordsCard({ accessToken, userId, totalCount, onMapSelect, tabsSlot }: WorldRecordsCardProps) {
    const [query, setQuery] = useNavState('wrs.query', '')
    const [queryRaw, setQueryRaw] = useState(query)
    const [sortField, setSortField] = useNavState<SortField>('wrs.sortField', 'added')
    const [sortDir, setSortDir] = useNavState<'asc' | 'desc'>('wrs.sortDir', 'desc')
    const [wrsPage, setWrsPage] = useNavState('wrs.page', 1)
    const [wrsPageSize, setWrsPageSize] = useNavState('wrs.pageSize', 10)

    const [progressionMap, setProgressionMap] = useState<string | null>(null)
    const [progressionEntries, setProgressionEntries] = useState<WorldRecordProgressionEntry[]>([])
    const [progressionLoading, setProgressionLoading] = useState(false)

    useEffect(() => {
        const t = setTimeout(() => setQuery(queryRaw), DEBOUNCE_MS)
        return () => clearTimeout(t)
    }, [queryRaw, setQuery])

    const {
        page, pageSize, items, loading, error, setPage, setPageSize,
    } = usePaginatedQuery<Record>({
        enabled: !!accessToken,
        errorMessage: 'Failed to load world records.',
        deps: [accessToken, userId, query, sortField, sortDir],
        page: wrsPage,
        pageSize: wrsPageSize,
        onPageChange: setWrsPage,
        onPageSizeChange: setWrsPageSize,
        fetchPage: async ({ limit, offset }) => {
            const rows = await fetchUserWorldRecords(accessToken!, userId, {
                limit, offset,
                sort: sortDir,
                sortBy: sortField,
                mapFuzzy: query || undefined,
            })
            return { items: rows, total: rows.length }
        },
    })

    // No server count for filtered WRs; fall back to total for pagination.
    const total = query ? items.length === pageSize ? page * pageSize + 1 : (page - 1) * pageSize + items.length : totalCount
    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir(field === 'map' ? 'asc' : 'desc')
        }
    }
    const dir = (field: SortField): SortDirection => sortField === field ? sortDir : null

    const openProgression = async (mapName: string) => {
        if (!accessToken) return
        setProgressionMap(mapName)
        setProgressionLoading(true)
        try {
            const entries = await fetchWorldRecordProgression(accessToken, mapName)
            setProgressionEntries(entries)
        } finally {
            setProgressionLoading(false)
        }
    }

    return (
        <div className="bg-card/30 border border-white/5 rounded-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 gap-y-2 px-4 py-3 border-b border-white/5 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                    {tabsSlot}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={queryRaw}
                            onChange={e => setQueryRaw(e.target.value)}
                            placeholder="Search map…"
                            className="w-full sm:w-44 pl-7 pr-2 py-1 bg-card/50 border border-white/10 rounded text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-accent-500/50"
                        />
                    </div>
                </div>
            </div>

            {error && (
                <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-red-400 text-xs">
                    {error}
                </div>
            )}

            <DataTableShell className="!flex-none !min-h-0 !overflow-visible !rounded-none !border-0">
                <DataTableHeaderRow>
                    <DataTableHeaderCell sortable sortDirection={dir('map')} onSort={() => handleSort('map')}>Map</DataTableHeaderCell>
                    <DataTableHeaderCell align="right" width="8rem" sortable sortDirection={dir('time')} onSort={() => handleSort('time')}>Time</DataTableHeaderCell>
                    <DataTableHeaderCell align="right" width="8rem" sortable sortDirection={dir('added')} onSort={() => handleSort('added')}>Set</DataTableHeaderCell>
                    <DataTableHeaderCell align="center" width="4rem"><span className="sr-only">History</span></DataTableHeaderCell>
                </DataTableHeaderRow>
                <tbody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <DataTableSkeletonRow key={i} columnCount={SKELETON_COL_COUNT} />
                        ))
                    ) : items.length === 0 ? (
                        <DataTableEmpty colSpan={SKELETON_COL_COUNT} message={query ? 'No world records match that search.' : 'No world records held.'} />
                    ) : (
                        items.map(r => {
                            const exact = r.added ? (() => {
                                const d = new Date(r.added)
                                return isNaN(d.getTime()) ? r.added : d.toLocaleString()
                            })() : '—'
                            return (
                                <DataTableRow
                                    key={`${r.map}-${r.cap_id}`}
                                    className="cursor-pointer"
                                    onClick={() => onMapSelect?.(r.map)}
                                >
                                    <DataTableCell>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <MapThumbnail mapName={r.map} className="size-8 shrink-0" />
                                            <span className="text-sm font-semibold text-white truncate">
                                                {displayMapName(r.map)}
                                            </span>
                                        </div>
                                    </DataTableCell>
                                    <DataTableCell align="right">
                                        <CapTimeLink
                                            capId={r.cap_id}
                                            seconds={r.cap_time_seconds}
                                            className="text-sm font-mono tabular-nums font-bold text-blue-200"
                                        />
                                    </DataTableCell>
                                    <DataTableCell align="right">
                                        <Tooltip content={exact} side="top">
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                {r.added ? formatAddedDate(r.added) : '—'}
                                            </span>
                                        </Tooltip>
                                    </DataTableCell>
                                    <DataTableCell align="center">
                                        <Tooltip content="View WR progression" side="top">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); openProgression(r.map) }}
                                                className="p-1.5 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                                                aria-label="View WR progression"
                                            >
                                                <History className="size-3.5" />
                                            </button>
                                        </Tooltip>
                                    </DataTableCell>
                                </DataTableRow>
                            )
                        })
                    )}
                </tbody>
            </DataTableShell>

            {!loading && (items.length > 0 || page > 1) && (
                <div className="px-4 py-3 border-t border-white/5">
                    <PaginationBar
                        page={page}
                        totalPages={totalPages}
                        pageSize={pageSize}
                        totalForCount={total}
                        pageSizePreference={pageSize}
                        autoPageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(pref) => { setPageSize(pref === 'auto' ? 10 : pref); setPage(1) }}
                    />
                </div>
            )}

            <WorldRecordProgressionModal
                isOpen={progressionMap !== null && !progressionLoading}
                onClose={() => { setProgressionMap(null); setProgressionEntries([]) }}
                mapName={progressionMap ?? ''}
                entries={progressionEntries}
                currentUserId={userId}
            />
        </div>
    )
}
