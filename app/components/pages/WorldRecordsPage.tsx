import { lazy, Suspense, useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
    Search, X, Play, Download, SlidersHorizontal,
    Trophy, Crown, ListOrdered, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from '@/app/components/ui/tooltip'
import { Modal } from '@/app/components/ui/modal'
import { useAutoPageSize } from '@/app/hooks/useAutoPageSize'
import { useRefreshCooldown } from '@/app/hooks/useRefreshCooldown'
import { useRegisterPageRefresh } from '@/app/components/navigation/PageRefreshContext'
import { useReplayWatch } from '@/app/hooks/useReplayWatch'
import { useDemoDownload } from '@/app/hooks/useDemoDownload'
import { useNewItemHighlight } from '@/app/hooks/useNewItemHighlight'
import {
    type UserProfile,
    type Record as WorldRecord,
    type RusherRow,
    type LeaderboardEntry,
    type WorldRecordProgressionEntry,
    type WorldRecordFilterOptions,
    fetchWorldRecords,
    fetchWorldRecordsCount,
    fetchRushers,
    fetchWorldRecordProgression,
    fetchWorldRecordFilterOptions,
    asStringArray,
} from '@/app/utils/api'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { TeamHolders } from '@/app/components/shared/TeamHolders'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { MapNavLink } from '@/app/components/shared/MapNavLink'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import { recordFeedDemoCapId, teamRunCapId } from '@/app/components/shared/runDemo'
import { IconActionButton } from '@/app/components/shared/IconActionButton'
import { ReplayVideoModal } from '@/app/components/shared/ReplayVideoModal'
import { DemoDownloadStatusModal } from '@/app/components/shared/DemoDownloadStatusModal'
import { WorldRecordHistoryTrigger } from '@/app/components/shared/WorldRecordHistoryTrigger'
import { PaginationBar } from '@/app/components/ui/pagination'
import { ColumnsMenu } from '@/app/components/shared/ColumnsMenu'
import { MultiFilterDropdown } from '@/app/components/ui/multi-filter-dropdown'
import { FilterPanelRow } from '@/app/components/ui/filter-panel-row'
import { ActiveFilterChip } from '@/app/components/shared/ActiveFilterChip'
const WorldRecordProgressionModal = lazy(() => import('@/app/components/modals/WorldRecordProgressionModal').then(m => ({ default: m.WorldRecordProgressionModal })))
import { FilterPresetsMenu, type FilterPreset } from '@/app/components/shared/FilterPresetsMenu'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow,
    DataTableCell, DataTableEmpty, DataTableSkeletonRow, type SortDirection,
    type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { formatCapTime, formatAddedDate, displayMapName } from '@/app/utils/format'
import { difficultyTextColor } from '@/app/utils/scoreColors'
import {
    DIFFICULTY_TIER_OPTIONS, DIFFICULTY_TIER_LABEL, expandDifficultyTiers,
} from '@/app/utils/difficulty'
import { persistPresets, newPresetId, presetFiltersMatch, useSyncedPresets } from '@/app/utils/filterPresets'

import {
    DEFAULT_WORLD_RECORDS_STATE,
    type WorldRecordsColumnId,
    type WorldRecordsMode,
    type WorldRecordsPageCaches,
    type WorldRecordsPageState,
    type WorldRecordsPresetFilters,
    type WorldRecordsSortDir,
    type WorldRecordsSortField,
    type WrDifficultyTierValue,
    type WrTimeBucket,
    type WrTimeframe,
} from './WorldRecordsPage.types'

export type {
    WorldRecordsColumnId,
    WorldRecordsMode,
    WorldRecordsPresetFilters,
    WorldRecordsSortDir,
    WorldRecordsSortField,
    WrDifficultyTierValue,
    WrTimeBucket,
    WrTimeframe,
} from './WorldRecordsPage.types'

type WorldRecordsPreset = FilterPreset<WorldRecordsPresetFilters>

export const WORLD_RECORDS_COLUMN_LABELS: Record<WorldRecordsColumnId, string> = {
    map: 'Map',
    holder: 'Record Holder',
    time: 'Time',
    difficulty: 'Difficulty',
    date: 'Date Set',
    actions: 'Actions',
}

const REQUIRED_COLUMNS: ReadonlySet<WorldRecordsColumnId> = new Set(['map', 'holder', 'time'])

const COLUMN_WIDTH: Partial<Record<WorldRecordsColumnId, string>> = {
    time: '8rem',
    difficulty: '7rem',
    date: '8rem',
    actions: '8.5rem',
}

const COLUMN_PRIORITY: Partial<Record<WorldRecordsColumnId, number>> = {
    difficulty: 50,
    actions: 40,
    date: 30,
}

type RusherColumnId = 'rank' | 'rusher' | 'records' | 'share' | 'median' | 'average'

const RUSHER_COLUMNS: ResponsiveColumn[] = [
    { id: 'rank', width: '5rem', required: true },
    { id: 'rusher', required: true },
    { id: 'records', width: '20rem', required: true },
    { id: 'share', width: '6rem', priority: 30 },
    { id: 'median', width: '8rem', priority: 35 },
    { id: 'average', width: '8rem', priority: 34 },
]

const RUSHER_COLUMN_IDS: RusherColumnId[] = RUSHER_COLUMNS.map(c => c.id as RusherColumnId)

const MODES: { value: WorldRecordsMode; label: string; icon: LucideIcon }[] = [
    { value: 'records', label: 'Records', icon: ListOrdered },
    { value: 'rushers', label: 'Top Rushers', icon: Trophy },
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

const TIME_BUCKETS: { value: WrTimeBucket; label: string; min?: number; max?: number }[] = [
    { value: 'u30', label: 'Under 30s', max: 30 },
    { value: '30-60', label: '30s – 1m', min: 30, max: 60 },
    { value: '60-120', label: '1m – 2m', min: 60, max: 120 },
    { value: '120-300', label: '2m – 5m', min: 120, max: 300 },
    { value: 'o300', label: 'Over 5m', min: 300 },
]

const TIME_BUCKET_OPTIONS: [WrTimeBucket, string][] = TIME_BUCKETS.map(b => [b.value, b.label])
const TIME_BUCKET_BY_VALUE: Record<WrTimeBucket, { min?: number; max?: number }> =
    Object.fromEntries(TIME_BUCKETS.map(b => [b.value, { min: b.min, max: b.max }])) as Record<WrTimeBucket, { min?: number; max?: number }>

function timeBucketRange(v: WrTimeBucket): string {
    const bucket = TIME_BUCKET_BY_VALUE[v]
    if (!bucket) return ''
    return `${bucket.min ?? ''}-${bucket.max ?? ''}`
}

const KNOWN_WR_DIFFICULTY_VALUES = new Set<string>(DIFFICULTY_TIER_OPTIONS.map(([v]) => v))
const KNOWN_TIME_BUCKET_VALUES = new Set<string>(TIME_BUCKETS.map(b => b.value))
const KNOWN_TIMEFRAME_VALUES = new Set<string>(TIMEFRAME_OPTIONS.map(o => o.value))
const KNOWN_WR_SORT_FIELDS = new Set<string>(['map', 'holder', 'time', 'difficulty', 'date'])

const sanitizePresetFilters = (raw: Partial<Record<keyof WorldRecordsPresetFilters, unknown>>): WorldRecordsPresetFilters => ({
    search: typeof raw.search === 'string' ? raw.search : '',
    difficultyFilters: asStringArray(raw.difficultyFilters).filter((v): v is WrDifficultyTierValue => KNOWN_WR_DIFFICULTY_VALUES.has(v)),
    holderFilters: asStringArray(raw.holderFilters),
    timeFilters: asStringArray(raw.timeFilters).filter((v): v is WrTimeBucket => KNOWN_TIME_BUCKET_VALUES.has(v)),
    yearFilters: asStringArray(raw.yearFilters),
    timeframe: typeof raw.timeframe === 'string' && KNOWN_TIMEFRAME_VALUES.has(raw.timeframe) ? raw.timeframe as WrTimeframe : 'all',
    favoritesOnly: Boolean(raw.favoritesOnly),
    sortBy: typeof raw.sortBy === 'string' && KNOWN_WR_SORT_FIELDS.has(raw.sortBy) ? raw.sortBy as WorldRecordsSortField : DEFAULT_WORLD_RECORDS_STATE.sortBy,
    sortDir: raw.sortDir === 'asc' ? 'asc' : 'desc',
})

const pickPresetFilters = (raw: Partial<Record<keyof WorldRecordsPresetFilters, unknown>>): Partial<WorldRecordsPresetFilters> => {
    const sanitized = sanitizePresetFilters(raw)
    const picked: Partial<WorldRecordsPresetFilters> = {}
    for (const key of Object.keys(sanitized) as (keyof WorldRecordsPresetFilters)[]) {
        if (key in raw) (picked as Record<string, unknown>)[key] = sanitized[key]
    }
    return picked
}

const presetFiltersValid = (raw: unknown): boolean => {
    if (!raw || typeof raw !== 'object') return false
    const r = raw as Record<string, unknown>
    return asStringArray(r.difficultyFilters).every(v => KNOWN_WR_DIFFICULTY_VALUES.has(v))
        && asStringArray(r.timeFilters).every(v => KNOWN_TIME_BUCKET_VALUES.has(v))
}

const PRESETS_KEY = 'utbt:worldRecordsPresets:v1'

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

function isoDaysAgo(days: number): string {
    return new Date(Date.now() - days * 24 * 3600 * 1000).toISOString()
}

const SORTABLE_FIELDS: ReadonlySet<WorldRecordsColumnId> = new Set(['map', 'holder', 'time', 'difficulty', 'date'])

type WorldRecordsServerParams =
    | { mode: 'rushers'; search?: string }
    | {
        mode: 'records'
        search?: string
        sort: WorldRecordsSortDir
        sortBy: WorldRecordsSortField
        addedSince?: string
        maps?: string
        difficulties?: string
        users?: string
        years?: string
        timeRanges?: string
        favoritesEmpty: boolean
    }

interface Globals {
    total: number
    totalRecords: number
    maxRusherCount: number
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
    const accessToken = userProfile?.accessToken ?? ''
    const selfId = userProfile?.id ?? undefined
    const isRushers = state.mode === 'rushers'

    const autoPageSize = useAutoPageSize(computePageSize)
    const pageSize = state.pageSizePreference === 'auto' ? autoPageSize : state.pageSizePreference

    const currentRows = isRushers ? caches.rusherRows : caches.recordRows
    const [pageLoading, setPageLoading] = useState(currentRows.length === 0)
    const [error, setError] = useState<string | null>(null)
    const refreshCooldown = useRefreshCooldown()
    const scrollContainerRef = useRef<HTMLDivElement | null>(null)

    const replay = useReplayWatch()
    const demoDownload = useDemoDownload()
    const highlight = useNewItemHighlight('world-records', () =>
        onStateChange(prev => ({ ...prev, mode: 'records', sortBy: 'date', sortDir: 'desc', currentPage: 1 })),
    )

    const [wrHistory, setWrHistory] = useState<{ mapName: string; entries: WorldRecordProgressionEntry[] } | null>(null)

    const [debouncedSearch, setDebouncedSearch] = useState(state.search.trim())
    useEffect(() => {
        const t = setTimeout(() => setDebouncedSearch(state.search.trim()), SEARCH_DEBOUNCE_MS)
        return () => clearTimeout(t)
    }, [state.search])

    const [filterOptions, setFilterOptions] = useState<WorldRecordFilterOptions>({ holders: [], years: [] })
    useEffect(() => {
        let cancelled = false
        fetchWorldRecordFilterOptions(accessToken)
            .then(o => { if (!cancelled) setFilterOptions(o) })
            .catch(() => {})
        return () => { cancelled = true }
    }, [accessToken])

    const holderAliasById = useMemo(
        () => Object.fromEntries(filterOptions.holders.map(h => [h.user_id, h.alias])) as Record<string, string>,
        [filterOptions],
    )
    const holderOptions = useMemo<[string, string][]>(
        () => filterOptions.holders.map(h => [h.user_id, `${h.alias} (${h.count})`]),
        [filterOptions],
    )
    const yearOptions = useMemo<[string, string][]>(
        () => filterOptions.years.map(y => [String(y), String(y)]),
        [filterOptions],
    )

    const [presets, setPresets] = useSyncedPresets<WorldRecordsPresetFilters>(PRESETS_KEY, undefined, presetFiltersValid)
    const [activePresetId, setActivePresetId] = useState<string | null>(null)

    const serverParams = useMemo<WorldRecordsServerParams>(() => {
        const search = debouncedSearch || undefined
        if (isRushers) return { mode: 'rushers', search }
        const addedSince = state.timeframe === 'all' ? undefined : isoDaysAgo(TIMEFRAME_DAYS[state.timeframe])
        const favoritesEmpty = !!accessToken && state.favoritesOnly && favoriteMapNames.size === 0
        const maps = !!accessToken && state.favoritesOnly && favoriteMapNames.size > 0
            ? [...favoriteMapNames].sort().join(',')
            : undefined
        return {
            mode: 'records',
            search,
            sort: state.sortDir,
            sortBy: state.sortBy,
            addedSince,
            maps,
            difficulties: expandDifficultyTiers(state.difficultyFilters).join(',') || undefined,
            users: state.holderFilters.join(',') || undefined,
            years: state.yearFilters.join(',') || undefined,
            timeRanges: state.timeFilters.map(timeBucketRange).filter(Boolean).join(',') || undefined,
            favoritesEmpty,
        }
    }, [isRushers, debouncedSearch, state.sortBy, state.sortDir, state.timeframe, state.difficultyFilters, state.holderFilters, state.timeFilters, state.yearFilters, state.favoritesOnly, favoriteMapNames])

    type PageEntry = WorldRecord[] | RusherRow[] | Promise<WorldRecord[] | RusherRow[] | null>
    type GlobalsEntry = Globals | Promise<Globals | null>
    const pageCacheRef = useRef<Record<string, PageEntry>>({})
    const globalsCacheRef = useRef<Record<string, GlobalsEntry>>({})

    const keyFor = useCallback((p: number) =>
        JSON.stringify({ s: serverParams, ps: pageSize, p }),
        [serverParams, pageSize])
    const querySig = useMemo(() => JSON.stringify({ s: serverParams, ps: pageSize }), [serverParams, pageSize])
    const globalsKey = useMemo(() => {
        if (serverParams.mode === 'rushers') return JSON.stringify({ mode: 'rushers', search: serverParams.search })
        const { sort: _sort, sortBy: _sortBy, ...rest } = serverParams
        return JSON.stringify(rest)
    }, [serverParams])
    const cacheFresh = caches.querySig === querySig

    useEffect(() => { pageCacheRef.current = {} }, [querySig])
    useEffect(() => { globalsCacheRef.current = {} }, [globalsKey])

    const fetchPageData = useCallback((p: number): Promise<WorldRecord[] | RusherRow[] | null> => {
        if (serverParams.mode === 'records' && serverParams.favoritesEmpty) {
            globalsCacheRef.current[globalsKey] = { total: 0, totalRecords: 0, maxRusherCount: 0 }
            return Promise.resolve([])
        }
        const key = keyFor(p)
        const existing = pageCacheRef.current[key]
        if (existing !== undefined) return Array.isArray(existing) ? Promise.resolve(existing) : existing

        const offset = (p - 1) * pageSize
        let promise: Promise<WorldRecord[] | RusherRow[] | null>
        if (serverParams.mode === 'rushers') {
            promise = fetchRushers(accessToken, { limit: pageSize, offset, search: serverParams.search })
                .then(env => {
                    globalsCacheRef.current[globalsKey] = {
                        total: env.total,
                        totalRecords: env.total_records,
                        maxRusherCount: env.max_count,
                    }
                    pageCacheRef.current[key] = env.items
                    return env.items
                })
                .catch(() => { delete pageCacheRef.current[key]; return null })
        } else {
            const { search, sort, sortBy, addedSince, maps, difficulties, users, years, timeRanges } = serverParams
            promise = fetchWorldRecords(accessToken, { search, sort, sortBy, addedSince, maps, difficulties, users, years, timeRanges, limit: pageSize, offset })
                .then(rows => { pageCacheRef.current[key] = rows; return rows })
                .catch(() => { delete pageCacheRef.current[key]; return null })
        }
        pageCacheRef.current[key] = promise
        return promise
    }, [accessToken, serverParams, pageSize, keyFor, globalsKey])

    const fetchGlobalsData = useCallback((): Promise<Globals | null> => {
        const existing = globalsCacheRef.current[globalsKey]
        if (existing !== undefined) return 'total' in existing ? Promise.resolve(existing) : existing
        if (serverParams.mode === 'records' && serverParams.favoritesEmpty) {
            const empty: Globals = { total: 0, totalRecords: 0, maxRusherCount: 0 }
            globalsCacheRef.current[globalsKey] = empty
            return Promise.resolve(empty)
        }
        if (serverParams.mode === 'rushers') return Promise.resolve(null)
        const { search, addedSince, maps, difficulties, users, years, timeRanges } = serverParams
        const promise = fetchWorldRecordsCount(accessToken, { search, addedSince, maps, difficulties, users, years, timeRanges })
            .then(count => {
                const g: Globals = { total: count, totalRecords: 0, maxRusherCount: 0 }
                globalsCacheRef.current[globalsKey] = g
                return g
            })
            .catch(() => { delete globalsCacheRef.current[globalsKey]; return null })
        globalsCacheRef.current[globalsKey] = promise
        return promise
    }, [accessToken, serverParams, globalsKey])

    const applyResult = useCallback((rows: WorldRecord[] | RusherRow[], g: Globals) => {
        onCachesChange(prev => isRushers
            ? { ...prev, rusherRows: rows as RusherRow[], rusherTotal: g.total, totalRecords: g.totalRecords, maxRusherCount: g.maxRusherCount, querySig, lastRefreshIso: new Date().toISOString() }
            : { ...prev, recordRows: rows as WorldRecord[], recordTotal: g.total, querySig, lastRefreshIso: new Date().toISOString() })
    }, [isRushers, onCachesChange, querySig])

    const loadPage = useCallback(async (isCancelled: () => boolean = () => false) => {

        const prefetchNeighbours = (totalPages: number) => {
            if (state.currentPage > 1 && !(keyFor(state.currentPage - 1) in pageCacheRef.current)) {
                fetchPageData(state.currentPage - 1)
            }
            if (state.currentPage < totalPages && !(keyFor(state.currentPage + 1) in pageCacheRef.current)) {
                fetchPageData(state.currentPage + 1)
            }
        }

        const cachedPageEntry = pageCacheRef.current[keyFor(state.currentPage)]
        const cachedGlobalsEntry = globalsCacheRef.current[globalsKey]
        const cachedPage = Array.isArray(cachedPageEntry) ? cachedPageEntry : undefined
        const cachedGlobals = cachedGlobalsEntry && 'total' in cachedGlobalsEntry ? cachedGlobalsEntry : undefined

        if (cachedPage && cachedGlobals) {
            applyResult(cachedPage, cachedGlobals)
            setPageLoading(false)
            setError(null)
            prefetchNeighbours(Math.max(1, Math.ceil(cachedGlobals.total / pageSize)))
            return
        }

        setPageLoading(true)
        try {
            let rows: WorldRecord[] | RusherRow[] | null
            let globalsResult: Globals | null
            if (serverParams.mode === 'rushers') {
                rows = await fetchPageData(state.currentPage)
                globalsResult = await fetchGlobalsData()
            } else {
                const [r, g] = await Promise.all([fetchPageData(state.currentPage), fetchGlobalsData()])
                rows = r
                globalsResult = g
            }
            if (isCancelled()) return
            if (!rows) {
                setError('Failed to load world records. Check your connection and try again.')
                return
            }
            const globals = globalsResult ?? (() => {
                const e = globalsCacheRef.current[globalsKey]
                return e && 'total' in e ? e : null
            })()
            if (globals) {
                applyResult(rows, globals)
                prefetchNeighbours(Math.max(1, Math.ceil(globals.total / pageSize)))
            } else {
                const pageRows = rows
                onCachesChange(prev => serverParams.mode === 'rushers'
                    ? { ...prev, rusherRows: pageRows as RusherRow[], querySig, lastRefreshIso: new Date().toISOString() }
                    : { ...prev, recordRows: pageRows as WorldRecord[], querySig, lastRefreshIso: new Date().toISOString() })
            }
            setError(null)
        } finally {
            if (!isCancelled()) setPageLoading(false)
        }
    }, [accessToken, serverParams.mode, state.currentPage, pageSize, keyFor, globalsKey, querySig, fetchPageData, fetchGlobalsData, applyResult, onCachesChange])

    useEffect(() => {
        let cancelled = false
        loadPage(() => cancelled)
        return () => { cancelled = true }
    }, [loadPage])

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
            globalsCacheRef.current = {}
            void loadPage()
        })
    }

    useRegisterPageRefresh({
        onRefresh: refresh,
        refreshing: pageLoading,
        disabled: !refreshCooldown.canRefresh,
        tooltip: refreshCooldown.canRefresh ? 'Refresh Data' : `Wait ${refreshCooldown.remainingSeconds}s`,
    })

    const setMode = (mode: WorldRecordsMode) =>
        onStateChange(prev => prev.mode === mode ? prev : { ...prev, mode, currentPage: 1 })

    const setSearch = (value: string) =>
        onStateChange(prev => ({ ...prev, search: value, currentPage: 1 }))

    const updateFilter = <K extends keyof WorldRecordsPageState>(key: K, value: WorldRecordsPageState[K]) =>
        onStateChange(prev => ({ ...prev, [key]: value, currentPage: 1 }))

    const captureFilters = (): WorldRecordsPresetFilters => ({
        search: state.search,
        difficultyFilters: state.difficultyFilters,
        holderFilters: state.holderFilters,
        timeFilters: state.timeFilters,
        yearFilters: state.yearFilters,
        timeframe: state.timeframe,
        favoritesOnly: state.favoritesOnly,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
    })

    const handleSavePreset = (name: string, filters: WorldRecordsPresetFilters) => {
        const next = [...presets, { id: newPresetId(), name, filters }]
        setPresets(next)
        persistPresets(PRESETS_KEY, next)
        setActivePresetId(next[next.length - 1].id)
    }

    const handleLoadPreset = (p: WorldRecordsPreset) => {
        setActivePresetId(p.id)
        onStateChange(prev => ({ ...prev, ...pickPresetFilters(p.filters ?? {}), currentPage: 1, scrollTop: 0 }))
    }

    const handleDeletePreset = (p: WorldRecordsPreset) => {
        const next = presets.filter(x => x.id !== p.id)
        setPresets(next)
        persistPresets(PRESETS_KEY, next)
        if (activePresetId === p.id) setActivePresetId(null)
    }

    const resetFilters = () => {
        onStateChange(prev => ({
            ...DEFAULT_WORLD_RECORDS_STATE,
            mode: prev.mode,
            columnVisibility: prev.columnVisibility,
            columnOrder: prev.columnOrder,
            filtersPanelOpen: prev.filtersPanelOpen,
            pageSizePreference: prev.pageSizePreference,
        }))
        setActivePresetId(null)
    }

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

    const visibleColumns = useMemo(
        () => state.columnOrder.filter(id => REQUIRED_COLUMNS.has(id) || state.columnVisibility[id]),
        [state.columnOrder, state.columnVisibility],
    )

    const responsiveColumns = useMemo<ResponsiveColumn[]>(
        () => visibleColumns.map(id => ({
            id,
            width: COLUMN_WIDTH[id],
            priority: COLUMN_PRIORITY[id],
            required: REQUIRED_COLUMNS.has(id),
        })),
        [visibleColumns],
    )

    const [compactMode, setCompactMode] = useState(false)
    const handleCompactChange = useCallback((compact: boolean) => setCompactMode(compact), [])

    const [recordsResolved, setRecordsResolved] = useState<Set<WorldRecordsColumnId> | null>(null)
    const handleRecordsResolve = useCallback((ids: Set<string>) => {
        setRecordsResolved(ids as Set<WorldRecordsColumnId>)
    }, [])

    const effectiveColumns = useMemo(
        () => recordsResolved ? visibleColumns.filter(id => recordsResolved.has(id)) : visibleColumns,
        [visibleColumns, recordsResolved],
    )
    const visibleColumnCount = effectiveColumns.length

    const [rushersResolved, setRushersResolved] = useState<Set<RusherColumnId> | null>(null)
    const handleRushersResolve = useCallback((ids: Set<string>) => {
        setRushersResolved(ids as Set<RusherColumnId>)
    }, [])
    const isRusherColumnVisible = (id: RusherColumnId): boolean =>
        !rushersResolved || rushersResolved.has(id)
    const rusherColumnCount = RUSHER_COLUMN_IDS.reduce(
        (n, id) => n + (isRusherColumnVisible(id) ? 1 : 0),
        0,
    )

    const totalRecords = caches.totalRecords
    const maxRusherCount = caches.maxRusherCount

    const totalCount = isRushers ? caches.rusherTotal : caches.recordTotal
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
    const page = Math.min(state.currentPage, totalPages)
    const sliceStart = (page - 1) * pageSize
    const recordPageRows = caches.recordRows
    const rusherPageRows = caches.rusherRows
    const firstNewIdx = recordPageRows.findIndex(r => highlight.isNew(r.added))

    useEffect(() => {
        if (cacheFresh && totalCount > 0 && state.currentPage > totalPages) {
            onStateChange(prev => ({ ...prev, currentPage: totalPages }))
        }
    }, [cacheFresh, totalCount, totalPages, state.currentPage, onStateChange])

    const showSkeleton = !error && (!cacheFresh || (pageLoading && currentRows.length === 0))

    const activeFilterCount = [
        state.difficultyFilters.length > 0,
        state.holderFilters.length > 0,
        state.timeFilters.length > 0,
        state.yearFilters.length > 0,
        state.timeframe !== 'all',
        state.favoritesOnly,
    ].filter(Boolean).length
    const recordsHaveFilter = activeFilterCount > 0 || !!debouncedSearch
    const hasActiveFilters = activeFilterCount > 0 || state.search.trim() !== ''
    const activeHasFilter = isRushers ? !!debouncedSearch : recordsHaveFilter
    const showPodium = isRushers && !debouncedSearch && page === 1 && caches.rusherTotal >= 3

    const activePreset = activePresetId ? presets.find(p => p.id === activePresetId) ?? null : null
    useEffect(() => {
        if (!activePreset) return
        if (!presetFiltersMatch(captureFilters(), activePreset.filters)) setActivePresetId(null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activePreset, state.search, state.difficultyFilters, state.holderFilters, state.timeFilters, state.yearFilters, state.timeframe, state.favoritesOnly, state.sortBy, state.sortDir])

    const openHistory = useCallback(async (mapName: string) => {
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

    const renderCell = (
        id: WorldRecordsColumnId,
        r: WorldRecord,
        isNew: boolean,
        cellRef?: (el: HTMLTableCellElement | null) => void,
    ) => {
        const isSelf = selfId != null && r.user_id === String(selfId)
        switch (id) {
            case 'map':
                return (
                    <DataTableCell key={id} ref={cellRef}>
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
                                <MapNavLink
                                    mapName={r.map}
                                    onMapSelect={onMapSelect}
                                    className="font-bold text-foreground/90 truncate hover:text-foreground hover:underline underline-offset-2 cursor-pointer text-left"
                                >
                                    {displayMapName(r.map)}
                                </MapNavLink>
                                {isNew && (
                                    <span className="shrink-0 inline-flex items-center h-4 px-1.5 rounded-full bg-accent-500 text-white text-[9px] font-black uppercase tracking-wider">
                                        New
                                    </span>
                                )}
                            </div>
                        </div>
                    </DataTableCell>
                )
            case 'holder':
                return (
                    <DataTableCell key={id}>
                        {r.members && r.members.length > 0 ? (
                            <TeamHolders
                                members={r.members.map(m => ({
                                    userId: m.user,
                                    alias: m.alias,
                                    activeTitle: m.active_title,
                                }))}
                                currentUserId={selfId != null ? String(selfId) : undefined}
                            />
                        ) : (
                            <PlayerInfo
                                userId={r.user_id}
                                alias={r.alias}
                                title={r.active_title}
                                size="sm"
                                highlight={isSelf}
                                showYouBadge={isSelf}
                            />
                        )}
                    </DataTableCell>
                )
            case 'time': {
                const rowTeamCapId = teamRunCapId(r)
                return (
                    <DataTableCell key={id} align="right">
                        <CapTimeLink
                            capId={rowTeamCapId ? undefined : r.cap_id}
                            teamCapId={rowTeamCapId ?? undefined}
                            seconds={r.cap_time_seconds}
                            className="font-mono font-black tabular-nums text-blue-300 tracking-tight"
                        />
                    </DataTableCell>
                )
            }
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
            case 'actions': {
                const demoCapId = recordFeedDemoCapId({ id: r.cap_id, demoCapId: r.demo_cap_id, members: r.members })
                return (
                    <DataTableCell key={id} align="center" className="px-2">
                        <div className="flex items-center justify-center gap-1">
                            <IconActionButton
                                variant="replay"
                                icon={Play}
                                iconFill
                                tooltip={demoCapId ? 'Watch run' : 'No replay available for this run'}
                                disabled={!demoCapId}
                                loading={replay.loadingCapId === r.cap_id}
                                onClick={() => replay.openReplay({
                                    capId: demoCapId,
                                    loadingKey: r.cap_id,
                                    mapName: r.map,
                                    time: r.cap_time_seconds,
                                    alias: r.alias ?? undefined,
                                })}
                            />
                            <IconActionButton
                                variant="download"
                                icon={Download}
                                tooltip={demoCapId ? 'Download demo' : 'No demo available for this run'}
                                disabled={!demoCapId}
                                onClick={() => demoDownload.start(
                                    { id: r.cap_id, alias: r.alias, cap_time_seconds: r.cap_time_seconds } as unknown as LeaderboardEntry,
                                    r.map,
                                    demoCapId,
                                )}
                            />
                            <WorldRecordHistoryTrigger onClick={() => openHistory(r.map)} />
                        </div>
                    </DataTableCell>
                )
            }
        }
    }

    const recordWord = totalCount === 1 ? 'record' : 'records'

    const compactSkeleton = Array.from({ length: Math.min(pageSize, AUTO_PAGE_SIZE_MAX_ROWS) }).map((_, i) => (
        <div key={i} className="h-14 mx-3 my-2 rounded-lg bg-hairline/5 animate-pulse" />
    ))

    const compactRecordContent = showSkeleton ? compactSkeleton : recordPageRows.length === 0 ? (
        <div className="px-4 py-16 text-center text-muted-foreground">
            {recordsHaveFilter ? 'No world records match your filters.' : 'No world records found.'}
        </div>
    ) : recordPageRows.map(r => {
        const rowTeamCapId = teamRunCapId(r)
        const isTeamRow = !!rowTeamCapId
        const isSelf = selfId != null && r.user_id === String(selfId)
        const isNew = highlight.isNew(r.added)
        return (
            <div
                key={r.cap_id}
                role="listitem"
                className={cn(
                    'grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-3 border-b border-hairline/5 last:border-0',
                    isNew && 'bg-accent-500/[0.07]',
                )}
            >
                <div className="min-w-0 space-y-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <FavoriteStar
                            name={r.map}
                            isFavorited={favoriteMapNames.has(r.map)}
                            onToggle={onToggleFavorite}
                            size="sm"
                            className="shrink-0"
                        />
                        <MapNavLink
                            mapName={r.map}
                            onMapSelect={onMapSelect}
                            className="font-bold text-foreground/90 truncate hover:text-foreground hover:underline underline-offset-2 cursor-pointer text-left"
                        >
                            {displayMapName(r.map)}
                        </MapNavLink>
                    </div>
                    {isTeamRow ? (
                        <TeamHolders
                            members={(r.members ?? []).map(m => ({
                                userId: m.user,
                                alias: m.alias,
                                activeTitle: m.active_title,
                            }))}
                            currentUserId={selfId != null ? String(selfId) : undefined}
                        />
                    ) : (
                        <PlayerInfo
                            userId={r.user_id}
                            alias={r.alias}
                            title={r.active_title}
                            size="sm"
                            highlight={isSelf}
                            showYouBadge={isSelf}
                        />
                    )}
                </div>
                <div className="flex flex-col items-end justify-between gap-2">
                    <CapTimeLink
                        capId={rowTeamCapId ? undefined : r.cap_id}
                        teamCapId={rowTeamCapId ?? undefined}
                        seconds={r.cap_time_seconds}
                        className="font-mono font-black tabular-nums text-blue-300 tracking-tight"
                    />
                    <div className="flex items-center gap-2">
                        {r.difficulty != null && (
                            <span className={cn('font-mono tabular-nums text-xs font-bold', difficultyTextColor(r.difficulty))}>
                                {r.difficulty}
                            </span>
                        )}
                        <span className="text-xs text-muted-foreground tabular-nums">{formatAddedDate(r.added)}</span>
                    </div>
                </div>
            </div>
        )
    })

    const compactRusherContent = showSkeleton ? compactSkeleton : rusherPageRows.length === 0 ? (
        <div className="px-4 py-16 text-center text-muted-foreground">
            {debouncedSearch ? 'No rushers match your search.' : 'No rushers found.'}
        </div>
    ) : rusherPageRows.map((r, i) => {
        const rank = sliceStart + i + 1
        const isSelf = selfId != null && r.user_id === String(selfId)
        const share = totalRecords > 0 ? (r.count / totalRecords) * 100 : 0
        return (
            <div key={r.user_id} role="listitem" className="flex items-center gap-3 p-3 border-b border-hairline/5 last:border-0">
                <span className={cn('font-mono font-bold tabular-nums w-9 shrink-0 text-right', medalText(rank))}>
                    #{rank}
                </span>
                <div className="min-w-0 flex-1">
                    <PlayerInfo
                        userId={r.user_id}
                        alias={r.alias}
                        title={r.active_title}
                        size="sm"
                        highlight={isSelf}
                        showYouBadge={isSelf}
                    />
                </div>
                <div className="flex flex-col items-end shrink-0">
                    <span className="font-mono tabular-nums text-foreground font-bold">
                        {r.count}
                        <span className="ml-1 text-[9px] uppercase tracking-widest text-muted-foreground font-bold">WRs</span>
                    </span>
                    <span className="font-mono tabular-nums text-xs text-muted-foreground">{share.toFixed(1)}%</span>
                </div>
            </div>
        )
    })

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden">
            <div className="flex items-end justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-foreground leading-tight">World Records</h1>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {isRushers ? (
                            <>
                                Who are the fastest rushers in the world?
                                <br />
                                {!showSkeleton && (
                                    <span className="opacity-50"> {caches.rusherTotal.toLocaleString()} rushers · {totalRecords.toLocaleString()} records</span>
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
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="inline-flex items-center gap-1 p-1 rounded-lg bg-card/50 border border-hairline/10">
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
                                        ? 'bg-accent-500/20 text-accent-200 border-accent-500/40'
                                        : 'text-muted-foreground hover:text-foreground border-transparent',
                                )}
                            >
                                <Icon className="size-4" />
                                {m.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="relative flex-1 min-w-48 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder={isRushers ? 'Search rushers...' : 'Search maps or players...'}
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

                {!isRushers && (
                    <>
                        <button
                            type="button"
                            onClick={() => onStateChange(prev => ({ ...prev, filtersPanelOpen: !prev.filtersPanelOpen }))}
                            className={cn(
                                'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer',
                                state.filtersPanelOpen
                                    ? 'bg-accent-500/20 border-accent-500/50 text-accent-300'
                                    : 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20',
                            )}
                        >
                            <SlidersHorizontal className="size-4" />
                            Filters
                            {activeFilterCount > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent-500 text-white">
                                    {activeFilterCount}
                                </span>
                            )}
                        </button>

                        {!compactMode && (
                            <ColumnsMenu<WorldRecordsColumnId>
                                columnOrder={state.columnOrder}
                                columnVisibility={state.columnVisibility}
                                columnLabels={WORLD_RECORDS_COLUMN_LABELS}
                                onToggle={toggleColumn}
                                onReorder={reorderColumn}
                                requiredColumns={REQUIRED_COLUMNS}
                            />
                        )}
                    </>
                )}
            </div>

            {!isRushers && hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {state.search.trim() !== '' && (
                        <ActiveFilterChip label="Search" value={state.search} onClear={() => setSearch('')} />
                    )}
                    {state.difficultyFilters.map(d => (
                        <ActiveFilterChip
                            key={`diff-${d}`}
                            label="Difficulty"
                            value={DIFFICULTY_TIER_LABEL[d] ?? d}
                            onClear={() => updateFilter('difficultyFilters', state.difficultyFilters.filter(x => x !== d))}
                        />
                    ))}
                    {state.holderFilters.map(h => (
                        <ActiveFilterChip
                            key={`holder-${h}`}
                            label="Holder"
                            value={holderAliasById[h] ?? h}
                            onClear={() => updateFilter('holderFilters', state.holderFilters.filter(x => x !== h))}
                        />
                    ))}
                    {state.timeFilters.map(t => (
                        <ActiveFilterChip
                            key={`time-${t}`}
                            label="Time"
                            value={TIME_BUCKET_OPTIONS.find(([v]) => v === t)?.[1] ?? t}
                            onClear={() => updateFilter('timeFilters', state.timeFilters.filter(x => x !== t))}
                        />
                    ))}
                    {state.yearFilters.map(y => (
                        <ActiveFilterChip
                            key={`year-${y}`}
                            label="Year"
                            value={y}
                            onClear={() => updateFilter('yearFilters', state.yearFilters.filter(x => x !== y))}
                        />
                    ))}
                    {state.timeframe !== 'all' && (
                        <ActiveFilterChip
                            label="Added"
                            value={TIMEFRAME_OPTIONS.find(o => o.value === state.timeframe)?.label ?? state.timeframe}
                            onClear={() => updateFilter('timeframe', 'all')}
                        />
                    )}
                    {!!accessToken && state.favoritesOnly && (
                        <ActiveFilterChip label="Favorites" value="On" onClear={() => updateFilter('favoritesOnly', false)} />
                    )}
                </div>
            )}

            {!isRushers && state.filtersPanelOpen && (
                <div className="bg-card/30 border border-hairline/10 rounded-xl p-4 space-y-4 shrink-0">
                    <FilterPanelRow label="Record">
                        <MultiFilterDropdown
                            label="Difficulty"
                            values={state.difficultyFilters}
                            onChange={v => updateFilter('difficultyFilters', v as WrDifficultyTierValue[])}
                            options={DIFFICULTY_TIER_OPTIONS}
                        />
                        <MultiFilterDropdown
                            label="Holder"
                            values={state.holderFilters}
                            onChange={v => updateFilter('holderFilters', v)}
                            options={holderOptions}
                            searchable
                        />
                        <MultiFilterDropdown
                            label="Time"
                            values={state.timeFilters}
                            onChange={v => updateFilter('timeFilters', v as WrTimeBucket[])}
                            options={TIME_BUCKET_OPTIONS}
                        />
                    </FilterPanelRow>

                    <FilterPanelRow label="Date">
                        <MultiFilterDropdown
                            label="Year"
                            values={state.yearFilters}
                            onChange={v => updateFilter('yearFilters', v)}
                            options={yearOptions}
                            searchable
                        />
                        <div className="flex flex-col gap-1">
                            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Recent</label>
                            <select
                                value={state.timeframe}
                                onChange={e => updateFilter('timeframe', e.target.value as WrTimeframe)}
                                style={{ colorScheme: 'dark' }}
                                className="min-w-40 px-2 py-2 bg-card/50 border border-hairline/10 rounded text-sm text-foreground hover:border-hairline/20 focus:outline-none focus:border-accent-500/50 cursor-pointer"
                                aria-label="Filter by recency"
                            >
                                {TIMEFRAME_OPTIONS.map(o => (
                                    <option key={o.value} value={o.value} className="bg-[#0f1115] text-foreground">{o.label}</option>
                                ))}
                            </select>
                        </div>
                        <label className="flex items-center gap-2 px-3 py-2 bg-card/50 border border-hairline/10 rounded-md text-sm text-foreground cursor-pointer hover:border-hairline/20 self-end">
                            <input
                                type="checkbox"
                                checked={state.favoritesOnly}
                                onChange={e => updateFilter('favoritesOnly', e.target.checked)}
                                className="accent-yellow-400 cursor-pointer"
                            />
                            <span>Favorites</span>
                        </label>
                    </FilterPanelRow>

                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-hairline/5">
                        <FilterPresetsMenu<WorldRecordsPresetFilters>
                            presets={presets}
                            activePreset={activePreset}
                            hasActiveFilters={hasActiveFilters}
                            onSave={handleSavePreset}
                            onLoad={handleLoadPreset}
                            onDelete={handleDeletePreset}
                            captureCurrentFilters={captureFilters}
                            onResetFilters={resetFilters}
                            placeholderExample="e.g. Sub-30s WRs from 2024"
                        />
                    </div>
                </div>
            )}

            {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm shrink-0">
                    {error}
                </div>
            )}

            {isRushers && showPodium && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
                    {PODIUM_SLOTS.map(slot => {
                        const r = rusherPageRows[slot.rank - 1]
                        if (!r) return <div key={slot.rank} />
                        const isSelf = selfId != null && r.user_id === String(selfId)
                        return (
                            <div
                                key={slot.rank}
                                className={cn(
                                    'relative flex items-center gap-3 rounded-xl border border-hairline/5 px-4 py-3 overflow-hidden',
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
                <DataTableShell
                    scrollRef={scrollContainerRef}
                    onScroll={onScrollContainerScroll}
                    responsive={{
                        columns: RUSHER_COLUMNS,
                        onResolve: handleRushersResolve,
                        compactContent: compactRusherContent,
                        compactAriaLabel: 'Top rushers',
                    }}
                >
                    <DataTableHeaderRow theadDataAttr="data-utbt-rushers-thead">
                        {isRusherColumnVisible('rank') && <DataTableHeaderCell align="right" width="5rem">#</DataTableHeaderCell>}
                        {isRusherColumnVisible('rusher') && <DataTableHeaderCell align="left">Rusher</DataTableHeaderCell>}
                        {isRusherColumnVisible('records') && <DataTableHeaderCell align="left" width="20rem">World Records</DataTableHeaderCell>}
                        {isRusherColumnVisible('share') && <DataTableHeaderCell align="right" width="6rem">Share</DataTableHeaderCell>}
                        {isRusherColumnVisible('median') && <DataTableHeaderCell align="right" width="8rem">Median WR</DataTableHeaderCell>}
                        {isRusherColumnVisible('average') && <DataTableHeaderCell align="right" width="8rem">Average WR</DataTableHeaderCell>}
                    </DataTableHeaderRow>
                    <tbody>
                        {showSkeleton ? (
                            Array.from({ length: Math.min(pageSize, AUTO_PAGE_SIZE_MAX_ROWS) }).map((_, i) => (
                                <DataTableSkeletonRow key={i} columnCount={rusherColumnCount} />
                            ))
                        ) : rusherPageRows.length === 0 ? (
                            <DataTableEmpty
                                colSpan={rusherColumnCount}
                                message={debouncedSearch ? 'No rushers match your search.' : 'No rushers found.'}
                            />
                        ) : (
                            rusherPageRows.map((r, i) => {
                                const rank = sliceStart + i + 1
                                const isSelf = selfId != null && r.user_id === String(selfId)
                                const share = totalRecords > 0 ? (r.count / totalRecords) * 100 : 0
                                const barPct = maxRusherCount > 0 ? Math.max(4, (r.count / maxRusherCount) * 100) : 0
                                return (
                                    <DataTableRow key={r.user_id}>
                                        {isRusherColumnVisible('rank') && (
                                            <DataTableCell align="right">
                                                <span className={cn('font-mono font-bold tabular-nums', medalText(rank))}>
                                                    #{rank}
                                                </span>
                                            </DataTableCell>
                                        )}
                                        {isRusherColumnVisible('rusher') && (
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
                                        )}
                                        {isRusherColumnVisible('records') && (
                                            <DataTableCell>
                                                <div className="flex items-center gap-2.5">
                                                    <div className="flex-1 h-1.5 rounded-full bg-hairline/10 overflow-hidden min-w-16">
                                                        <div className="h-full rounded-full bg-accent-500/70" style={{ width: `${barPct}%` }} />
                                                    </div>
                                                    <span className="font-mono tabular-nums text-foreground font-bold w-10 text-right">
                                                        {r.count}
                                                    </span>
                                                </div>
                                            </DataTableCell>
                                        )}
                                        {isRusherColumnVisible('share') && (
                                            <DataTableCell align="right">
                                                <span className="font-mono tabular-nums text-xs text-muted-foreground">
                                                    {share.toFixed(1)}%
                                                </span>
                                            </DataTableCell>
                                        )}
                                        {isRusherColumnVisible('median') && (
                                            <DataTableCell align="right">
                                                <span className="font-mono tabular-nums text-xs text-foreground/80">
                                                    {r.median != null ? formatCapTime(r.median) : '—'}
                                                </span>
                                            </DataTableCell>
                                        )}
                                        {isRusherColumnVisible('average') && (
                                            <DataTableCell align="right">
                                                <span className="font-mono tabular-nums text-xs text-muted-foreground">
                                                    {r.average != null ? formatCapTime(r.average) : '—'}
                                                </span>
                                            </DataTableCell>
                                        )}
                                    </DataTableRow>
                                )
                            })
                        )}
                    </tbody>
                </DataTableShell>
            ) : (
                <DataTableShell
                    scrollRef={scrollContainerRef}
                    onScroll={onScrollContainerScroll}
                    responsive={{
                        columns: responsiveColumns,
                        onResolve: handleRecordsResolve,
                        compactContent: compactRecordContent,
                        compactAriaLabel: 'World records',
                        onCompactChange: handleCompactChange,
                    }}
                >
                    <DataTableHeaderRow theadDataAttr="data-utbt-worldrecords-thead">
                        {effectiveColumns.map(id => renderHeaderCell(id))}
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
                            recordPageRows.map((r, i) => {
                                const isNew = highlight.isNew(r.added)
                                const isFirstNew = i === firstNewIdx
                                return (
                                    <DataTableRow
                                        key={r.cap_id}
                                        className={isNew ? 'bg-accent-500/[0.07] ring-1 ring-inset ring-accent-500/40' : undefined}
                                    >
                                        {effectiveColumns.map(id => renderCell(
                                            id, r, isNew,
                                            id === 'map' && isFirstNew ? highlight.registerFirstNew : undefined,
                                        ))}
                                    </DataTableRow>
                                )
                            })
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

            <Suspense fallback={null}>
                <WorldRecordProgressionModal
                    isOpen={wrHistory !== null}
                    onClose={() => setWrHistory(null)}
                    mapName={wrHistory?.mapName ?? ''}
                    entries={wrHistory?.entries ?? []}
                    currentUserId={selfId}
                />
            </Suspense>

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
