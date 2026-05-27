import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { fetchUncappedMaps, fetchUncappedMapsCount, type Map as ApiMap } from '@/app/utils/api'
import { displayMapName } from '@/app/utils/format'
import { difficultyBgColor } from '@/app/utils/scoreColors'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell,
    DataTableRow, DataTableCell, DataTableEmpty, DataTableSkeletonRow,
    type SortDirection,
} from '@/app/components/shared/DataTable'
import { PaginationBar } from '@/app/components/ui/pagination'

interface UncappedMapsCardProps {
    accessToken: string | undefined
    userId: string | number
    onMapSelect?: (mapName: string) => void
    tabsSlot?: React.ReactNode
}

const SKELETON_COL_COUNT = 4
const DEBOUNCE_MS = 250

type SortField = 'name' | 'difficulty' | 'added'

export function UncappedMapsCard({ accessToken, userId, onMapSelect, tabsSlot }: UncappedMapsCardProps) {
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [items, setItems] = useState<ApiMap[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [countLoaded, setCountLoaded] = useState(false)
    const [queryRaw, setQueryRaw] = useState('')
    const [query, setQuery] = useState('')
    const [sortField, setSortField] = useState<SortField>('name')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
    const [difficultyTier, setDifficultyTier] = useState<'all' | 'beginner' | 'intermediate' | 'advanced' | 'expert'>('all')

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
    }, [queryRaw])

    useEffect(() => { setPage(1) }, [query, sortField, sortDir, difficultyTier])

    useEffect(() => {
        let cancelled = false
        if (!accessToken) return
        if (countLoaded && !query && difficultyTier === 'all') return
        fetchUncappedMapsCount(accessToken, userId)
            .then(n => { if (!cancelled) { setTotal(n); setCountLoaded(true) } })
        return () => { cancelled = true }
    }, [accessToken, userId, countLoaded, query, difficultyTier])

    useEffect(() => {
        let cancelled = false
        if (!accessToken) return
        setLoading(true)
        const offset = (page - 1) * pageSize
        fetchUncappedMaps(accessToken, userId, {
            limit: pageSize, offset,
            mapFuzzy: query || undefined,
            sort: sortField,
            order: sortDir,
            difficultyMin: difficultyRange.min,
            difficultyMax: difficultyRange.max,
        })
            .then(rows => { if (!cancelled) setItems(rows) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [accessToken, userId, page, pageSize, query, sortField, sortDir, difficultyRange.min, difficultyRange.max])

    const isFiltered = !!query || difficultyTier !== 'all'
    const filteredTotal = isFiltered ? (items.length === pageSize ? page * pageSize + 1 : (page - 1) * pageSize + items.length) : total
    const totalPages = Math.max(1, Math.ceil(filteredTotal / pageSize))

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir(field === 'name' ? 'asc' : 'desc')
        }
    }
    const dir = (field: SortField): SortDirection => sortField === field ? sortDir : null

    return (
        <div className="bg-card/30 border border-white/5 rounded-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/5 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                    {tabsSlot}
                    {total > 0 && <span className="text-[10px] text-white/40 font-mono tabular-nums">{total.toLocaleString()}</span>}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                    <div className="relative">
                        <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={queryRaw}
                            onChange={e => setQueryRaw(e.target.value)}
                            placeholder="Search map…"
                            className="w-44 pl-7 pr-2 py-1 bg-card/50 border border-white/10 rounded text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50"
                        />
                    </div>
                    <select
                        value={difficultyTier}
                        onChange={e => setDifficultyTier(e.target.value as 'all' | 'beginner' | 'intermediate' | 'advanced' | 'expert')}
                        style={{ colorScheme: 'dark' }}
                        className="px-2 py-1 bg-card/50 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
                    >
                        <option value="all" className="bg-[#0f1115]">All difficulties</option>
                        <option value="beginner" className="bg-[#0f1115]">Beginner (1–3)</option>
                        <option value="intermediate" className="bg-[#0f1115]">Intermediate (4–6)</option>
                        <option value="advanced" className="bg-[#0f1115]">Advanced (7–8)</option>
                        <option value="expert" className="bg-[#0f1115]">Expert (9–10)</option>
                    </select>
                </div>
            </div>

            <DataTableShell className="!flex-none !min-h-0 !overflow-visible !rounded-none !border-0">
                <DataTableHeaderRow>
                    <DataTableHeaderCell sortable sortDirection={dir('name')} onSort={() => handleSort('name')}>Map</DataTableHeaderCell>
                    <DataTableHeaderCell>Author</DataTableHeaderCell>
                    <DataTableHeaderCell align="center" width="7rem" sortable sortDirection={dir('difficulty')} onSort={() => handleSort('difficulty')}>Difficulty</DataTableHeaderCell>
                    <DataTableHeaderCell width="14rem">Tags</DataTableHeaderCell>
                </DataTableHeaderRow>
                <tbody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <DataTableSkeletonRow key={i} columnCount={SKELETON_COL_COUNT} />
                        ))
                    ) : items.length === 0 ? (
                        <DataTableEmpty colSpan={SKELETON_COL_COUNT} message={query ? 'No uncapped maps match that search.' : 'All caught up — no uncapped maps.'} />
                    ) : (
                        items.map(m => {
                            const tags = (m.tags ?? '').split(',').map(t => t.trim()).filter(Boolean)
                            return (
                                <DataTableRow
                                    key={m.name}
                                    className="cursor-pointer"
                                    onClick={() => onMapSelect?.(m.name)}
                                >
                                    <DataTableCell>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <MapThumbnail mapName={m.name} className="size-8 shrink-0" />
                                            <span className="text-sm font-semibold text-white truncate">
                                                {displayMapName(m.name)}
                                            </span>
                                        </div>
                                    </DataTableCell>
                                    <DataTableCell>
                                        <span className="text-xs text-muted-foreground truncate">
                                            {m.author_str ?? String(m.author ?? '—')}
                                        </span>
                                    </DataTableCell>
                                    <DataTableCell align="center">
                                        {m.difficulty != null ? (
                                            <span className={`inline-flex items-center justify-center size-5 rounded text-[10px] font-bold text-white ${difficultyBgColor(m.difficulty)}`}>
                                                {m.difficulty}
                                            </span>
                                        ) : (
                                            <span className="text-xs text-muted-foreground">—</span>
                                        )}
                                    </DataTableCell>
                                    <DataTableCell>
                                        <div className="flex items-center gap-1 flex-wrap">
                                            {tags.slice(0, 3).map(t => (
                                                <span
                                                    key={t}
                                                    className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/[0.03] border border-white/5 text-[9px] font-medium text-muted-foreground uppercase tracking-wider"
                                                >
                                                    {t}
                                                </span>
                                            ))}
                                        </div>
                                    </DataTableCell>
                                </DataTableRow>
                            )
                        })
                    )}
                </tbody>
            </DataTableShell>

            {!loading && filteredTotal > 0 && (
                <div className="px-4 py-3 border-t border-white/5">
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
