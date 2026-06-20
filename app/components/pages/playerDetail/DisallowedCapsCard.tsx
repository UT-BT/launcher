import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search, ShieldAlert } from 'lucide-react'
import { fetchCapsForUser, type UserCapRow } from '@/app/utils/api'
import { usePaginatedQuery } from '@/app/hooks/useAsync'
import { useNavState } from '@/app/components/navigation/useNavState'
import { formatAddedDate, displayMapName } from '@/app/utils/format'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { Tooltip } from '@/app/components/ui/tooltip'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell,
    DataTableRow, DataTableCell, DataTableEmpty, DataTableSkeletonRow,
    type SortDirection, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { PaginationBar } from '@/app/components/ui/pagination'

interface DisallowedCapsCardProps {
    accessToken: string | undefined
    userId: string | number
    onMapSelect?: (mapName: string) => void
    tabsSlot?: React.ReactNode
}

const DEBOUNCE_MS = 250

type SortField = 'disallowed_at' | 'time' | 'map'

type CapColumnId = 'map' | 'time' | 'reason' | 'disallowed'

const CAP_COLUMNS: CapColumnId[] = ['map', 'time', 'reason', 'disallowed']

const COLUMN_WIDTH: Record<CapColumnId, string | undefined> = {
    map: '32%',
    time: '7rem',
    reason: undefined,
    disallowed: '9rem',
}

const COLUMN_PRIORITY: Partial<Record<CapColumnId, number>> = {
    reason: 10,
    disallowed: 30,
}

const REQUIRED_COLUMNS = new Set<CapColumnId>(['map', 'time'])

function exactTimestamp(iso: string | null | undefined): string {
    if (!iso) return '—'
    const d = new Date(iso)
    return isNaN(d.getTime()) ? iso : d.toLocaleString()
}

