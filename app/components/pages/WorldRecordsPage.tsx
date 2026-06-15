import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
    Search, RefreshCw, X, Play, Download, Star,
    Trophy, Crown, ListOrdered, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/app/components/ui/tooltip'
import { Modal } from '@/app/components/ui/modal'
import { useAutoPageSize } from '@/app/hooks/useAutoPageSize'
import { useRefreshCooldown } from '@/app/hooks/useRefreshCooldown'
import { useReplayWatch } from '@/app/hooks/useReplayWatch'
import { useDemoDownload } from '@/app/hooks/useDemoDownload'
import {
    type UserProfile,
    type Record as WorldRecord,
    type ActiveTitle,
    type LeaderboardEntry,
    type WorldRecordProgressionEntry,
    fetchAllWorldRecords,
    fetchWorldRecordProgression,
} from '@/app/utils/api'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import { IconActionButton } from '@/app/components/shared/IconActionButton'
import { ReplayVideoModal } from '@/app/components/shared/ReplayVideoModal'
import { DemoDownloadStatusModal } from '@/app/components/shared/DemoDownloadStatusModal'
import {
    WorldRecordProgressionModal, WorldRecordHistoryTrigger,
} from '@/app/components/modals/WorldRecordProgressionModal'
import { PaginationBar } from '@/app/components/ui/pagination'
import { ColumnsMenu } from '@/app/components/shared/ColumnsMenu'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow,
    DataTableCell, DataTableEmpty, DataTableSkeletonRow, type SortDirection,
} from '@/app/components/shared/DataTable'
import { formatCapTime, formatAddedDate, displayMapName } from '@/app/utils/format'
import { difficultyTextColor } from '@/app/utils/scoreColors'

export type WorldRecordsMode = 'records' | 'rushers'
export type WorldRecordsSortField = 'map' | 'holder' | 'time' | 'difficulty' | 'date'
export type WorldRecordsSortDir = 'asc' | 'desc'
export type WrDifficultyTier = 'all' | 'beginner' | 'intermediate' | 'advanced' | 'expert'
export type WrTimeframe = 'all' | '7d' | '30d' | '90d' | '1y'
export type WorldRecordsColumnId = 'map' | 'holder' | 'time' | 'difficulty' | 'date' | 'actions'

export interface WorldRecordsPageState {
    mode: WorldRecordsMode
    search: string
    difficulty: WrDifficultyTier
    timeframe: WrTimeframe
    favoritesOnly: boolean
    sortBy: WorldRecordsSortField
    sortDir: WorldRecordsSortDir
    columnVisibility: Record<WorldRecordsColumnId, boolean>
    columnOrder: WorldRecordsColumnId[]
    currentPage: number
    pageSizePreference: number | 'auto'
    scrollTop: number
}

export interface WorldRecordsPageCaches {
    records: WorldRecord[]
    lastRefreshIso: string | null
}

export const WORLD_RECORDS_COLUMN_LABELS: Record<WorldRecordsColumnId, string> = {
    map: 'Map',
    holder: 'Record Holder',
    time: 'Time',
    difficulty: 'Difficulty',
    date: 'Date Set',
    actions: 'Actions',
}

const DEFAULT_COLUMN_ORDER: WorldRecordsColumnId[] = ['map', 'holder', 'time', 'difficulty', 'date', 'actions']

const REQUIRED_COLUMNS: ReadonlySet<WorldRecordsColumnId> = new Set(['map', 'holder', 'time'])

const DEFAULT_COLUMN_VISIBILITY: Record<WorldRecordsColumnId, boolean> = {
    map: true,
    holder: true,
    time: true,
    difficulty: true,
    date: true,
    actions: true,
}

export const DEFAULT_WORLD_RECORDS_STATE: WorldRecordsPageState = {
    mode: 'records',
    search: '',
    difficulty: 'all',
    timeframe: 'all',
    favoritesOnly: false,
    sortBy: 'date',
    sortDir: 'desc',
    columnVisibility: DEFAULT_COLUMN_VISIBILITY,
    columnOrder: DEFAULT_COLUMN_ORDER,
    currentPage: 1,
    pageSizePreference: 'auto',
    scrollTop: 0,
}

