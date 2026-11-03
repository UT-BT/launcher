import { useCallback, useMemo, useState, lazy } from 'react'
import { LazyModalGate } from '@/app/components/shared/LazyModalGate'
import { ImageOff, ImagePlus, Search } from 'lucide-react'
import { fetchMaps, type Map as ApiMap } from '@/app/utils/api'
import { useAsync } from '@/app/hooks/useAsync'
import { useNavState } from '@/app/components/navigation/useNavState'
import { displayMapName, formatAddedDate } from '@/app/utils/format'
import { difficultyBgColor } from '@/app/utils/scoreColors'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { MapNavLink } from '@/app/components/shared/MapNavLink'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell,
    DataTableRow, DataTableCell, DataTableEmpty, DataTableSkeletonRow,
    type ColumnTier, type SortDirection, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { PaginationBar } from '@/app/components/ui/pagination'
import { cn } from '@/lib/utils'

const MapScreenshotModal = lazy(() => import('@/app/components/modals/MapScreenshotModal').then(m => ({ default: m.MapScreenshotModal })))

interface AuthoredMapsCardProps {
    accessToken: string | undefined
    userId: string | number
    isSelf: boolean
    onMapSelect?: (mapName: string) => void
    tabsSlot?: React.ReactNode
}

type SortField = 'name' | 'difficulty' | 'added'

type ColumnId = 'name' | 'difficulty' | 'added' | 'actions'

type ScreenshotState = Pick<ApiMap, 'has_screenshot' | 'screenshot_updated'>

const COLUMN_WIDTH: Partial<Record<ColumnId, string>> = { difficulty: '7rem', added: '9rem', actions: '9rem' }
const COLUMN_PRIORITY: Partial<Record<ColumnId, number>> = { added: 40, difficulty: 60 }
const REQUIRED_COLUMNS = new Set<ColumnId>(['name', 'difficulty', 'actions'])
const COLUMN_TIER: Record<ColumnId, ColumnTier> = { name: 'essential', difficulty: 'essential', added: 'detail', actions: 'detail' }
const COLUMN_LABEL: Record<ColumnId, string> = { name: 'Map', difficulty: 'Difficulty', added: 'Added', actions: 'Screenshot' }
const SORT_KEY: Partial<Record<ColumnId, SortField>> = { name: 'name', difficulty: 'difficulty', added: 'added' }
const CELL_ALIGN: Partial<Record<ColumnId, 'center' | 'right'>> = { difficulty: 'center', added: 'right', actions: 'right' }

const AUTHORED_MAP_COLUMNS = [
    'name', 'added', 'difficulty', 'required_players', 'has_screenshot', 'screenshot_updated',
]

function difficultyChip(difficulty: number | null | undefined) {
    if (difficulty == null) return <span className="text-xs text-muted-foreground">—</span>
    return (
        <span className={cn(
            'inline-flex items-center justify-center size-5 rounded text-[10px] font-bold text-foreground',
            difficultyBgColor(difficulty),
        )}>
            {difficulty}
        </span>
    )
}

