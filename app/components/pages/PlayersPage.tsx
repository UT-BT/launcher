import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRefreshCooldown } from '@/app/hooks/useRefreshCooldown'
import { useAutoPageSize } from '@/app/hooks/useAutoPageSize'
import { Search, RefreshCw, X, HelpCircle, ShieldAlert } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { Modal } from '@/app/components/ui/modal'
import { Tooltip } from '@/app/components/ui/tooltip'
import {
    UserProfile, PlayerListRow, PlayerSortField,
    fetchPlayers, fetchPlayersCount,
} from '@/app/utils/api'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { Tutorial } from '@/app/components/shared/Tutorial'
import { useTutorialState } from '@/app/components/shared/useTutorialState'
import { buildSteps } from '@/app/components/pages/players/playersTutorialSteps'
import { PaginationBar } from '@/app/components/ui/pagination'
import { ColumnsMenu } from '@/app/components/shared/ColumnsMenu'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow,
    DataTableCell, DataTableEmpty, DataTableSkeletonRow, type SortDirection,
} from '@/app/components/shared/DataTable'
import { formatAddedDate } from '@/app/utils/format'
import { ROLE_LABELS } from '@/app/utils/roles'

import championIcon from '@/app/assets/champion.png'
import goldIcon from '@/app/assets/gold.png'
import silverIcon from '@/app/assets/silver.png'
import bronzeIcon from '@/app/assets/bronze.png'
import worldRecordIcon from '@/app/assets/world_record.png'

export type SortDir = 'asc' | 'desc'

export type PlayerColumnId =
    | 'rank' | 'player' | 'role' | 'points' | 'world_records'
    | 'champion_medals' | 'gold_medals' | 'silver_medals' | 'bronze_medals'
    | 'registered_at'

const COLUMN_LABELS: Record<PlayerColumnId, string> = {
    rank: 'Rank',
    player: 'Player',
    role: 'Role',
    points: 'Points',
    world_records: 'World Records',
    champion_medals: 'Champion',
    gold_medals: 'Gold',
    silver_medals: 'Silver',
    bronze_medals: 'Bronze',
    registered_at: 'Member Since',
}

const DEFAULT_COLUMN_ORDER: PlayerColumnId[] = [
    'rank', 'player', 'role', 'points', 'world_records',
    'champion_medals', 'gold_medals', 'silver_medals', 'bronze_medals', 'registered_at',
]

const DEFAULT_COLUMN_VISIBILITY: Record<PlayerColumnId, boolean> = {
    rank: true,
    player: true,
    role: true,
    points: true,
    world_records: true,
    champion_medals: false,
    gold_medals: false,
    silver_medals: false,
    bronze_medals: false,
    registered_at: false,
}

const REQUIRED_COLUMNS: ReadonlySet<PlayerColumnId> = new Set<PlayerColumnId>(['player'])

const COLUMN_SORT_FIELD: Partial<Record<PlayerColumnId, PlayerSortField>> = {
    rank: 'rank',
    player: 'alias',
    points: 'points',
    world_records: 'world_records',
    champion_medals: 'champion_medals',
    gold_medals: 'gold_medals',
    silver_medals: 'silver_medals',
    bronze_medals: 'bronze_medals',
    registered_at: 'registered_at',
}

const ASC_FIRST_FIELDS: ReadonlySet<PlayerSortField> = new Set<PlayerSortField>(['rank', 'alias'])

const MEDAL_ICON: Partial<Record<PlayerColumnId, string>> = {
    world_records: worldRecordIcon,
    champion_medals: championIcon,
    gold_medals: goldIcon,
    silver_medals: silverIcon,
    bronze_medals: bronzeIcon,
}

export interface PlayersPageState {
    search: string
    sortBy: PlayerSortField
    sortDir: SortDir
    columnVisibility: Record<PlayerColumnId, boolean>
    columnOrder: PlayerColumnId[]
    currentPage: number
    pageSizePreference: number | 'auto'
    scrollTop: number
}