export const DEFAULT_WORLD_RECORDS_CACHES: WorldRecordsPageCaches = {
    records: [],
    lastRefreshIso: null,
}

const MODES: { value: WorldRecordsMode; label: string; icon: LucideIcon }[] = [
    { value: 'records', label: 'Records', icon: ListOrdered },
    { value: 'rushers', label: 'Top Rushers', icon: Trophy },
]

const DIFFICULTY_RANGES: Record<Exclude<WrDifficultyTier, 'all'>, [number, number]> = {
    beginner: [1, 3],
    intermediate: [4, 6],
    advanced: [7, 8],
    expert: [9, 10],
}

const DIFFICULTY_OPTIONS: { value: WrDifficultyTier; label: string }[] = [
    { value: 'all', label: 'Any difficulty' },
    { value: 'beginner', label: 'Beginner (1–3)' },
    { value: 'intermediate', label: 'Intermediate (4–6)' },
    { value: 'advanced', label: 'Advanced (7–8)' },
    { value: 'expert', label: 'Expert (9–10)' },
]

const TIMEFRAME_DAYS: Record<Exclude<WrTimeframe, 'all'>, number> = {
    '7d': 7,
    '30d': 30,
    '90d': 90,
    '1y': 365,
}

const TIMEFRAME_OPTIONS: { value: WrTimeframe; label: string }[] = [
    { value: 'all', label: 'All time' },
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' },
    { value: '1y', label: 'Last year' },
]

const TABLE_ROW_HEIGHT_PX = 56
const TABLE_CHROME_PX = 300
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

function isInDifficultyTier(difficulty: number | undefined, tier: WrDifficultyTier): boolean {
    if (tier === 'all') return true
    if (difficulty == null) return false
    const [min, max] = DIFFICULTY_RANGES[tier]
    return difficulty >= min && difficulty <= max
}

function isInTimeframe(added: string, tier: WrTimeframe): boolean {
    if (tier === 'all') return true
    const t = new Date(added).getTime()
    if (isNaN(t)) return false
    const cutoff = Date.now() - TIMEFRAME_DAYS[tier] * 24 * 3600 * 1000
    return t >= cutoff
}

const SORTABLE_FIELDS: ReadonlySet<WorldRecordsColumnId> = new Set(['map', 'holder', 'time', 'difficulty', 'date'])

interface Rusher {
    user_id: string
    alias: string
    active_title: ActiveTitle | null
    count: number
    median: number
    average: number
    rank: number
}

function aggregateRushers(records: WorldRecord[]): Rusher[] {
    const acc = new Map<string, { user_id: string; alias: string; active_title: ActiveTitle | null; times: number[] }>()
    for (const r of records) {
        if (!r.user_id) continue
        let cur = acc.get(r.user_id)
        if (!cur) {
            cur = { user_id: r.user_id, alias: r.alias, active_title: r.active_title ?? null, times: [] }
            acc.set(r.user_id, cur)
        }
        cur.times.push(r.cap_time_seconds)
        if (r.active_title && !cur.active_title) cur.active_title = r.active_title
    }
    const arr: Rusher[] = [...acc.values()].map(c => {
        const sorted = [...c.times].sort((a, b) => a - b)
        const n = sorted.length
        const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2
        const average = c.times.reduce((s, t) => s + t, 0) / n
        return { user_id: c.user_id, alias: c.alias, active_title: c.active_title, count: n, median, average, rank: 0 }
    })
    arr.sort((a, b) => b.count - a.count || a.median - b.median || a.alias.localeCompare(b.alias))
    arr.forEach((r, i) => { r.rank = i + 1 })
    return arr
}

function medalText(rank: number): string {
    if (rank === 1) return 'text-yellow-300'
    if (rank === 2) return 'text-slate-200'
    if (rank === 3) return 'text-amber-400'
    return 'text-muted-foreground'
}

