import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAutoPageSize } from '@/app/hooks/useAutoPageSize'
import { useRefreshCooldown } from '@/app/hooks/useRefreshCooldown'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import {
    UserProfile, CapItAllRow, CapItAllLeaderboardPage,
    fetchCapItAllLeaderboard,
} from '@/app/utils/api'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { PaginationBar } from '@/app/components/ui/pagination'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow,
    DataTableCell, DataTableEmpty, DataTableSkeletonRow, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'

type CapItAllColumnId = 'rank' | 'player' | 'certified' | 'noncertified' | 'teammaps' | 'total'

const CAP_IT_ALL_COLUMNS: ResponsiveColumn[] = [
    { id: 'rank', width: '72px', priority: 30, required: true },
    { id: 'player', required: true },
    { id: 'certified', width: '220px', priority: 60 },
    { id: 'noncertified', width: '220px', priority: 50 },
    { id: 'teammaps', width: '220px', priority: 40 },
    { id: 'total', width: '220px', priority: 35 },
]

export interface CapItAllPageState {
    search: string
    currentPage: number
    pageSizePreference: number | 'auto'
    scrollTop: number
}

export interface CapItAllPageCaches {
    items: CapItAllRow[]
    total: number
    mapCount: number
    lastRefreshIso: string | null
    querySig: string | null
}

export const DEFAULT_CAP_IT_ALL_STATE: CapItAllPageState = {
    search: '',
    currentPage: 1,
    pageSizePreference: 'auto',
    scrollTop: 0,
}

export const DEFAULT_CAP_IT_ALL_CACHES: CapItAllPageCaches = {
    items: [],
    total: 0,
    mapCount: 0,
    lastRefreshIso: null,
    querySig: null,
}

const TABLE_ROW_HEIGHT_PX = 56
const TABLE_CHROME_PX = 300
const AUTO_PAGE_SIZE_MIN_ROWS = 10
const AUTO_PAGE_SIZE_MAX_ROWS = 60
const AUTO_PAGE_SIZE_STEP = 1

function computePageSize(): number {
    if (typeof window === 'undefined') return 25
    const usable = Math.max(window.innerHeight - TABLE_CHROME_PX, TABLE_ROW_HEIGHT_PX * AUTO_PAGE_SIZE_MIN_ROWS)
    const rows = Math.floor(usable / TABLE_ROW_HEIGHT_PX)
    const stepped = Math.floor(rows / AUTO_PAGE_SIZE_STEP) * AUTO_PAGE_SIZE_STEP
    return Math.min(AUTO_PAGE_SIZE_MAX_ROWS, Math.max(AUTO_PAGE_SIZE_MIN_ROWS, stepped))
}

const SEARCH_DEBOUNCE_MS = 200

interface CapItAllPageProps {
    userProfile?: UserProfile
    state: CapItAllPageState
    onStateChange: (updater: (prev: CapItAllPageState) => CapItAllPageState) => void
    caches: CapItAllPageCaches
    onCachesChange: (updater: (prev: CapItAllPageCaches) => CapItAllPageCaches) => void
}