export interface PlayersPageCaches {
    players: PlayerListRow[]
    totalCount: number
    lastRefreshIso: string | null
}

export const DEFAULT_PLAYERS_STATE: PlayersPageState = {
    search: '',
    sortBy: 'rank',
    sortDir: 'asc',
    columnVisibility: DEFAULT_COLUMN_VISIBILITY,
    columnOrder: DEFAULT_COLUMN_ORDER,
    currentPage: 1,
    pageSizePreference: 'auto',
    scrollTop: 0,
}

export const DEFAULT_PLAYERS_CACHES: PlayersPageCaches = {
    players: [],
    totalCount: 0,
    lastRefreshIso: null,
}

const TABLE_ROW_HEIGHT_PX = 56
const TABLE_CHROME_PX = 260
const AUTO_PAGE_SIZE_MIN_ROWS = 10
const AUTO_PAGE_SIZE_MAX_ROWS = 60
const AUTO_PAGE_SIZE_STEP = 5

function computePageSize(): number {
    if (typeof window === 'undefined') return 25
    const usable = Math.max(window.innerHeight - TABLE_CHROME_PX, TABLE_ROW_HEIGHT_PX * AUTO_PAGE_SIZE_MIN_ROWS)
    const rows = Math.floor(usable / TABLE_ROW_HEIGHT_PX)
    const stepped = Math.floor(rows / AUTO_PAGE_SIZE_STEP) * AUTO_PAGE_SIZE_STEP
    return Math.min(AUTO_PAGE_SIZE_MAX_ROWS, Math.max(AUTO_PAGE_SIZE_MIN_ROWS, stepped))
}

const SEARCH_DEBOUNCE_MS = 200

interface PlayersPageProps {
    userProfile?: UserProfile
    state: PlayersPageState
    onStateChange: (updater: (prev: PlayersPageState) => PlayersPageState) => void
    caches: PlayersPageCaches
    onCachesChange: (updater: (prev: PlayersPageCaches) => PlayersPageCaches) => void
}