export function DisallowedCapsCard({ accessToken, userId, onMapSelect, tabsSlot }: DisallowedCapsCardProps) {
    const [query, setQuery] = useNavState('disallowed.query', '')
    const [queryRaw, setQueryRaw] = useState(query)
    const [sortField, setSortField] = useNavState<SortField>('disallowed.sortField', 'disallowed_at')
    const [sortDir, setSortDir] = useNavState<'asc' | 'desc'>('disallowed.sortDir', 'desc')
    const [capsPage, setCapsPage] = useNavState('disallowed.page', 1)
    const [capsPageSize, setCapsPageSize] = useNavState('disallowed.pageSize', 10)

    const responsiveColumns = useMemo<ResponsiveColumn[]>(
        () => CAP_COLUMNS.map(id => ({
            id,
            width: COLUMN_WIDTH[id],
            priority: COLUMN_PRIORITY[id],
            required: REQUIRED_COLUMNS.has(id),
        })),
        [],
    )
    const [resolved, setResolved] = useState<Set<CapColumnId> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => {
        setResolved(ids as Set<CapColumnId>)
    }, [])
    const isVisible = (id: CapColumnId) => !resolved || resolved.has(id)
    const visibleColumnCount = CAP_COLUMNS.reduce((n, id) => n + (isVisible(id) ? 1 : 0), 0)

    useEffect(() => {
        const t = setTimeout(() => setQuery(queryRaw), DEBOUNCE_MS)
        return () => clearTimeout(t)
    }, [queryRaw, setQuery])

    const {
        page, pageSize, items, total, totalPages, loading, error, setPage, setPageSize,
    } = usePaginatedQuery<UserCapRow>({
        enabled: !!accessToken,
        errorMessage: 'Failed to load disallowed caps.',
        deps: [accessToken, userId, query, sortField, sortDir],
        page: capsPage,
        pageSize: capsPageSize,
        onPageChange: setCapsPage,
        onPageSizeChange: setCapsPageSize,
        fetchPage: ({ limit, offset }) =>
            fetchCapsForUser(accessToken!, userId, {
                limit, offset,
                mapFuzzy: query || undefined,
                capFilter: 'disallowed',
                sort: sortField,
                order: sortDir,
            }),
    })

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir(field === 'map' ? 'asc' : 'desc')
        }
    }

    const dir = (field: SortField): SortDirection => sortField === field ? sortDir : null

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 gap-y-2 px-4 py-3 border-b border-hairline/5 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                    {tabsSlot}
                </div>
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={queryRaw}
                            onChange={e => setQueryRaw(e.target.value)}
                            placeholder="Search map…"
                            className="w-full sm:w-44 pl-7 pr-2 py-1 bg-card/50 border border-hairline/10 rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent-500/50"
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-start gap-2 px-4 py-2.5 border-b border-red-500/30 bg-red-500/10 text-red-300">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed">
                    Caps removed from the leaderboard by anti-cheat moderators. These runs do not count and cannot be watched.
                </p>
            </div>

            {error && (
                <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-red-400 text-xs">
                    {error}
                </div>
            )}

            <DataTableShell
                className="!flex-none !min-h-0 !overflow-visible !rounded-none !border-0"
                responsive={{ columns: responsiveColumns, onResolve: handleResolve }}
            >
                <DataTableHeaderRow>
                    {isVisible('map') && <DataTableHeaderCell width="32%" sortable sortDirection={dir('map')} onSort={() => handleSort('map')}>Map</DataTableHeaderCell>}
                    {isVisible('time') && <DataTableHeaderCell align="right" width="7rem" sortable sortDirection={dir('time')} onSort={() => handleSort('time')}>Time</DataTableHeaderCell>}
                    {isVisible('reason') && <DataTableHeaderCell>Reason</DataTableHeaderCell>}
                    {isVisible('disallowed') && <DataTableHeaderCell align="right" width="9rem" sortable sortDirection={dir('disallowed_at')} onSort={() => handleSort('disallowed_at')}>Disallowed</DataTableHeaderCell>}
                </DataTableHeaderRow>
                <tbody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <DataTableSkeletonRow key={i} columnCount={visibleColumnCount} />
                        ))
                    ) : items.length === 0 ? (
                        <DataTableEmpty colSpan={visibleColumnCount} message={query ? 'No disallowed caps match that search.' : 'No disallowed caps.'} />
                    ) : (
                        items.map(cap => (
                            <DataTableRow
                                key={cap.id}
                                className="cursor-pointer"
                                onClick={() => onMapSelect?.(cap.mapName)}
                            >
                                {isVisible('map') && (
                                    <DataTableCell>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <MapThumbnail mapName={cap.mapName} className="size-8 shrink-0" />
                                            <span className="text-sm font-semibold text-foreground truncate min-w-0">
                                                {displayMapName(cap.mapName)}
                                            </span>
                                        </div>
                                    </DataTableCell>
                                )}
                                {isVisible('time') && (
                                    <DataTableCell align="right">
                                        <CapTimeLink
                                            capId={cap.id}
                                            seconds={cap.time}
                                            className="text-sm font-mono tabular-nums font-bold text-foreground"
                                        />
                                    </DataTableCell>
                                )}
                                {isVisible('reason') && (
                                    <DataTableCell>
                                        {cap.disallow_reason ? (
                                            <span className="text-xs text-muted-foreground line-clamp-2">{cap.disallow_reason}</span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground/60">—</span>
                                        )}
                                    </DataTableCell>
                                )}
                                {isVisible('disallowed') && (
                                    <DataTableCell align="right">
                                        <Tooltip content={exactTimestamp(cap.disallowed_at)} side="top">
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                {cap.disallowed_at ? formatAddedDate(cap.disallowed_at) : '—'}
                                            </span>
                                        </Tooltip>
                                    </DataTableCell>
                                )}
                            </DataTableRow>
                        ))
                    )}
                </tbody>
            </DataTableShell>

            {!loading && total > 0 && (
                <div className="px-4 py-3 border-t border-hairline/5">
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
        </div>
    )
}