const PODIUM_SLOTS: {
    rank: number
    chip: string
    count: string
    bar: string
    ring: string
    surface: string
}[] = [
    { rank: 1, chip: 'bg-yellow-400/10 border-yellow-400/30 text-yellow-300', count: 'text-yellow-300', bar: 'bg-yellow-400/60', ring: 'ring-1 ring-yellow-400/25', surface: 'bg-card/60' },
    { rank: 2, chip: 'bg-slate-300/10 border-slate-300/25 text-slate-200', count: 'text-slate-100', bar: 'bg-slate-300/50', ring: '', surface: 'bg-card/40' },
    { rank: 3, chip: 'bg-amber-600/10 border-amber-600/30 text-amber-400', count: 'text-amber-600', bar: 'bg-amber-600/50', ring: '', surface: 'bg-card/40' },
]

interface WorldRecordsPageProps {
    userProfile?: UserProfile
    state: WorldRecordsPageState
    onStateChange: (updater: (prev: WorldRecordsPageState) => WorldRecordsPageState) => void
    caches: WorldRecordsPageCaches
    onCachesChange: (updater: (prev: WorldRecordsPageCaches) => WorldRecordsPageCaches) => void
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
    onMapSelect: (mapName: string) => void
}

export function WorldRecordsPage({
    userProfile, state, onStateChange, caches, onCachesChange,
    favoriteMapNames, onToggleFavorite, onMapSelect,
}: WorldRecordsPageProps) {
    const accessToken = userProfile?.accessToken
    const selfId = userProfile?.id ?? undefined
    const isRushers = state.mode === 'rushers'

    const autoPageSize = useAutoPageSize(computePageSize)
    const pageSize = state.pageSizePreference === 'auto' ? autoPageSize : state.pageSizePreference

    const [pageLoading, setPageLoading] = useState(caches.records.length === 0)
    const [error, setError] = useState<string | null>(null)
    const refreshCooldown = useRefreshCooldown()
    const scrollContainerRef = useRef<HTMLDivElement | null>(null)
    const loadInFlight = useRef(false)

    const replay = useReplayWatch()
    const demoDownload = useDemoDownload()

    const [wrHistory, setWrHistory] = useState<{ mapName: string; entries: WorldRecordProgressionEntry[] } | null>(null)

    const [debouncedSearch, setDebouncedSearch] = useState(state.search.trim().toLowerCase())
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(state.search.trim().toLowerCase()), SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(t)
    }, [state.search])

    const load = useCallback(async (force = false) => {
        if (!accessToken) return
        if (!force && caches.records.length > 0) {
            setPageLoading(false)
            return
        }
        if (loadInFlight.current) return
        loadInFlight.current = true
        setPageLoading(true)
        try {
            const records = await fetchAllWorldRecords(accessToken)
            onCachesChange(prev => ({ ...prev, records, lastRefreshIso: new Date().toISOString() }))
            setError(null)
        } catch {
            setError('Failed to load world records. Check your connection and try again.')
        } finally {
            setPageLoading(false)
            loadInFlight.current = false
        }
    }, [accessToken, caches.records.length, onCachesChange])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = state.scrollTop
        // Restore scroll once on mount; deps intentionally empty.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const onScrollContainerScroll = useCallback(() => {
        if (!scrollContainerRef.current) return
        const top = scrollContainerRef.current.scrollTop
        onStateChange(prev => Math.abs(prev.scrollTop - top) > 24 ? { ...prev, scrollTop: top } : prev)
    }, [onStateChange])

    const refresh = () => {
        refreshCooldown.trigger(() => { void load(true) })
    }

    const setMode = (mode: WorldRecordsMode) =>
        onStateChange(prev => prev.mode === mode ? prev : { ...prev, mode, currentPage: 1 })

    const setSearch = (value: string) =>
        onStateChange(prev => ({ ...prev, search: value, currentPage: 1 }))

    const updateFilter = <K extends keyof WorldRecordsPageState>(key: K, value: WorldRecordsPageState[K]) =>
        onStateChange(prev => ({ ...prev, [key]: value, currentPage: 1 }))

    const handleSort = (field: WorldRecordsSortField) => {
        onStateChange(prev => {
            if (prev.sortBy === field) {
                return { ...prev, sortDir: prev.sortDir === 'asc' ? 'desc' : 'asc', currentPage: 1 }
            }
            const defaultDir: WorldRecordsSortDir = field === 'map' || field === 'holder' ? 'asc' : 'desc'
            return { ...prev, sortBy: field, sortDir: defaultDir, currentPage: 1 }
        })
    }

    const toggleColumn = (id: WorldRecordsColumnId) => {
        if (REQUIRED_COLUMNS.has(id)) return
        onStateChange(prev => ({
            ...prev,
            columnVisibility: { ...prev.columnVisibility, [id]: !prev.columnVisibility[id] },
        }))
    }

    const reorderColumn = (sourceId: WorldRecordsColumnId, targetId: WorldRecordsColumnId) => {
        if (sourceId === targetId) return
        onStateChange(prev => {
            const order = [...prev.columnOrder]
            const fromIdx = order.indexOf(sourceId)
            const toIdx = order.indexOf(targetId)
            if (fromIdx === -1 || toIdx === -1) return prev
            const [moved] = order.splice(fromIdx, 1)
            const insertAt = order.indexOf(targetId)
            order.splice(insertAt + (fromIdx < toIdx ? 1 : 0), 0, moved)
            return { ...prev, columnOrder: order }
        })
    }

    const isColumnVisible = (id: WorldRecordsColumnId): boolean =>
        REQUIRED_COLUMNS.has(id) || state.columnVisibility[id]

    const visibleColumns = state.columnOrder.filter(isColumnVisible)
    const visibleColumnCount = visibleColumns.length

    const filtered = useMemo(() => {
        return caches.records.filter(r => {
            if (debouncedSearch) {
                const haystack = `${displayMapName(r.map)} ${r.map} ${r.alias ?? ''}`.toLowerCase()
                if (!haystack.includes(debouncedSearch)) return false
            }
            if (!isInDifficultyTier(r.difficulty, state.difficulty)) return false
            if (!isInTimeframe(r.added, state.timeframe)) return false
            if (state.favoritesOnly && !favoriteMapNames.has(r.map)) return false
            return true
        })
    }, [caches.records, debouncedSearch, state.difficulty, state.timeframe, state.favoritesOnly, favoriteMapNames])

    const sorted = useMemo(() => {
        const out = [...filtered]
        const dir = state.sortDir === 'asc' ? 1 : -1
        out.sort((a, b) => {
            let cmp = 0
            switch (state.sortBy) {
                case 'map':
                    cmp = displayMapName(a.map).localeCompare(displayMapName(b.map))
                    break
                case 'holder':
                    cmp = (a.alias ?? '').localeCompare(b.alias ?? '')
                    break
                case 'time':
                    cmp = a.cap_time_seconds - b.cap_time_seconds
                    break
                case 'difficulty': {
                    const aEmpty = a.difficulty == null
                    const bEmpty = b.difficulty == null
                    if (aEmpty && bEmpty) return 0
                    if (aEmpty) return 1
                    if (bEmpty) return -1
                    cmp = (a.difficulty as number) - (b.difficulty as number)
                    break
                }
                case 'date':
                    cmp = new Date(a.added).getTime() - new Date(b.added).getTime()
                    break
            }
            return cmp * dir
        })
        return out
    }, [filtered, state.sortBy, state.sortDir])

    const rushersAll = useMemo(() => aggregateRushers(caches.records), [caches.records])
    const maxRusherCount = rushersAll[0]?.count ?? 0
    const totalRecords = caches.records.length

    const rushersFiltered = useMemo(() => {
        if (!debouncedSearch) return rushersAll
        return rushersAll.filter(r => r.alias.toLowerCase().includes(debouncedSearch))
    }, [rushersAll, debouncedSearch])

    const totalCount = isRushers ? rushersFiltered.length : sorted.length
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const page = Math.min(state.currentPage, totalPages)
    const sliceStart = (page - 1) * pageSize
    const recordPageRows = sorted.slice(sliceStart, sliceStart + pageSize)
    const rusherPageRows = rushersFiltered.slice(sliceStart, sliceStart + pageSize)

    useEffect(() => {
        if (totalCount > 0 && state.currentPage > totalPages) {
            onStateChange(prev => ({ ...prev, currentPage: totalPages }))
        }
    }, [totalCount, totalPages, state.currentPage, onStateChange])

    const showSkeleton = pageLoading && caches.records.length === 0

    const recordsHaveFilter = !!debouncedSearch || state.difficulty !== 'all' || state.timeframe !== 'all' || state.favoritesOnly
    const activeHasFilter = isRushers ? !!debouncedSearch : recordsHaveFilter
    const showPodium = isRushers && !debouncedSearch && page === 1 && rushersAll.length >= 3

    const openHistory = useCallback(async (mapName: string) => {
        if (!accessToken) return
        setWrHistory({ mapName, entries: [] })
        const entries = await fetchWorldRecordProgression(accessToken, mapName)
        setWrHistory(cur => cur && cur.mapName === mapName ? { mapName, entries } : cur)
    }, [accessToken])

    const sortDir = (field: WorldRecordsSortField): SortDirection =>
        state.sortBy === field ? state.sortDir : null

    const renderHeaderCell = (id: WorldRecordsColumnId) => {
        const sortProps = SORTABLE_FIELDS.has(id)
            ? {
                sortable: true,
                sortDirection: sortDir(id as WorldRecordsSortField),
                onSort: () => handleSort(id as WorldRecordsSortField),
            }
            : {}
        switch (id) {
            case 'map':
                return <DataTableHeaderCell key={id} align="left" {...sortProps}>Map</DataTableHeaderCell>
            case 'holder':
                return <DataTableHeaderCell key={id} align="left" {...sortProps}>Record Holder</DataTableHeaderCell>
            case 'time':
                return <DataTableHeaderCell key={id} align="right" width="8rem" {...sortProps}>Time</DataTableHeaderCell>
            case 'difficulty':
                return <DataTableHeaderCell key={id} align="center" width="7rem" {...sortProps}>Difficulty</DataTableHeaderCell>
            case 'date':
                return <DataTableHeaderCell key={id} align="right" width="8rem" {...sortProps}>Date Set</DataTableHeaderCell>
            case 'actions':
                return <DataTableHeaderCell key={id} align="center" width="8.5rem"><span className="sr-only">Actions</span></DataTableHeaderCell>
        }
    }

    const renderCell = (id: WorldRecordsColumnId, r: WorldRecord) => {
        const isSelf = selfId != null && r.user_id === String(selfId)
        switch (id) {
            case 'map':
                return (
                    <DataTableCell key={id}>
                        <div className="flex items-center gap-3 min-w-0">
                            <MapThumbnail mapName={r.map} className="w-12 h-12" />
                            <div className="flex items-center gap-2 min-w-0">
                                <FavoriteStar
                                    name={r.map}
                                    isFavorited={favoriteMapNames.has(r.map)}
                                    onToggle={onToggleFavorite}
                                    size="sm"
                                    className="shrink-0"
                                />
                                <button
                                    type="button"
                                    onClick={() => onMapSelect(r.map)}
                                    className="font-bold text-white/90 truncate hover:text-white hover:underline underline-offset-2 cursor-pointer text-left"
                                >
                                    {displayMapName(r.map)}
                                </button>
                            </div>
                        </div>
                    </DataTableCell>
                )
            case 'holder':
                return (
                    <DataTableCell key={id}>
                        <PlayerInfo
                            userId={r.user_id}
                            alias={r.alias}
                            title={r.active_title}
                            size="sm"
                            highlight={isSelf}
                            showYouBadge={isSelf}
                        />
                    </DataTableCell>
                )
            case 'time':
                return (
                    <DataTableCell key={id} align="right">
                        <CapTimeLink
                            capId={r.cap_id}
                            seconds={r.cap_time_seconds}
                            className="font-mono font-black tabular-nums text-blue-300 tracking-tight"
                        />
                    </DataTableCell>
                )
            case 'difficulty':
                return (
                    <DataTableCell key={id} align="center">
                        {r.difficulty != null ? (
                            <span className={cn('font-mono tabular-nums text-sm font-bold', difficultyTextColor(r.difficulty))}>
                                {r.difficulty}
                            </span>
                        ) : (
                            <span className="text-muted-foreground/50">—</span>
                        )}
                    </DataTableCell>
                )
            case 'date':
                return (
                    <DataTableCell key={id} align="right">
                        <Tooltip content={new Date(r.added).toLocaleString()} side="top">
                            <span className="text-xs text-muted-foreground tabular-nums">
                                {formatAddedDate(r.added)}
                            </span>
                        </Tooltip>
                    </DataTableCell>
                )
            case 'actions':
                return (
                    <DataTableCell key={id} align="center" className="px-2">
                        <div className="flex items-center justify-center gap-1">
                            <IconActionButton
                                variant="replay"
                                icon={Play}
                                iconFill
                                tooltip="Watch run"
                                loading={replay.loadingCapId === r.cap_id}
                                onClick={() => replay.openReplay({
                                    capId: r.cap_id,
                                    mapName: r.map,
                                    time: r.cap_time_seconds,
                                    alias: r.alias ?? undefined,
                                })}
                            />
                            <IconActionButton
                                variant="download"
                                icon={Download}
                                tooltip="Download demo"
                                onClick={() => demoDownload.start(
                                    { id: r.cap_id, alias: r.alias, cap_time_seconds: r.cap_time_seconds } as unknown as LeaderboardEntry,
                                    r.map,
                                )}
                            />
                            <WorldRecordHistoryTrigger onClick={() => openHistory(r.map)} />
                        </div>
                    </DataTableCell>
                )
        }
    }

    const recordWord = totalCount === 1 ? 'record' : 'records'

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden">
            <div className="flex items-end justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white leading-tight">World Records</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {isRushers ? (
                            <>
                                Who are the fastest rushers in the world?
                                <br />
                                {!showSkeleton && (
                                    <span className="opacity-50"> {rushersAll.length.toLocaleString()} rushers · {totalRecords.toLocaleString()} records</span>
                                )}
                            </>
                        ) : (
                            <>
                                The fastest verified cap on every map.
                                <br />
                                {!showSkeleton && (
                                    <span className="opacity-50"> {totalCount.toLocaleString()} {recordWord}</span>
                                )}
                            </>
                        )}
                        {activeHasFilter && <span className="opacity-50"> (filtered)</span>}
                    </p>
                </div>
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

            <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-card/50 border border-white/10">
                    {MODES.map(m => {
                        const Icon = m.icon
                        const active = state.mode === m.value
                        return (
                            <button
                                key={m.value}
                                type="button"
                                onClick={() => setMode(m.value)}
                                className={cn(
                                    'inline-flex items-center gap-2 h-8 px-3 rounded-md text-sm font-medium transition-colors cursor-pointer border',
                                    active
                                        ? 'bg-blue-500/20 text-blue-200 border-blue-500/40'
                                        : 'text-muted-foreground hover:text-white border-transparent',
                                )}
                            >
                                <Icon className="size-4" />
                                {m.label}
                            </button>
                        )
                    })}
                </div>

                <div className="relative flex-1 min-w-48 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder={isRushers ? 'Search rushers...' : 'Search maps or players...'}
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

                {!isRushers && (
                    <>
                        <select
                            value={state.difficulty}
                            onChange={e => updateFilter('difficulty', e.target.value as WrDifficultyTier)}
                            style={{ colorScheme: 'dark' }}
                            className="px-3 py-2 bg-card/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
                            aria-label="Filter by difficulty"
                        >
                            {DIFFICULTY_OPTIONS.map(o => (
                                <option key={o.value} value={o.value} className="bg-[#0f1115] text-white">{o.label}</option>
                            ))}
                        </select>

                        <select
                            value={state.timeframe}
                            onChange={e => updateFilter('timeframe', e.target.value as WrTimeframe)}
                            style={{ colorScheme: 'dark' }}
                            className="px-3 py-2 bg-card/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
                            aria-label="Filter by timeframe"
                        >
                            {TIMEFRAME_OPTIONS.map(o => (
                                <option key={o.value} value={o.value} className="bg-[#0f1115] text-white">{o.label}</option>
                            ))}
                        </select>

                        <button
                            type="button"
                            onClick={() => updateFilter('favoritesOnly', !state.favoritesOnly)}
                            className={cn(
                                'px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer flex items-center gap-2',
                                state.favoritesOnly
                                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                    : 'bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20',
                            )}
                        >
                            <Star className={cn('size-4', state.favoritesOnly && 'fill-current')} />
                            Favorites
                        </button>

                        <ColumnsMenu<WorldRecordsColumnId>
                            columnOrder={state.columnOrder}
                            columnVisibility={state.columnVisibility}
                            columnLabels={WORLD_RECORDS_COLUMN_LABELS}
                            onToggle={toggleColumn}
                            onReorder={reorderColumn}
                            requiredColumns={REQUIRED_COLUMNS}
                        />
                    </>
                )}
            </div>

            {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm shrink-0">
                    {error}
                </div>
            )}

            {isRushers && showPodium && (
                <div className="grid grid-cols-3 gap-3 shrink-0">
                    {PODIUM_SLOTS.map(slot => {
                        const r = rushersAll[slot.rank - 1]
                        if (!r) return <div key={slot.rank} />
                        const isSelf = selfId != null && r.user_id === String(selfId)
                        return (
                            <div
                                key={slot.rank}
                                className={cn(
                                    'relative flex items-center gap-3 rounded-xl border border-white/5 px-4 py-3 overflow-hidden',
                                    slot.surface, slot.ring,
                                )}
                            >
                                <div className={cn('absolute left-0 inset-y-0 w-0.5', slot.bar)} />
                                <div className={cn(
                                    'flex items-center justify-center size-8 rounded-lg border shrink-0 font-mono font-black text-sm tabular-nums',
                                    slot.chip,
                                )}>
                                    {slot.rank}
                                </div>
                                {slot.rank === 1 && <Crown className="size-4 shrink-0 -ml-1 text-yellow-300" />}
                                <PlayerInfo
                                    userId={r.user_id}
                                    alias={r.alias}
                                    title={r.active_title}
                                    size="md"
                                    highlight={isSelf}
                                    showYouBadge={isSelf}
                                    className="min-w-0"
                                />
                                <div className="ml-auto flex items-baseline gap-1 shrink-0">
                                    <span className={cn('font-mono font-black tabular-nums leading-none text-xl', slot.count)}>
                                        {r.count}
                                    </span>
                                    <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-bold">WRs</span>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {isRushers ? (
                <DataTableShell scrollRef={scrollContainerRef} onScroll={onScrollContainerScroll}>
                    <DataTableHeaderRow theadDataAttr="data-utbt-rushers-thead">
                        <DataTableHeaderCell align="right" width="5rem">#</DataTableHeaderCell>
                        <DataTableHeaderCell align="left">Rusher</DataTableHeaderCell>
                        <DataTableHeaderCell align="left">World Records</DataTableHeaderCell>
                        <DataTableHeaderCell align="right" width="6rem">Share</DataTableHeaderCell>
                        <DataTableHeaderCell align="right" width="8rem">Median WR</DataTableHeaderCell>
                        <DataTableHeaderCell align="right" width="8rem">Average WR</DataTableHeaderCell>
                    </DataTableHeaderRow>
                    <tbody>
                        {showSkeleton ? (
                            Array.from({ length: Math.min(pageSize, AUTO_PAGE_SIZE_MAX_ROWS) }).map((_, i) => (
                                <DataTableSkeletonRow key={i} columnCount={6} />
                            ))
                        ) : rusherPageRows.length === 0 ? (
                            <DataTableEmpty
                                colSpan={6}
                                message={debouncedSearch ? 'No rushers match your search.' : 'No rushers found.'}
                            />
                        ) : (
                            rusherPageRows.map(r => {
                                const isSelf = selfId != null && r.user_id === String(selfId)
                                const share = totalRecords > 0 ? (r.count / totalRecords) * 100 : 0
                                const barPct = maxRusherCount > 0 ? Math.max(4, (r.count / maxRusherCount) * 100) : 0
                                return (
                                    <DataTableRow key={r.user_id}>
                                        <DataTableCell align="right">
                                            <span className={cn('font-mono font-bold tabular-nums', medalText(r.rank))}>
                                                #{r.rank}
                                            </span>
                                        </DataTableCell>
                                        <DataTableCell>
                                            <PlayerInfo
                                                userId={r.user_id}
                                                alias={r.alias}
                                                title={r.active_title}
                                                size="md"
                                                highlight={isSelf}
                                                showYouBadge={isSelf}
                                            />
                                        </DataTableCell>
                                        <DataTableCell>
                                            <div className="flex items-center gap-2.5">
                                                <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden min-w-16">
                                                    <div className="h-full rounded-full bg-blue-500/70" style={{ width: `${barPct}%` }} />
                                                </div>
                                                <span className="font-mono tabular-nums text-white font-bold w-10 text-right">
                                                    {r.count}
                                                </span>
                                            </div>
                                        </DataTableCell>
                                        <DataTableCell align="right">
                                            <span className="font-mono tabular-nums text-xs text-muted-foreground">
                                                {share.toFixed(1)}%
                                            </span>
                                        </DataTableCell>
                                        <DataTableCell align="right">
                                            <span className="font-mono tabular-nums text-xs text-white/80">
                                                {formatCapTime(r.median)}
                                            </span>
                                        </DataTableCell>
                                        <DataTableCell align="right">
                                            <span className="font-mono tabular-nums text-xs text-muted-foreground">
                                                {formatCapTime(r.average)}
                                            </span>
                                        </DataTableCell>
                                    </DataTableRow>
                                )
                            })
                        )}
                    </tbody>
                </DataTableShell>
            ) : (
                <DataTableShell scrollRef={scrollContainerRef} onScroll={onScrollContainerScroll}>
                    <DataTableHeaderRow theadDataAttr="data-utbt-worldrecords-thead">
                        {visibleColumns.map(id => renderHeaderCell(id))}
                    </DataTableHeaderRow>
                    <tbody>
                        {showSkeleton ? (
                            Array.from({ length: Math.min(pageSize, AUTO_PAGE_SIZE_MAX_ROWS) }).map((_, i) => (
                                <DataTableSkeletonRow key={i} columnCount={visibleColumnCount} />
                            ))
                        ) : recordPageRows.length === 0 ? (
                            <DataTableEmpty
                                colSpan={visibleColumnCount}
                                message={recordsHaveFilter ? 'No world records match your filters.' : 'No world records found.'}
                            />
                        ) : (
                            recordPageRows.map(r => (
                                <DataTableRow key={r.cap_id}>
                                    {visibleColumns.map(id => renderCell(id, r))}
                                </DataTableRow>
                            ))
                        )}
                    </tbody>
                </DataTableShell>
            )}

            {!showSkeleton && totalCount > 0 && (
                <PaginationBar
                    page={page}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalForCount={totalCount}
                    meta={activeHasFilter ? (isRushers ? 'search' : 'filtered') : undefined}
                    pageSizePreference={state.pageSizePreference}
                    autoPageSize={autoPageSize}
                    onPageChange={p => onStateChange(prev => ({ ...prev, currentPage: p }))}
                    onPageSizeChange={pref => onStateChange(prev => ({ ...prev, pageSizePreference: pref, currentPage: 1 }))}
                />
            )}

            <WorldRecordProgressionModal
                isOpen={wrHistory !== null}
                onClose={() => setWrHistory(null)}
                mapName={wrHistory?.mapName ?? ''}
                entries={wrHistory?.entries ?? []}
                currentUserId={selfId}
            />

            <ReplayVideoModal state={replay.video} onClose={replay.clearVideo} />

            <Modal
                isOpen={replay.error !== null}
                onClose={replay.clearError}
                title="Replay not available"
                className="w-[95%] sm:w-[440px] max-w-md"
                offsetSidebar
            >
                <p className="text-sm text-muted-foreground">{replay.error}</p>
            </Modal>

            <DemoDownloadStatusModal
                state={demoDownload.download}
                onClose={demoDownload.clear}
            />
        </div>
    )
}