export function AuthoredMapsCard({ accessToken, userId, isSelf, onMapSelect, tabsSlot }: AuthoredMapsCardProps) {
    const [query, setQuery] = useState('')
    const [needsScreenshot, setNeedsScreenshot] = useNavState('authored.needsScreenshot', false)
    const [sortField, setSortField] = useNavState<SortField>('authored.sortField', 'added')
    const [sortDir, setSortDir] = useNavState<'asc' | 'desc'>('authored.sortDir', 'desc')
    const [page, setPage] = useNavState('authored.page', 1)
    const [pageSize, setPageSize] = useNavState('authored.pageSize', 10)
    const [editing, setEditing] = useState<ApiMap | null>(null)
    const [overrides, setOverrides] = useState<Record<string, ScreenshotState>>({})

    const { data, loading, error } = useAsync<ApiMap[]>(
        () => fetchMaps(accessToken ?? '', { authorRef: String(userId), columns: AUTHORED_MAP_COLUMNS }),
        [accessToken, userId],
        { enabled: true, errorMessage: 'Failed to load authored maps.' },
    )

    const maps = useMemo(
        () => (data ?? []).map(m => ({ ...m, ...(overrides[m.name] ?? {}) })),
        [data, overrides],
    )

    const missingCount = maps.filter(m => !m.has_screenshot).length

    const rows = useMemo(() => {
        const term = query.trim().toLowerCase()
        const filtered = maps.filter(m =>
            (!term || m.name.toLowerCase().includes(term))
            && (!needsScreenshot || !m.has_screenshot),
        )
        const direction = sortDir === 'asc' ? 1 : -1
        return [...filtered].sort((a, b) => {
            if (sortField === 'name') return a.name.localeCompare(b.name) * direction
            if (sortField === 'difficulty') return ((a.difficulty ?? 0) - (b.difficulty ?? 0)) * direction
            return String(a.added ?? '').localeCompare(String(b.added ?? '')) * direction
        })
    }, [maps, query, needsScreenshot, sortField, sortDir])

    const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))
    const currentPage = Math.min(page, totalPages)
    const visibleRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir(field === 'name' ? 'asc' : 'desc')
        }
        setPage(1)
    }
    const dir = (field: SortField): SortDirection => sortField === field ? sortDir : null

    const columns = useMemo<ColumnId[]>(
        () => isSelf ? ['name', 'difficulty', 'added', 'actions'] : ['name', 'difficulty', 'added'],
        [isSelf],
    )
    const [resolved, setResolved] = useState<Set<ColumnId> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => setResolved(ids as Set<ColumnId>), [])
    const isVisible = (id: ColumnId): boolean => columns.includes(id) && (!resolved || resolved.has(id))
    const visibleColumnCount = columns.reduce((n, id) => n + (isVisible(id) ? 1 : 0), 0)

    const emptyMessage = error ?? (maps.length === 0
        ? 'No maps in rotation are linked to this player.'
        : 'No maps match those filters.')

    const screenshotButton = (m: ApiMap, className?: string) => (
        <button
            type="button"
            onClick={e => { e.stopPropagation(); setEditing(m) }}
            className={cn(
                'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[11px] font-semibold transition-colors cursor-pointer',
                m.has_screenshot
                    ? 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-accent-500/40'
                    : 'bg-accent-500/15 border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:text-foreground',
                className,
            )}
        >
            <ImagePlus className="size-3.5" />
            {m.has_screenshot ? 'Change' : 'Add'}
        </button>
    )

    const authoredCell = (id: ColumnId, m: ApiMap): React.ReactNode => {
        switch (id) {
            case 'name':
                return (
                    <div className="flex items-center gap-2 min-w-0">
                        <MapThumbnail mapName={m.name} version={m.screenshot_updated} className="size-8 shrink-0" />
                        <MapNavLink mapName={m.name} onMapSelect={onMapSelect} className="text-sm font-semibold text-foreground truncate">{displayMapName(m.name)}</MapNavLink>
                    </div>
                )
            case 'difficulty':
                return difficultyChip(m.difficulty)
            case 'added':
                return (
                    <span className="text-xs text-muted-foreground">
                        {m.added ? formatAddedDate(m.added) : '—'}
                    </span>
                )
            case 'actions':
                return screenshotButton(m)
        }
    }

    const responsiveColumns: ResponsiveColumn<ApiMap>[] = columns.map(id => ({
        id,
        width: COLUMN_WIDTH[id],
        priority: COLUMN_PRIORITY[id],
        required: REQUIRED_COLUMNS.has(id),
        tier: COLUMN_TIER[id],
        label: COLUMN_LABEL[id],
        sortKey: SORT_KEY[id],
        cell: m => authoredCell(id, m),
    }))

    const authoredFace = (m: ApiMap) => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
            <div className="flex items-center min-w-0">
                <MapNavLink mapName={m.name} onMapSelect={onMapSelect} className="text-sm font-semibold text-foreground truncate min-w-0">{displayMapName(m.name)}</MapNavLink>
            </div>
            {difficultyChip(m.difficulty)}
        </div>
    )

    const cardPlaceholder = loading ? (
        Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-3 border-b border-hairline/5 last:border-0 animate-pulse">
                <div className="h-10 rounded bg-hairline/5" />
            </div>
        ))
    ) : error || visibleRows.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            {emptyMessage}
        </div>
    ) : undefined

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 gap-y-2 px-4 py-3 border-b border-hairline/5 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                    {tabsSlot}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    {isSelf && (missingCount > 0 || needsScreenshot) && (
                        <button
                            type="button"
                            onClick={() => { setNeedsScreenshot(!needsScreenshot); setPage(1) }}
                            className={cn(
                                'h-7 px-2.5 rounded-md text-xs font-medium border transition-colors cursor-pointer inline-flex items-center gap-1.5 shrink-0',
                                needsScreenshot
                                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                                    : 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20',
                            )}
                        >
                            <ImageOff className="size-3.5" />
                            Needs screenshot
                            <span className="text-[10px] font-mono tabular-nums">{missingCount}</span>
                        </button>
                    )}
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={query}
                            onChange={e => { setQuery(e.target.value); setPage(1) }}
                            placeholder="Search map…"
                            className="w-full sm:w-44 pl-7 pr-2 py-1 bg-card/50 border border-hairline/10 rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent-500/50"
                        />
                    </div>
                </div>
            </div>

            <DataTableShell
                className="!flex-none !min-h-0 !overflow-visible !rounded-none !border-0"
                responsive={{
                    columns: responsiveColumns,
                    nameFloorRem: 14,
                    onResolve: handleResolve,
                    compactAriaLabel: 'Authored maps',
                    cards: {
                        rows: visibleRows,
                        rowKey: m => m.name,
                        face: authoredFace,
                        onOpen: m => onMapSelect?.(m.name),
                        placeholder: cardPlaceholder,
                        sort: {
                            key: sortField,
                            direction: sortDir,
                            onSort: key => handleSort(key as SortField),
                        },
                    },
                }}
            >
                <DataTableHeaderRow>
                    {isVisible('name') && <DataTableHeaderCell sortable sortDirection={dir('name')} onSort={() => handleSort('name')}>Map</DataTableHeaderCell>}
                    {isVisible('difficulty') && <DataTableHeaderCell align="center" width="7rem" sortable sortDirection={dir('difficulty')} onSort={() => handleSort('difficulty')}>Difficulty</DataTableHeaderCell>}
                    {isVisible('added') && <DataTableHeaderCell align="right" width="9rem" sortable sortDirection={dir('added')} onSort={() => handleSort('added')}>Added</DataTableHeaderCell>}
                    {isVisible('actions') && <DataTableHeaderCell align="right" width="9rem">Screenshot</DataTableHeaderCell>}
                </DataTableHeaderRow>
                <tbody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <DataTableSkeletonRow key={i} columnCount={visibleColumnCount} />
                        ))
                    ) : error || visibleRows.length === 0 ? (
                        <DataTableEmpty colSpan={visibleColumnCount} message={emptyMessage} />
                    ) : (
                        visibleRows.map(m => (
                            <DataTableRow
                                key={m.name}
                                className="cursor-pointer"
                                onClick={() => onMapSelect?.(m.name)}
                            >
                                {columns.filter(isVisible).map(id => (
                                    <DataTableCell key={id} align={CELL_ALIGN[id]}>
                                        {authoredCell(id, m)}
                                    </DataTableCell>
                                ))}
                            </DataTableRow>
                        ))
                    )}
                </tbody>
            </DataTableShell>

            {!loading && rows.length > 0 && (
                <div className="px-4 py-3 border-t border-hairline/5">
                    <PaginationBar
                        page={currentPage}
                        totalPages={totalPages}
                        pageSize={pageSize}
                        totalForCount={rows.length}
                        pageSizePreference={pageSize}
                        autoPageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={pref => { setPageSize(pref === 'auto' ? 10 : pref); setPage(1) }}
                    />
                </div>
            )}

            {editing && (
                <LazyModalGate open>
                    <MapScreenshotModal
                        open
                        onClose={() => setEditing(null)}
                        accessToken={accessToken}
                        mapName={editing.name}
                        hasScreenshot={!!editing.has_screenshot}
                        screenshotVersion={editing.screenshot_updated}
                        onUploaded={updated => setOverrides(prev => ({
                            ...prev,
                            [updated.name]: {
                                has_screenshot: updated.has_screenshot,
                                screenshot_updated: updated.screenshot_updated,
                            },
                        }))}
                    />
                </LazyModalGate>
            )}
        </div>
    )
}
