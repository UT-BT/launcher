import { useCallback, useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { fetchUncappedMaps, fetchUncappedMapsCount, type Map as ApiMap } from '@/app/utils/api'
import { usePaginatedQuery } from '@/app/hooks/useAsync'
import { useNavState } from '@/app/components/navigation/useNavState'
import { displayMapName } from '@/app/utils/format'
import { difficultyBgColor } from '@/app/utils/scoreColors'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell,
    DataTableRow, DataTableCell, DataTableEmpty, DataTableSkeletonRow,
    type SortDirection, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { PaginationBar } from '@/app/components/ui/pagination'

interface UncappedMapsCardProps {
    accessToken: string | undefined
    userId: string | number
    onMapSelect?: (mapName: string) => void
    tabsSlot?: React.ReactNode
}

const DEBOUNCE_MS = 250

type SortField = 'name' | 'difficulty' | 'added'

type ColumnId = 'name' | 'author' | 'difficulty'

const COLUMNS: ColumnId[] = ['name', 'author', 'difficulty']
const COLUMN_WIDTH: Partial<Record<ColumnId, string>> = { difficulty: '7rem' }
const COLUMN_PRIORITY: Partial<Record<ColumnId, number>> = { difficulty: 80, author: 30 }
const REQUIRED_COLUMNS = new Set<ColumnId>(['name'])

export function UncappedMapsCard({ accessToken, userId, onMapSelect, tabsSlot }: UncappedMapsCardProps) {
    const [total, setTotal] = useState(0)
    const [countLoaded, setCountLoaded] = useState(false)
    const [query, setQuery] = useNavState('uncapped.query', '')
    const [queryRaw, setQueryRaw] = useState(query)
    const [sortField, setSortField] = useNavState<SortField>('uncapped.sortField', 'name')
    const [sortDir, setSortDir] = useNavState<'asc' | 'desc'>('uncapped.sortDir', 'asc')
    const [difficultyTier, setDifficultyTier] = useNavState<'all' | 'beginner' | 'intermediate' | 'advanced' | 'expert'>('uncapped.difficultyTier', 'all')
    const [uncappedPage, setUncappedPage] = useNavState('uncapped.page', 1)
    const [uncappedPageSize, setUncappedPageSize] = useNavState('uncapped.pageSize', 10)

    const difficultyRange = (() => {
        switch (difficultyTier) {
            case 'beginner': return { min: 1, max: 3 }
            case 'intermediate': return { min: 4, max: 6 }
            case 'advanced': return { min: 7, max: 8 }
            case 'expert': return { min: 9, max: 10 }
            default: return { min: undefined, max: undefined }
        }
    })()

    useEffect(() => {
        const t = setTimeout(() => setQuery(queryRaw), DEBOUNCE_MS)
        return () => clearTimeout(t)
    }, [queryRaw, setQuery])

    useEffect(() => {
        let cancelled = false
        if (!accessToken) return
        if (countLoaded && !query && difficultyTier === 'all') return
        fetchUncappedMapsCount(accessToken, userId)
            .then(n => { if (!cancelled) { setTotal(n); setCountLoaded(true) } })
        return () => { cancelled = true }
    }, [accessToken, userId, countLoaded, query, difficultyTier])

    const {
        page, pageSize, items, loading, setPage, setPageSize,
    } = usePaginatedQuery<ApiMap>({
        enabled: !!accessToken,
        deps: [accessToken, userId, query, sortField, sortDir, difficultyRange.min, difficultyRange.max],
        page: uncappedPage,
        pageSize: uncappedPageSize,
        onPageChange: setUncappedPage,
        onPageSizeChange: setUncappedPageSize,
        fetchPage: async ({ limit, offset }) => {
            const rows = await fetchUncappedMaps(accessToken!, userId, {
                limit, offset,
                mapFuzzy: query || undefined,
                sort: sortField,
                order: sortDir,
                difficultyMin: difficultyRange.min,
                difficultyMax: difficultyRange.max,
            })
            return { items: rows, total: rows.length }
        },
    })

    const isFiltered = !!query || difficultyTier !== 'all'
    const filteredTotal = isFiltered ? (items.length === pageSize ? page * pageSize + 1 : (page - 1) * pageSize + items.length) : total
    const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize))

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir(field === 'name' ? 'asc' : 'desc')
        }
    }
    const dir = (field: SortField): SortDirection => sortField === field ? sortDir : null

    const responsiveColumns = useMemo<ResponsiveColumn[]>(
        () => COLUMNS.map(id => ({
            id,
            width: COLUMN_WIDTH[id],
            priority: COLUMN_PRIORITY[id],
            required: REQUIRED_COLUMNS.has(id),
        })),
        [],
    )
    const [resolved, setResolved] = useState<Set<ColumnId> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => {
        setResolved(ids as Set<ColumnId>)
    }, [])
    const isVisible = (id: ColumnId): boolean => !resolved || resolved.has(id)
    const visibleColumnCount = COLUMNS.reduce((n, id) => n + (isVisible(id) ? 1 : 0), 0)

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 gap-y-2 px-4 py-3 border-b border-hairline/5 flex-wrap">
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
                            className="w-full sm:w-44 pl-7 pr-2 py-1 bg-card/50 border border-hairline/10 rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent-500/50"
                        />
                    </div>
                    <select
                        value={difficultyTier}
                        onChange={e => setDifficultyTier(e.target.value as 'all' | 'beginner' | 'intermediate' | 'advanced' | 'expert')}
                        style={{ colorScheme: 'dark' }}
                        className="px-2 py-1 bg-card/50 border border-hairline/10 rounded text-xs text-foreground focus:outline-none focus:border-accent-500/50 cursor-pointer"
                    >
                        <option value="all" className="bg-[#0f1115]">All difficulties</option>
                        <option value="beginner" className="bg-[#0f1115]">Beginner (1–3)</option>
                        <option value="intermediate" className="bg-[#0f1115]">Intermediate (4–6)</option>
                        <option value="advanced" className="bg-[#0f1115]">Advanced (7–8)</option>
                        <option value="expert" className="bg-[#0f1115]">Expert (9–10)</option>
                    </select>
                </div>
            </div>

            <DataTableShell
                className="!flex-none !min-h-0 !overflow-visible !rounded-none !border-0"
                responsive={{ columns: responsiveColumns, onResolve: handleResolve }}
            >
                <DataTableHeaderRow>
                    {isVisible('name') && <DataTableHeaderCell sortable sortDirection={dir('name')} onSort={() => handleSort('name')}>Map</DataTableHeaderCell>}
                    {isVisible('author') && <DataTableHeaderCell>Author</DataTableHeaderCell>}
                    {isVisible('difficulty') && <DataTableHeaderCell align="center" width="7rem" sortable sortDirection={dir('difficulty')} onSort={() => handleSort('difficulty')}>Difficulty</DataTableHeaderCell>}
                </DataTableHeaderRow>
                <tbody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <DataTableSkeletonRow key={i} columnCount={visibleColumnCount} />
                        ))
                    ) : items.length === 0 ? (
                        <DataTableEmpty colSpan={visibleColumnCount} message={query ? 'No uncapped maps match that search.' : 'All caught up — no uncapped maps.'} />
                    ) : (
                        items.map(m => (
                            <DataTableRow
                                key={m.name}
                                className="cursor-pointer"
                                onClick={() => onMapSelect?.(m.name)}
                            >
                                {isVisible('name') && (
                                    <DataTableCell>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <MapThumbnail mapName={m.name} className="size-8 shrink-0" />
                                            <span className="text-sm font-semibold text-foreground truncate">
                                                {displayMapName(m.name)}
                                            </span>
                                        </div>
                                    </DataTableCell>
                                )}
                                {isVisible('author') && (
                                    <DataTableCell>
                                        <span className="text-xs text-muted-foreground truncate">
                                            {m.author_str ?? String(m.author ?? '—')}
                                        </span>
                                    </DataTableCell>
                                )}
                                {isVisible('difficulty') && (
                                    <DataTableCell align="center">
                                        {m.difficulty != null ? (
                                            <span className={`inline-flex items-center justify-center size-5 rounded text-[10px] font-bold text-foreground ${difficultyBgColor(m.difficulty)}`}>
                                                {m.difficulty}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </DataTableCell>
                                )}
                            </DataTableRow>
                        ))
                    )}
                </tbody>
            </DataTableShell>

            {!loading && filteredTotal > 0 && (
                <div className="px-4 py-3 border-t border-hairline/5">
                    <PaginationBar
                        page={page}
                        totalPages={totalPages}
                        pageSize={pageSize}
                        totalForCount={filteredTotal}
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