export function PlayersPage({ userProfile, state, onStateChange, caches, onCachesChange }: PlayersPageProps) {
    const accessToken = userProfile?.accessToken
    const selfId = userProfile?.id ?? undefined

    const autoPageSize = useAutoPageSize(computePageSize)
    const pageSize = state.pageSizePreference === 'auto' ? autoPageSize : state.pageSizePreference

    const [pageLoading, setPageLoading] = useState(caches.players.length === 0)
    const [error, setError] = useState<string | null>(null)

    const refreshCooldown = useRefreshCooldown()

    const [debouncedSearch, setDebouncedSearch] = useState(state.search.trim())
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(state.search.trim()), SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(t)
    }, [state.search])

    // Tutorial
    const tutorial = useTutorialState('utbt:playersPageTutorial:v1')
    const [tutorialActive, setTutorialActive] = useState(false)
    const [tutorialStep, setTutorialStep] = useState(0)
    const [columnsMenuOpen, setColumnsMenuOpen] = useState(false)
    const searchRef = useRef<HTMLInputElement | null>(null)
    const columnsButtonRef = useRef<HTMLButtonElement | null>(null)
    const sortHeaderRef = useRef<HTMLButtonElement | null>(null)
    const firstRowPlayerRef = useRef<HTMLElement | null>(null)

    const startTutorial = useCallback(() => { setTutorialStep(0); setTutorialActive(true) }, [])
    const closeTutorial = useCallback(() => {
        setTutorialActive(false)
        setTutorialStep(0)
        setColumnsMenuOpen(false)
    }, [])

    const scrollContainerRef = useRef<HTMLDivElement | null>(null)

    const serverParams = useMemo(() => ({
        search: debouncedSearch || undefined,
        sort: state.sortBy,
        order: state.sortDir,
    }), [debouncedSearch, state.sortBy, state.sortDir])

    type PageEntry = PlayerListRow[] | Promise<PlayerListRow[] | null>
    type CountEntry = number | Promise<number | null>
    const pageCacheRef = useRef<Record<string, PageEntry>>({})
    const countCacheRef = useRef<Record<string, CountEntry>>({})

    const keyFor = useCallback((p: number) =>
        JSON.stringify({ f: serverParams, s: pageSize, p }),
        [serverParams, pageSize])
    const countKey = useMemo(() => JSON.stringify(serverParams.search ?? ''), [serverParams.search])

    useEffect(() => {
        pageCacheRef.current = {}
    }, [serverParams, pageSize])

    useEffect(() => {
        countCacheRef.current = {}
    }, [debouncedSearch])

    const fetchPageData = useCallback((p: number): Promise<PlayerListRow[] | null> => {
        if (!accessToken) return Promise.resolve(null)
        const key = keyFor(p)
        const existing = pageCacheRef.current[key]
        if (existing !== undefined) {
            return Array.isArray(existing) ? Promise.resolve(existing) : existing
        }
        const offset = (p - 1) * pageSize
        const promise = fetchPlayers(accessToken, { ...serverParams, limit: pageSize, offset })
            .then(rows => { pageCacheRef.current[key] = rows; return rows })
            .catch(() => { delete pageCacheRef.current[key]; return null })
        pageCacheRef.current[key] = promise
        return promise
    }, [accessToken, serverParams, pageSize, keyFor])

    const fetchCountData = useCallback((): Promise<number | null> => {
        if (!accessToken) return Promise.resolve(null)
        const existing = countCacheRef.current[countKey]
        if (existing !== undefined) {
            return typeof existing === 'number' ? Promise.resolve(existing) : existing
        }
        const promise = fetchPlayersCount(accessToken, { search: serverParams.search })
            .then(count => { countCacheRef.current[countKey] = count; return count })
            .catch(() => { delete countCacheRef.current[countKey]; return null })
        countCacheRef.current[countKey] = promise
        return promise
    }, [accessToken, serverParams.search, countKey])

    const loadPage = useCallback(async () => {
        if (!accessToken) return

        const prefetchNeighbours = (totalPages: number) => {
            if (state.currentPage > 1 && !(keyFor(state.currentPage - 1) in pageCacheRef.current)) {
                fetchPageData(state.currentPage - 1)
            }
            if (state.currentPage < totalPages && !(keyFor(state.currentPage + 1) in pageCacheRef.current)) {
                fetchPageData(state.currentPage + 1)
            }
        }

        const cachedPageEntry = pageCacheRef.current[keyFor(state.currentPage)]
        const cachedCountEntry = countCacheRef.current[countKey]
        const cachedPage = Array.isArray(cachedPageEntry) ? cachedPageEntry : undefined
        const cachedCount = typeof cachedCountEntry === 'number' ? cachedCountEntry : undefined

        if (cachedPage) {
            onCachesChange(prev => ({ ...prev, players: cachedPage, totalCount: cachedCount ?? prev.totalCount }))
            setPageLoading(false)
            setError(null)
            prefetchNeighbours(cachedCount ? Math.max(1, Math.ceil(cachedCount / pageSize)) : Infinity)
            return
        }

        setPageLoading(true)
        try {
            const [rows, count] = await Promise.all([fetchPageData(state.currentPage), fetchCountData()])
            if (rows) {
                onCachesChange(prev => ({
                    ...prev,
                    players: rows,
                    totalCount: count ?? prev.totalCount,
                    lastRefreshIso: new Date().toISOString(),
                }))
                setError(null)
                prefetchNeighbours(count ? Math.max(1, Math.ceil(count / pageSize)) : Infinity)
            } else {
                setError('Failed to load players.')
            }
        } finally {
            setPageLoading(false)
        }
    }, [accessToken, state.currentPage, pageSize, keyFor, countKey, fetchPageData, fetchCountData, onCachesChange])

    useEffect(() => { loadPage() }, [loadPage])

    // Restore scroll once on mount.
    useEffect(() => {
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = state.scrollTop
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const onScrollContainerScroll = useCallback(() => {
        if (!scrollContainerRef.current) return
        const top = scrollContainerRef.current.scrollTop
        onStateChange(prev => Math.abs(prev.scrollTop - top) > 24 ? { ...prev, scrollTop: top } : prev)
    }, [onStateChange])

    const totalCount = caches.totalCount
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const page = Math.min(state.currentPage, totalPages)

    // If the current page falls outside range (e.g. a search shrank the list),
    // pull it back in.
    useEffect(() => {
        if (totalCount > 0 && state.currentPage > totalPages) {
            onStateChange(prev => ({ ...prev, currentPage: totalPages }))
        }
    }, [totalCount, totalPages, state.currentPage, onStateChange])

    const setSearch = (value: string) =>
        onStateChange(prev => ({ ...prev, search: value, currentPage: 1 }))

    const handleSort = (field: PlayerSortField) => {
        onStateChange(prev => {
            if (prev.sortBy === field) {
                return { ...prev, sortDir: prev.sortDir === 'asc' ? 'desc' : 'asc', currentPage: 1 }
            }
            return { ...prev, sortBy: field, sortDir: ASC_FIRST_FIELDS.has(field) ? 'asc' : 'desc', currentPage: 1 }
        })
    }

    const directionFor = (field: PlayerSortField): SortDirection =>
        state.sortBy === field ? state.sortDir : null

    const toggleColumn = (id: PlayerColumnId) => {
        if (REQUIRED_COLUMNS.has(id)) return
        onStateChange(prev => ({
            ...prev,
            columnVisibility: { ...prev.columnVisibility, [id]: !prev.columnVisibility[id] },
        }))
    }

    const reorderColumn = (sourceId: PlayerColumnId, targetId: PlayerColumnId) => {
        if (sourceId === targetId) return
        onStateChange(prev => {
            const order = [...prev.columnOrder]
            const from = order.indexOf(sourceId)
            const to = order.indexOf(targetId)
            if (from < 0 || to < 0) return prev
            order.splice(from, 1)
            order.splice(to, 0, sourceId)
            return { ...prev, columnOrder: order }
        })
    }

    const refresh = () => {
        refreshCooldown.trigger(() => {
            pageCacheRef.current = {}
            countCacheRef.current = {}
            void loadPage()
        })
    }

    const visibleColumns = useMemo(
        () => state.columnOrder.filter(id => state.columnVisibility[id] || REQUIRED_COLUMNS.has(id)),
        [state.columnOrder, state.columnVisibility],
    )
    const visibleColumnCount = visibleColumns.length

    const players = caches.players
    const showSkeleton = pageLoading && players.length === 0

    const headerAlign = (id: PlayerColumnId): 'left' | 'center' | 'right' => {
        if (id === 'player' || id === 'role' || id === 'registered_at') return 'left'
        if (id === 'rank' || id === 'points') return 'right'
        return 'center'
    }

    const renderHeaderCell = (id: PlayerColumnId) => {
        const sortField = COLUMN_SORT_FIELD[id]
        return (
            <DataTableHeaderCell
                key={id}
                align={headerAlign(id)}
                sortable={!!sortField}
                sortDirection={sortField ? directionFor(sortField) : null}
                onSort={sortField ? () => handleSort(sortField) : undefined}
                buttonRef={id === 'rank' ? sortHeaderRef : undefined}
            >
                {COLUMN_LABELS[id]}
            </DataTableHeaderCell>
        )
    }

    const renderCell = (id: PlayerColumnId, p: PlayerListRow, isFirst: boolean) => {
        switch (id) {
            case 'player': {
                const isSelf = selfId != null && String(p.id) === String(selfId)
                return (
                    <DataTableCell key={id}>
                        <div className="flex items-center gap-2 min-w-0">
                            <span ref={isFirst ? firstRowPlayerRef : undefined} className="inline-flex min-w-0">
                                <PlayerInfo
                                    userId={p.id}
                                    alias={p.alias}
                                    title={p.active_title}
                                    size="md"
                                    highlight={isSelf}
                                    showYouBadge={isSelf}
                                />
                            </span>
                            {p.banned && <BannedBadge reason={p.ban_reason} expires={p.ban_expires} />}
                        </div>
                    </DataTableCell>
                )
            }
            case 'role': {
                const role = ROLE_LABELS[p.utbt_role]
                return (
                    <DataTableCell key={id}>
                        {role ? (
                            <span className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider',
                                role.className,
                            )}>
                                {role.label}
                            </span>
                        ) : (
                            <span className="text-muted-foreground/40">—</span>
                        )}
                    </DataTableCell>
                )
            }
            case 'rank':
                return (
                    <DataTableCell key={id} align="right">
                        {p.rank > 0
                            ? <span className="font-mono tabular-nums text-white">#{p.rank.toLocaleString()}</span>
                            : <span className="text-muted-foreground/40">—</span>}
                    </DataTableCell>
                )
            case 'points':
                return (
                    <DataTableCell key={id} align="right">
                        <span className={cn('font-mono tabular-nums', p.points > 0 ? 'text-white' : 'text-muted-foreground/40')}>
                            {p.points.toLocaleString()}
                        </span>
                    </DataTableCell>
                )
            case 'registered_at':
                return (
                    <DataTableCell key={id}>
                        <span className="text-muted-foreground">
                            {p.registered_at ? formatAddedDate(p.registered_at) : '—'}
                        </span>
                    </DataTableCell>
                )
            default: {
                const icon = MEDAL_ICON[id]
                const value = (p[id as keyof PlayerListRow] as number) ?? 0
                return (
                    <DataTableCell key={id} align="center">
                        <span className={cn(
                            'inline-flex items-center gap-1.5 font-mono tabular-nums',
                            value > 0 ? 'text-white' : 'text-muted-foreground/40',
                        )}>
                            {icon && (
                                <img
                                    src={icon}
                                    alt=""
                                    width={16}
                                    height={16}
                                    className={cn('size-4 object-contain', value === 0 && 'opacity-40 grayscale')}
                                />
                            )}
                            {value.toLocaleString()}
                        </span>
                    </DataTableCell>
                )
            }
        }
    }

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden">
            <div className="flex items-end justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white leading-tight">Players</h1>
                    {!showSkeleton && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Showing {totalCount.toLocaleString()} {totalCount === 1 ? 'player' : 'players'}
                            {debouncedSearch && <span className="opacity-50"> matching “{debouncedSearch}”</span>}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Tooltip content="Launch Tutorial" side="bottom">
                        <button
                            type="button"
                            onClick={() => startTutorial()}
                            aria-label="Restart Players tutorial"
                            className="p-2 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            <HelpCircle className="size-4" />
                        </button>
                    </Tooltip>
                    <Tooltip content={refreshCooldown.canRefresh ? 'Refresh Data' : `Wait ${refreshCooldown.remainingSeconds}s`} side="bottom">
                        <button
                            type="button"
                            onClick={refresh}
                            disabled={pageLoading || !refreshCooldown.canRefresh}
                            className="p-2 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={cn('size-4', pageLoading && 'animate-spin')} />
                        </button>
                    </Tooltip>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="relative flex-1 min-w-48 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search for a player..."
                        value={state.search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-9 py-2 bg-card/50 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50 focus:bg-card/80 transition-colors"
                    />
                    {state.search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            aria-label="Clear search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors cursor-pointer"
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                </div>

                <ColumnsMenu<PlayerColumnId>
                    columnOrder={state.columnOrder}
                    columnVisibility={state.columnVisibility}
                    columnLabels={COLUMN_LABELS}
                    onToggle={toggleColumn}
                    onReorder={reorderColumn}
                    requiredColumns={REQUIRED_COLUMNS}
                    triggerRef={columnsButtonRef}
                    menuOpen={columnsMenuOpen}
                    onMenuOpenChange={setColumnsMenuOpen}
                />
            </div>

            {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm shrink-0">
                    {error}
                </div>
            )}

            <DataTableShell scrollRef={scrollContainerRef} onScroll={onScrollContainerScroll}>
                <DataTableHeaderRow theadDataAttr="data-utbt-players-thead">
                    {visibleColumns.map(id => renderHeaderCell(id))}
                </DataTableHeaderRow>
                <tbody>
                    {showSkeleton ? (
                        Array.from({ length: Math.min(pageSize, AUTO_PAGE_SIZE_MAX_ROWS) }).map((_, i) => (
                            <DataTableSkeletonRow key={i} columnCount={visibleColumnCount} />
                        ))
                    ) : players.length === 0 ? (
                        <DataTableEmpty
                            colSpan={visibleColumnCount}
                            message={debouncedSearch ? 'No players match your search.' : 'No players found.'}
                        />
                    ) : (
                        players.map((p, index) => (
                            <DataTableRow key={p.id}>
                                {visibleColumns.map(id => renderCell(id, p, index === 0))}
                            </DataTableRow>
                        ))
                    )}
                </tbody>
            </DataTableShell>

            {!showSkeleton && totalCount > 0 && (
                <PaginationBar
                    page={page}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalForCount={totalCount}
                    meta={debouncedSearch ? 'search' : undefined}
                    pageSizePreference={state.pageSizePreference}
                    autoPageSize={autoPageSize}
                    onPageChange={p => onStateChange(prev => ({ ...prev, currentPage: p }))}
                    onPageSizeChange={pref => onStateChange(prev => ({ ...prev, pageSizePreference: pref, currentPage: 1 }))}
                />
            )}

            <Modal
                isOpen={!tutorial.seen && !tutorialActive}
                onClose={tutorial.markSeen}
                title="First time here?"
                className="w-[95%] sm:w-[440px] max-w-md"
                offsetSidebar
                footer={
                    <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2 shrink-0">
                        <Button variant="ghost" onClick={tutorial.markSeen}>
                            Skip
                        </Button>
                        <Button onClick={() => { tutorial.markSeen(); startTutorial() }}>
                            Start tutorial
                        </Button>
                    </div>
                }
            >
                <p className="text-sm text-muted-foreground">
                    Looks like it's your first time on the Players page! Would you like a quick tour of how to find and explore players? <br /><br />
                    If not, you can reopen it anytime using the <HelpCircle className="inline size-3.5 align-text-bottom" /> icon in the top right.
                </p>
            </Modal>

            {tutorialActive && (
                <Tutorial
                    ariaLabel="Players page tutorial"
                    steps={buildSteps(
                        { searchRef, columnsButtonRef, sortHeaderRef, firstRowPlayerRef },
                        { setColumnsMenuOpen },
                    )}
                    step={tutorialStep}
                    setStep={setTutorialStep}
                    onClose={closeTutorial}
                />
            )}
        </div>
    )
}

function BannedBadge({ reason, expires }: { reason: string | null; expires: string | null }) {
    const tooltip = (
        <span className="block normal-case tracking-normal">
            <span className="font-bold uppercase tracking-wider text-red-300">Banned</span>
            {reason && <span className="block mt-0.5 font-normal">{reason}</span>}
            {expires && <span className="block mt-0.5 font-normal text-white/60">Until {formatAddedDate(expires)}</span>}
        </span>
    )
    return (
        <Tooltip side="top" content={tooltip}>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border border-red-500/40 bg-red-500/10 text-red-300 text-[10px] font-bold uppercase tracking-wider shrink-0 cursor-help">
                <ShieldAlert className="size-3" />
                Banned
            </span>
        </Tooltip>
    )
}
