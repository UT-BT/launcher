import { useEffect, useState } from 'react'
import { Search, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/app/components/ui/tooltip'
import { fetchPlaytimeByMap, type PlaytimeByMapRow } from '@/app/utils/api'
import { formatAddedDate, displayMapName } from '@/app/utils/format'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell,
    DataTableRow, DataTableCell, DataTableEmpty, DataTableSkeletonRow,
    type SortDirection,
} from '@/app/components/shared/DataTable'
import { PaginationBar } from '@/app/components/ui/pagination'

interface PlaytimeBreakdownCardProps {
    accessToken: string | undefined
    userId: string | number
    onMapSelect?: (mapName: string) => void
    tabsSlot?: React.ReactNode
}

const SKELETON_COL_COUNT = 4
const DEBOUNCE_MS = 250

type SortField = 'hours' | 'sessions' | 'last_played' | 'map'

function formatHours(seconds: number): string {
    const hours = seconds / 3600
    if (hours >= 1000) return `${(hours / 1000).toFixed(1)}k h`
    if (hours >= 10) return `${Math.round(hours)} h`
    if (hours >= 1) return `${hours.toFixed(1)} h`
    const minutes = Math.round(seconds / 60)
    return `${minutes} m`
}

export function PlaytimeBreakdownCard({ accessToken, userId, onMapSelect, tabsSlot }: PlaytimeBreakdownCardProps) {
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [items, setItems] = useState<PlaytimeByMapRow[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [queryRaw, setQueryRaw] = useState('')
    const [query, setQuery] = useState('')
    const [favoritesOnly, setFavoritesOnly] = useState(false)
    const [sortField, setSortField] = useState<SortField>('hours')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

    useEffect(() => {
        const t = setTimeout(() => setQuery(queryRaw), DEBOUNCE_MS)
        return () => clearTimeout(t)
    }, [queryRaw])

    useEffect(() => { setPage(1) }, [query, favoritesOnly, sortField, sortDir])

    useEffect(() => {
        let cancelled = false
        if (!accessToken) return
        setLoading(true)
        setError(null)
        const offset = (page - 1) * pageSize
        fetchPlaytimeByMap(accessToken, userId, {
            limit: pageSize, offset,
            mapFuzzy: query || undefined,
            favoritesOnly,
            sort: sortField,
            order: sortDir,
        })
            .then(res => {
                if (cancelled) return
                setItems(res.items)
                setTotal(res.total)
            })
            .catch(err => {
                if (cancelled) return
                console.error('Failed to load playtime by map:', err)
                setError('Failed to load playtime breakdown.')
            })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [accessToken, userId, page, pageSize, query, favoritesOnly, sortField, sortDir])

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir(field === 'map' ? 'asc' : 'desc')
        }
    }
    const dir = (field: SortField): SortDirection => sortField === field ? sortDir : null

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
                            className="w-full sm:w-44 pl-7 pr-2 py-1 bg-card/50 border border-white/10 rounded text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50"
                        />
                    </div>
                    <Tooltip content={favoritesOnly ? 'Showing favorites only' : 'Show favorites only'} side="top">
                        <button
                            type="button"
                            onClick={() => setFavoritesOnly(v => !v)}
                            aria-pressed={favoritesOnly}
                            className={cn(
                                'inline-flex items-center justify-center size-7 rounded-md border transition-colors cursor-pointer',
                                favoritesOnly
                                    ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/25'
                                    : 'bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20',
                            )}
                        >
                            <Star className={cn('size-3.5', favoritesOnly && 'fill-current')} />
                        </button>
                    </Tooltip>
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
                    <DataTableHeaderCell align="right" width="7rem" sortable sortDirection={dir('hours')} onSort={() => handleSort('hours')}>Time</DataTableHeaderCell>
                    <DataTableHeaderCell align="right" width="6rem" sortable sortDirection={dir('sessions')} onSort={() => handleSort('sessions')}>Sessions</DataTableHeaderCell>
                    <DataTableHeaderCell align="right" width="8rem" sortable sortDirection={dir('last_played')} onSort={() => handleSort('last_played')}>Last Played</DataTableHeaderCell>
                </DataTableHeaderRow>
                <tbody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <DataTableSkeletonRow key={i} columnCount={SKELETON_COL_COUNT} />
                        ))
                    ) : items.length === 0 ? (
                        <DataTableEmpty colSpan={SKELETON_COL_COUNT} message={query ? 'No playtime matches that search.' : 'No playtime recorded.'} />
                    ) : (
                        items.map(row => (
                            <DataTableRow
                                key={row.map}
                                className="cursor-pointer"
                                onClick={() => onMapSelect?.(row.map)}
                            >
                                <DataTableCell>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <MapThumbnail mapName={row.map} className="size-8 shrink-0" />
                                        <span className="text-sm font-semibold text-white truncate">
                                            {displayMapName(row.map)}
                                        </span>
                                    </div>
                                </DataTableCell>
                                <DataTableCell align="right">
                                    <span className="text-sm font-mono tabular-nums font-bold text-amber-200">
                                        {formatHours(row.total_seconds)}
                                    </span>
                                </DataTableCell>
                                <DataTableCell align="right">
                                    <span className="text-xs font-mono tabular-nums text-muted-foreground">
                                        {row.sessions.toLocaleString()}
                                    </span>
                                </DataTableCell>
                                <DataTableCell align="right">
                                    <span className="text-xs text-muted-foreground tabular-nums">
                                        {row.last_played ? formatAddedDate(row.last_played) : '—'}
                                    </span>
                                </DataTableCell>
                            </DataTableRow>
                        ))
                    )}
                </tbody>
            </DataTableShell>

            {!loading && total > 0 && (
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
        </div>
    )
}