export function CapItAllPage({ userProfile, state, onStateChange, caches, onCachesChange }: CapItAllPageProps) {
    const accessToken = userProfile?.accessToken
    const selfId = userProfile?.id ?? undefined

    const autoPageSize = useAutoPageSize(computePageSize)
    const pageSize = state.pageSizePreference === 'auto' ? autoPageSize : state.pageSizePreference

    const [pageLoading, setPageLoading] = useState(caches.items.length === 0)
    const [error, setError] = useState<string | null>(null)
    const refreshCooldown = useRefreshCooldown()
    const scrollContainerRef = useRef<HTMLDivElement | null>(null)

    const [debouncedSearch, setDebouncedSearch] = useState(state.search.trim())
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(state.search.trim()), SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(t)
    }, [state.search])

    const serverParams = useMemo(() => ({
        search: debouncedSearch || undefined,
    }), [debouncedSearch])

    type PageEntry = CapItAllLeaderboardPage | Promise<CapItAllLeaderboardPage | null>
    const pageCacheRef = useRef<Record<string, PageEntry>>({})

    const keyFor = useCallback((p: number) =>
        JSON.stringify({ f: serverParams, s: pageSize, p }),
        [serverParams, pageSize])
    const querySig = useMemo(() => JSON.stringify({ f: serverParams, s: pageSize }), [serverParams, pageSize])
    const cacheFresh = caches.querySig === querySig

    useEffect(() => {
        pageCacheRef.current = {}
    }, [serverParams, pageSize])

    const fetchPageData = useCallback((p: number): Promise<CapItAllLeaderboardPage | null> => {
        if (!accessToken) return Promise.resolve(null)
        const key = keyFor(p)
        const existing = pageCacheRef.current[key]
        if (existing !== undefined) {
            return existing instanceof Promise ? existing : Promise.resolve(existing)
        }
        const offset = (p - 1) * pageSize
        const promise = fetchCapItAllLeaderboard(accessToken, { ...serverParams, limit: pageSize, offset })
            .then(res => { pageCacheRef.current[key] = res; return res })
            .catch(() => { delete pageCacheRef.current[key]; return null })
        pageCacheRef.current[key] = promise
        return promise
    }, [accessToken, serverParams, pageSize, keyFor])

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

        const cachedEntry = pageCacheRef.current[keyFor(state.currentPage)]
        const cached = cachedEntry && !(cachedEntry instanceof Promise) ? cachedEntry : undefined

        if (cached) {
            onCachesChange(prev => ({ ...prev, items: cached.items, total: cached.total, mapCount: cached.mapCount, querySig }))
            setPageLoading(false)
            setError(null)
            prefetchNeighbours(Math.max(1, Math.ceil(cached.total / pageSize)))
            return
        }

        setPageLoading(true)
        try {
            const res = await fetchPageData(state.currentPage)
            if (res) {
                onCachesChange(prev => ({
                    ...prev,
                    items: res.items,
                    total: res.total,
                    mapCount: res.mapCount,
                    lastRefreshIso: new Date().toISOString(),
                    querySig,
                }))
                setError(null)
                prefetchNeighbours(Math.max(1, Math.ceil(res.total / pageSize)))
            } else {
                setError('Failed to load leaderboard.')
            }
        } finally {
            setPageLoading(false)
        }
    }, [accessToken, state.currentPage, pageSize, keyFor, querySig, fetchPageData, onCachesChange])

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

    const refresh = () => {
        refreshCooldown.trigger(() => {
            pageCacheRef.current = {}
            void loadPage()
        })
    }

    useRegisterPageRefresh({
        onRefresh: refresh,
        refreshing: pageLoading,
        disabled: !refreshCooldown.canRefresh,
        tooltip: refreshCooldown.canRefresh ? 'Refresh Data' : `Wait ${refreshCooldown.remainingSeconds}s`,
    })

    const setSearch = (value: string) =>
        onStateChange(prev => ({ ...prev, search: value, currentPage: 1 }))

    const totalCount = caches.total
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const page = Math.min(state.currentPage, totalPages)

    useEffect(() => {
        if (cacheFresh && totalCount > 0 && state.currentPage > totalPages) {
            onStateChange(prev => ({ ...prev, currentPage: totalPages }))
        }
    }, [cacheFresh, totalCount, totalPages, state.currentPage, onStateChange])

    const items = caches.items
    const showSkeleton = !error && (!cacheFresh || (pageLoading && items.length === 0))

    const [resolved, setResolved] = useState<Set<CapItAllColumnId> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => {
        setResolved(ids as Set<CapItAllColumnId>)
    }, [])
    const isVisible = useCallback(
        (id: CapItAllColumnId) => !resolved || resolved.has(id),
        [resolved],
    )
    const visibleColumnCount = resolved ? resolved.size : CAP_IT_ALL_COLUMNS.length

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden">
            <div className="flex items-end justify-between shrink-0">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-2xl font-bold text-foreground leading-tight">Cap It All</h1>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                        UTBT cap leaderboard.
                        <br />
                        {caches.mapCount > 0 && (
                            <span className="opacity-50"> {caches.mapCount.toLocaleString()} active maps</span>
                        )}
                    </p>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="relative flex-1 min-w-48 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search for a player..."
                        value={state.search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full pl-9 pr-9 py-2 bg-card/50 border border-hairline/10 rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent-500/50 focus:bg-card/80 transition-colors"
                    />
                    {state.search && (
                        <button
                            type="button"
                            onClick={() => setSearch('')}
                            aria-label="Clear search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-hairline/10 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm shrink-0">
                    {error}
                </div>
            )}

            <DataTableShell
                scrollRef={scrollContainerRef}
                onScroll={onScrollContainerScroll}
                responsive={{ columns: CAP_IT_ALL_COLUMNS, onResolve: handleResolve }}
            >
                <DataTableHeaderRow theadDataAttr="data-utbt-capitall-thead">
                    {isVisible('rank') && <DataTableHeaderCell align="right" width="72px">#</DataTableHeaderCell>}
                    {isVisible('player') && <DataTableHeaderCell align="left">Player</DataTableHeaderCell>}
                    {isVisible('certified') && <DataTableHeaderCell align="left" width="220px">Certified</DataTableHeaderCell>}
                    {isVisible('noncertified') && <DataTableHeaderCell align="left" width="220px">Non-certified</DataTableHeaderCell>}
                    {isVisible('teammaps') && <DataTableHeaderCell align="left" width="220px">Team Maps</DataTableHeaderCell>}
                    {isVisible('total') && <DataTableHeaderCell align="left" width="220px">Total %</DataTableHeaderCell>}
                </DataTableHeaderRow>
                <tbody>
                    {showSkeleton ? (
                        Array.from({ length: Math.min(pageSize, AUTO_PAGE_SIZE_MAX_ROWS) }).map((_, i) => (
                            <DataTableSkeletonRow key={i} columnCount={visibleColumnCount} />
                        ))
                    ) : items.length === 0 ? (
                        <DataTableEmpty
                            colSpan={visibleColumnCount}
                            message={debouncedSearch ? 'No players match your search.' : 'No players on this leaderboard yet.'}
                        />
                    ) : (
                        items.map(row => {
                            const isSelf = selfId != null && row.user_id === String(selfId)
                            return (
                                <DataTableRow key={row.user_id}>
                                    {isVisible('rank') && (
                                        <DataTableCell align="right">
                                            <span className={cn(
                                                'font-mono tabular-nums',
                                                row.rank <= 3 ? 'text-foreground font-bold' : 'text-muted-foreground',
                                            )}>
                                                #{row.rank.toLocaleString()}
                                            </span>
                                        </DataTableCell>
                                    )}
                                    {isVisible('player') && (
                                        <DataTableCell>
                                            <PlayerInfo
                                                userId={row.user_id}
                                                alias={row.alias}
                                                title={row.active_title}
                                                size="md"
                                                highlight={isSelf}
                                                showYouBadge={isSelf}
                                            />
                                        </DataTableCell>
                                    )}
                                    {isVisible('certified') && (
                                        <DataTableCell width="220px">
                                            <MetricCell caps={row.certified_caps} pct={row.certified_percentage} barClass="bg-emerald-500/70" />
                                        </DataTableCell>
                                    )}
                                    {isVisible('noncertified') && (
                                        <DataTableCell width="220px">
                                            <MetricCell caps={row.non_certified_caps} pct={row.non_certified_percentage} barClass="bg-amber-400/60" />
                                        </DataTableCell>
                                    )}
                                    {isVisible('teammaps') && (
                                        <DataTableCell width="220px">
                                            <MetricCell caps={row.team_caps} pct={row.team_percentage} barClass="bg-sky-400/60" />
                                        </DataTableCell>
                                    )}
                                    {isVisible('total') && (
                                        <DataTableCell width="220px">
                                            <MetricCell caps={row.total_caps} pct={row.total_percentage} barClass="bg-violet-400/60" />
                                        </DataTableCell>
                                    )}
                                </DataTableRow>
                            )
                        })
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
        </div>
    )
}

function MetricCell({ caps, pct, barClass }: { caps: number; pct: number; barClass: string }) {
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full bg-hairline/10 overflow-hidden">
                <div className={cn('h-full rounded-full', barClass)} style={{ width: `${Math.min(100, pct)}%` }} />
            </div>
            <span className="font-mono tabular-nums text-foreground w-12 text-right">{caps.toLocaleString()}</span>
            <span className="font-mono tabular-nums text-[11px] text-muted-foreground w-14 text-right">{pct.toFixed(2)}%</span>
        </div>
    )
}
