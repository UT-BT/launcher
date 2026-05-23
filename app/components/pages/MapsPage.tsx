import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Search, RefreshCw, ChevronUp, ChevronDown, ArrowUpDown, SlidersHorizontal, X, Bookmark, BookmarkPlus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu'
import { Modal } from '@/app/components/ui/modal'
import {
    UserProfile, Map, MapMetadata, MapReview, BestCap,
    fetchMaps, fetchMapsCount, fetchMapsMetadata, fetchMapsFuzzy, fetchAllMapReviews, fetchMapAuthors,
    fetchBestCaps,
} from '@/app/utils/api'

import { MapReviewsModal } from '@/app/components/modals/MapReviewsModal'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'

import championIcon from '@/app/assets/champion.png'
import goldIcon from '@/app/assets/gold.png'
import silverIcon from '@/app/assets/silver.png'
import bronzeIcon from '@/app/assets/bronze.png'
import certifiedIcon from '@/app/assets/certified.png'
import casualIcon from '@/app/assets/casual.png'

export type RatingTier = 'all' | 'excellent' | 'good' | 'average' | 'poor'
export type LuckTier = 'all' | 'low' | 'fair' | 'some' | 'high'
export type RecordTimeTier = 'all' | 'sub15' | 'sub30' | 'sub45' | 'sub60' | 'sub90' | 'sub120' | 'sub180' | 'sub300' | 'over300'
export type DifficultyTier = 'all' | 'beginner' | 'intermediate' | 'advanced' | 'expert'
export type CappedFilter =
    | 'all' | 'uncapped' | 'capped' | 'verified' | 'casual'
    | 'bronze' | 'silver' | 'gold' | 'champion'
export type SortField = 'name' | 'author' | 'added' | 'difficulty' | 'world_record' | 'rating' | 'my_rating' | 'medal'
export type SortDir = 'asc' | 'desc'

export interface AvgRatings {
    overall: number
    aesthetics: number
    learning: number
    luck: number
}

export interface MapsPageState {
    search: string
    authorFilter: string
    tagFilter: string
    yearFilter: string
    difficultyFilter: DifficultyTier
    ratingFilter: RatingTier
    aestheticsFilter: RatingTier
    learningFilter: RatingTier
    luckFilter: LuckTier
    recordTimeFilter: RecordTimeTier
    cappedFilter: CappedFilter
    newOnly: boolean
    sortBy: SortField
    sortDir: SortDir
    currentPage: number
    pageSizePreference: number | 'auto'
    filtersPanelOpen: boolean
    scrollTop: number
}

export interface MapsPageCaches {
    metadata: MapMetadata[] | null
    avgRatings: Record<string, AvgRatings>
    myReviews: Record<string, MapReview>
    authors: string[]
    bestCaps: Record<string, BestCap>
    pageMaps: Map[]
    totalCount: number
    metadataLoaded: boolean
    reviewsLoaded: boolean
    authorsLoaded: boolean
    bestCapsLoaded: boolean
}

export const DEFAULT_MAPS_STATE: MapsPageState = {
    search: '',
    authorFilter: 'all',
    tagFilter: 'all',
    yearFilter: 'all',
    difficultyFilter: 'all',
    ratingFilter: 'all',
    aestheticsFilter: 'all',
    learningFilter: 'all',
    luckFilter: 'all',
    recordTimeFilter: 'all',
    cappedFilter: 'all',
    newOnly: false,
    sortBy: 'name',
    sortDir: 'asc',
    currentPage: 1,
    pageSizePreference: 'auto',
    filtersPanelOpen: false,
    scrollTop: 0,
}

export const DEFAULT_MAPS_CACHES: MapsPageCaches = {
    metadata: null,
    avgRatings: {},
    myReviews: {},
    authors: [],
    bestCaps: {},
    pageMaps: [],
    totalCount: 0,
    metadataLoaded: false,
    reviewsLoaded: false,
    authorsLoaded: false,
    bestCapsLoaded: false,
}

const PRESETS_KEY = 'utbt:mapsPresets:v1'

export type PresetFilters = Pick<MapsPageState,
    'search' | 'authorFilter' | 'tagFilter' | 'yearFilter' |
    'difficultyFilter' | 'ratingFilter' | 'aestheticsFilter' | 'learningFilter' |
    'luckFilter' | 'recordTimeFilter' | 'cappedFilter' | 'newOnly' |
    'sortBy' | 'sortDir'>

export interface MapsPreset {
    id: string
    name: string
    filters: PresetFilters
}

const loadPresets = (): MapsPreset[] => {
    try {
        const raw = localStorage.getItem(PRESETS_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        return Array.isArray(parsed) ? parsed : []
    } catch {
        return []
    }
}

const persistPresets = (presets: MapsPreset[]): void => {
    try {
        localStorage.setItem(PRESETS_KEY, JSON.stringify(presets))
    } catch {
        // ignore quota / serialization errors
    }
}

const newPresetId = (): string => {
    try {
        return crypto.randomUUID()
    } catch {
        return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    }
}

const DIFFICULTY_RANGES: Record<Exclude<DifficultyTier, 'all'>, [number, number]> = {
    beginner: [1, 3],
    intermediate: [4, 6],
    advanced: [7, 8],
    expert: [9, 10],
}

const RATING_RANGES: Record<Exclude<RatingTier, 'all'>, [number, number]> = {
    excellent: [80, 100],
    good: [60, 79.999],
    average: [40, 59.999],
    poor: [0, 39.999],
}

const LUCK_RANGES: Record<Exclude<LuckTier, 'all'>, [number, number]> = {
    low: [0, 39.999],
    fair: [40, 59.999],
    some: [60, 79.999],
    high: [80, 100],
}

const RECORD_TIME_MAX: Record<Exclude<RecordTimeTier, 'all' | 'over300'>, number> = {
    sub15: 15,
    sub30: 30,
    sub45: 45,
    sub60: 60,
    sub90: 90,
    sub120: 120,
    sub180: 180,
    sub300: 300,
}

const RECORD_TIME_LABELS: Record<RecordTimeTier, string> = {
    all: 'Any time',
    sub15: 'Under 15s',
    sub30: 'Under 30s',
    sub45: 'Under 45s',
    sub60: 'Under 1m',
    sub90: 'Under 1m 30s',
    sub120: 'Under 2m',
    sub180: 'Under 3m',
    sub300: 'Under 5m',
    over300: 'Over 5m',
}

interface MapsPageProps {
    userProfile?: UserProfile
    state: MapsPageState
    onStateChange: (updater: (prev: MapsPageState) => MapsPageState) => void
    caches: MapsPageCaches
    onCachesChange: (updater: (prev: MapsPageCaches) => MapsPageCaches) => void
    onMapSelect: (mapName: string) => void
}

const formatCapTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    const msStr = ms.toString().padStart(3, '0')
    const secsStr = secs.toString().padStart(2, '0')
    const minsStr = minutes.toString().padStart(2, '0')
    if (hours > 0) return `${hours}:${minsStr}:${secsStr}.${msStr}`
    return `${minsStr}:${secsStr}.${msStr}`
}

const isNew = (added: string): boolean => {
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    return new Date(added) >= thirtyDaysAgo
}

const difficultyColor = (d: number): string => {
    if (d <= 3) return 'bg-green-500'
    if (d <= 6) return 'bg-yellow-500'
    return 'bg-red-500'
}

const difficultyTextColor = (d: number): string => {
    if (d <= 3) return 'text-green-400'
    if (d <= 6) return 'text-yellow-400'
    return 'text-red-400'
}

const ratingColor = (r: number): string => {
    if (r <= 3) return 'bg-red-500'
    if (r <= 6) return 'bg-yellow-500'
    return 'bg-green-500'
}

const ratingTextColor = (r: number): string => {
    if (r <= 3) return 'text-red-400'
    if (r <= 6) return 'text-yellow-400'
    return 'text-green-400'
}

const MapThumbnail = ({ mapName }: { mapName: string }) => {
    const url = `https://utbt.net/images/screenshots/${mapName}.png`
    const [imgSrc, setImgSrc] = useState(url)
    useEffect(() => { setImgSrc(url) }, [url])

    return (
        <div className="w-12 h-12 overflow-hidden bg-muted/20 border border-white/10 rounded shrink-0">
            <img
                src={imgSrc}
                alt={mapName}
                className="w-full h-full object-cover"
                onError={() => setImgSrc('https://utbt.net/images/screenshots/default.png')}
            />
        </div>
    )
}

export type MedalTier = 'uncapped' | 'casual' | 'verified' | 'bronze' | 'silver' | 'gold' | 'champion'

const TIER_ICONS: Record<Exclude<MedalTier, 'uncapped'>, string> = {
    casual: casualIcon,
    verified: certifiedIcon,
    bronze: bronzeIcon,
    silver: silverIcon,
    gold: goldIcon,
    champion: championIcon,
}

const TIER_LABELS: Record<MedalTier, string> = {
    uncapped: 'Uncapped',
    casual: 'Casual',
    verified: 'Verified',
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    champion: 'Champion',
}

const TIER_RANK: Record<MedalTier, number> = {
    uncapped: 0,
    casual: 1,
    verified: 2,
    bronze: 3,
    silver: 4,
    gold: 5,
    champion: 6,
}

function computeMedalTier(
    bestCap: BestCap | undefined,
    map: Pick<MapMetadata, 'bronze_medal' | 'silver_medal' | 'gold_medal' | 'champion_medal'> | undefined,
): MedalTier {
    if (!bestCap) return 'uncapped'
    if (bestCap.cap_type !== 2) return 'casual'
    if (!map) return 'verified'
    const t = bestCap.cap_time_seconds
    if (map.champion_medal != null && t <= map.champion_medal) return 'champion'
    if (map.gold_medal != null && t <= map.gold_medal) return 'gold'
    if (map.silver_medal != null && t <= map.silver_medal) return 'silver'
    if (map.bronze_medal != null && t <= map.bronze_medal) return 'bronze'
    return 'verified'
}

const MedalIndicator = ({ tier, bestCap }: { tier: MedalTier; bestCap?: BestCap }) => {
    const tip = bestCap
        ? `${TIER_LABELS[tier]} — ${formatCapTime(bestCap.cap_time_seconds)}`
        : 'Not capped yet'
    if (tier === 'uncapped') {
        return <span aria-hidden className="inline-block size-5 shrink-0" />
    }
    return (
        <img
            src={TIER_ICONS[tier]}
            alt={TIER_LABELS[tier]}
            title={tip}
            className="size-5 shrink-0 object-contain"
        />
    )
}

const SkeletonRow = () => (
    <tr className="border-b border-white/5">
        <td className="px-4 py-3"><div className="w-12 h-12 rounded bg-white/5 animate-pulse" /></td>
        <td className="px-2 py-3 text-center"><div className="inline-block size-5 rounded-full bg-white/5 animate-pulse" /></td>
        <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-white/5 animate-pulse" /></td>
        <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-white/5 animate-pulse" /></td>
        <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-white/5 animate-pulse" /></td>
        <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-white/5 animate-pulse" /></td>
        <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-white/5 animate-pulse" /></td>
        <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-white/5 animate-pulse" /></td>
        <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-white/5 animate-pulse" /></td>
    </tr>
)

function aggregateReviews(reviews: MapReview[]): Record<string, AvgRatings> {
    const acc: Record<string, { sum: AvgRatings; count: number }> = {}
    for (const r of reviews) {
        if (!acc[r.map_name]) {
            acc[r.map_name] = { sum: { overall: 0, aesthetics: 0, learning: 0, luck: 0 }, count: 0 }
        }
        acc[r.map_name].sum.overall += r.overall
        acc[r.map_name].sum.aesthetics += r.aesthetics
        acc[r.map_name].sum.learning += r.learning
        acc[r.map_name].sum.luck += r.luck
        acc[r.map_name].count++
    }
    const result: Record<string, AvgRatings> = {}
    for (const [name, { sum, count }] of Object.entries(acc)) {
        result[name] = {
            overall: Math.round(sum.overall / count),
            aesthetics: Math.round(sum.aesthetics / count),
            learning: Math.round(sum.learning / count),
            luck: Math.round(sum.luck / count),
        }
    }
    return result
}

function indexMyReviews(reviews: MapReview[], userId?: string | number): Record<string, MapReview> {
    if (!userId) return {}
    const idStr = String(userId)
    const out: Record<string, MapReview> = {}
    for (const r of reviews) {
        if (String(r.user) === idStr) out[r.map_name] = r
    }
    return out
}

function computePageSize(): number {
    if (typeof window === 'undefined') return 25
    const rowHeight = 56
    const chrome = 320
    const usable = Math.max(window.innerHeight - chrome, rowHeight * 10)
    const rows = Math.floor(usable / rowHeight)
    return Math.min(60, Math.max(10, rows))
}

function getAuthorString(m: Partial<Pick<Map, 'author' | 'author_str'>>): string {
    const author = m.author
    if (typeof author === 'string' && author.trim()) return author.trim()
    if (typeof author === 'number') return String(author)
    if (m.author_str && m.author_str.trim()) return m.author_str.trim()
    return ''
}

function isMapInDifficultyTier(difficulty: number, tier: DifficultyTier): boolean {
    if (tier === 'all') return true
    const [min, max] = DIFFICULTY_RANGES[tier]
    return difficulty >= min && difficulty <= max
}

function isInRatingTier(value: number | undefined, tier: RatingTier): boolean {
    if (tier === 'all') return true
    if (value === undefined) return false
    const [min, max] = RATING_RANGES[tier]
    return value >= min && value <= max
}

function isInLuckTier(value: number | undefined, tier: LuckTier): boolean {
    if (tier === 'all') return true
    if (value === undefined) return false
    const [min, max] = LUCK_RANGES[tier]
    return value >= min && value <= max
}

function isInRecordTimeTier(wr: number | undefined, tier: RecordTimeTier): boolean {
    if (tier === 'all') return true
    if (wr === undefined) return false
    if (tier === 'over300') return wr > 300
    return wr < RECORD_TIME_MAX[tier]
}

function ratingScale100(avg: number | undefined): number | undefined {
    return avg === undefined ? undefined : avg * 10
}

export function MapsPage({
    userProfile, state, onStateChange, caches, onCachesChange, onMapSelect,
}: MapsPageProps) {
    const [autoPageSize, setAutoPageSize] = useState(computePageSize)
    const pageSize = state.pageSizePreference === 'auto' ? autoPageSize : state.pageSizePreference
    const [loading, setLoading] = useState(!caches.metadataLoaded || !caches.reviewsLoaded)
    const [pageLoading, setPageLoading] = useState(false)
    const [searchLoading, setSearchLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [searchResults, setSearchResults] = useState<Map[]>([])
    const [reviewsModalMap, setReviewsModalMap] = useState<string | null>(null)
    const [presets, setPresets] = useState<MapsPreset[]>(() => loadPresets())
    const [savePresetOpen, setSavePresetOpen] = useState(false)
    const [presetNameInput, setPresetNameInput] = useState('')
    const [presetPendingDelete, setPresetPendingDelete] = useState<MapsPreset | null>(null)
    const [presetsMenuOpen, setPresetsMenuOpen] = useState(false)
    const searchAbortRef = useRef<AbortController | null>(null)
    const scrollContainerRef = useRef<HTMLDivElement | null>(null)

    const accessToken = (userProfile as any)?.accessToken

    // --- Mode derivation ---
    const isSearchMode = state.search.trim().length > 0
    const usesClientOnlyFilter =
        state.ratingFilter !== 'all' ||
        state.aestheticsFilter !== 'all' ||
        state.learningFilter !== 'all' ||
        state.luckFilter !== 'all' ||
        state.recordTimeFilter !== 'all' ||
        state.yearFilter !== 'all' ||
        state.cappedFilter !== 'all' ||
        state.sortBy === 'rating' ||
        state.sortBy === 'my_rating' ||
        state.sortBy === 'world_record' ||
        state.sortBy === 'author' ||
        state.sortBy === 'medal'
    const mode: 'browse' | 'search' | 'fullload' =
        isSearchMode ? 'search' : usesClientOnlyFilter ? 'fullload' : 'browse'

    // --- Server-side filter object (used in browse mode) ---
    const browseServerFilters = useMemo(() => {
        const filters: Parameters<typeof fetchMaps>[1] = { active: true }
        if (state.authorFilter !== 'all') filters.author = state.authorFilter
        if (state.tagFilter !== 'all') filters.tag = state.tagFilter
        if (state.difficultyFilter !== 'all') {
            const [min, max] = DIFFICULTY_RANGES[state.difficultyFilter]
            filters.difficultyMin = min
            filters.difficultyMax = max
        }
        if (state.newOnly) {
            const thirty = new Date()
            thirty.setDate(thirty.getDate() - 30)
            filters.addedSince = thirty.toISOString()
        }
        if (state.sortBy === 'name' || state.sortBy === 'added' || state.sortBy === 'difficulty') {
            filters.sort = state.sortBy
            filters.order = state.sortDir
        }
        return filters
    }, [
        state.authorFilter, state.tagFilter, state.difficultyFilter,
        state.newOnly, state.sortBy, state.sortDir,
    ])

    const userId = (userProfile as any)?.id

    const newMapCount = useMemo(() => {
        if (!caches.metadata) return 0
        return caches.metadata.reduce((n, m) => n + (isNew(m.added) ? 1 : 0), 0)
    }, [caches.metadata])

    // --- Initial caches load ---
    const loadCaches = useCallback(async (force = false) => {
        if (!accessToken) return
        const needsMetadata = force || !caches.metadataLoaded
        const needsReviews = force || !caches.reviewsLoaded
        const needsAuthors = force || !caches.authorsLoaded
        const needsBestCaps = (force || !caches.bestCapsLoaded) && !!userId
        if (!needsMetadata && !needsReviews && !needsAuthors && !needsBestCaps) return

        setError(null)
        try {
            const [metadataData, reviewsData, authorsData, bestCapsData] = await Promise.all([
                needsMetadata ? fetchMapsMetadata(accessToken) : Promise.resolve(caches.metadata),
                needsReviews ? fetchAllMapReviews(accessToken) : Promise.resolve(null),
                needsAuthors ? fetchMapAuthors(accessToken) : Promise.resolve(null),
                needsBestCaps ? fetchBestCaps(accessToken, userId) : Promise.resolve(null),
            ])
            onCachesChange(prev => ({
                ...prev,
                metadata: needsMetadata ? metadataData as MapMetadata[] : prev.metadata,
                metadataLoaded: needsMetadata ? true : prev.metadataLoaded,
                avgRatings: needsReviews ? aggregateReviews(reviewsData as MapReview[]) : prev.avgRatings,
                myReviews: needsReviews ? indexMyReviews(reviewsData as MapReview[], userId) : prev.myReviews,
                reviewsLoaded: needsReviews ? true : prev.reviewsLoaded,
                authors: needsAuthors ? (authorsData as string[]) : prev.authors,
                authorsLoaded: needsAuthors ? true : prev.authorsLoaded,
                bestCaps: needsBestCaps
                    ? Object.fromEntries((bestCapsData as BestCap[]).map(c => [c.map, c]))
                    : prev.bestCaps,
                bestCapsLoaded: needsBestCaps ? true : prev.bestCapsLoaded,
            }))
        } catch (e) {
            setError('Failed to load maps. Check your connection and try again.')
        }
    }, [accessToken, userId, caches.metadataLoaded, caches.reviewsLoaded, caches.authorsLoaded, caches.bestCapsLoaded, caches.metadata, onCachesChange])

    useEffect(() => { loadCaches() }, [loadCaches])

    // --- Browse-mode page fetch + adjacent prefetch ---
    const pageCacheRef = useRef<Record<string, Map[]>>({})
    const countCacheRef = useRef<Record<string, number>>({})

    const keyFor = useCallback((p: number) =>
        JSON.stringify({ f: browseServerFilters, s: pageSize, p }),
        [browseServerFilters, pageSize])
    const countKeyFor = useCallback(() =>
        JSON.stringify(browseServerFilters),
        [browseServerFilters])

    // Filters or page size changed → cache invalid; drop it.
    useEffect(() => {
        pageCacheRef.current = {}
        countCacheRef.current = {}
    }, [browseServerFilters, pageSize])

    const fetchPage = useCallback(async (p: number): Promise<Map[] | null> => {
        if (!accessToken) return null
        const offset = (p - 1) * pageSize
        try {
            const maps = await fetchMaps(accessToken, { ...browseServerFilters, limit: pageSize, offset })
            pageCacheRef.current[keyFor(p)] = maps
            return maps
        } catch {
            return null
        }
    }, [accessToken, browseServerFilters, pageSize, keyFor])

    const fetchCount = useCallback(async (): Promise<number | null> => {
        if (!accessToken) return null
        const ck = countKeyFor()
        if (ck in countCacheRef.current) return countCacheRef.current[ck]
        try {
            const count = await fetchMapsCount(accessToken, browseServerFilters)
            countCacheRef.current[ck] = count
            return count
        } catch {
            return null
        }
    }, [accessToken, browseServerFilters, countKeyFor])

    const loadBrowsePage = useCallback(async () => {
        if (!accessToken || mode !== 'browse') return

        const currentKey = keyFor(state.currentPage)
        const cachedPage = pageCacheRef.current[currentKey]
        const cachedCount = countCacheRef.current[countKeyFor()]

        if (cachedPage) {
            onCachesChange(prev => ({
                ...prev,
                pageMaps: cachedPage,
                totalCount: cachedCount ?? prev.totalCount,
            }))
            setPageLoading(false)
            setError(null)

            const totalPagesNow = cachedCount ? Math.max(1, Math.ceil(cachedCount / pageSize)) : Infinity
            if (state.currentPage > 1 && !(keyFor(state.currentPage - 1) in pageCacheRef.current)) {
                fetchPage(state.currentPage - 1)
            }
            if (state.currentPage < totalPagesNow && !(keyFor(state.currentPage + 1) in pageCacheRef.current)) {
                fetchPage(state.currentPage + 1)
            }
            return
        }

        setPageLoading(true)
        try {
            const [maps, count] = await Promise.all([
                fetchPage(state.currentPage),
                fetchCount(),
            ])
            if (maps) {
                onCachesChange(prev => ({
                    ...prev,
                    pageMaps: maps,
                    totalCount: count ?? prev.totalCount,
                }))
                setError(null)

                const totalPagesNow = count ? Math.max(1, Math.ceil(count / pageSize)) : Infinity
                if (state.currentPage > 1 && !(keyFor(state.currentPage - 1) in pageCacheRef.current)) {
                    fetchPage(state.currentPage - 1)
                }
                if (state.currentPage < totalPagesNow && !(keyFor(state.currentPage + 1) in pageCacheRef.current)) {
                    fetchPage(state.currentPage + 1)
                }
            } else {
                setError('Failed to load maps page.')
            }
        } finally {
            setPageLoading(false)
        }
    }, [accessToken, mode, state.currentPage, pageSize, keyFor, countKeyFor, fetchPage, fetchCount, onCachesChange])

    useEffect(() => { loadBrowsePage() }, [loadBrowsePage])

    // --- Search-mode fetch (debounced) ---
    useEffect(() => {
        if (mode !== 'search' || !accessToken) {
            searchAbortRef.current?.abort()
            searchAbortRef.current = null
            setSearchLoading(false)
            return
        }
        const term = state.search.trim()
        setSearchLoading(true)
        const t = setTimeout(async () => {
            searchAbortRef.current?.abort()
            const ac = new AbortController()
            searchAbortRef.current = ac
            try {
                const results = await fetchMapsFuzzy(accessToken, term, undefined, ac.signal)
                if (ac.signal.aborted) return
                setSearchResults(results)
                setSearchLoading(false)
            } catch (e) {
                if ((e as { name?: string })?.name === 'AbortError') return
                setSearchLoading(false)
            }
        }, 200)
        return () => clearTimeout(t)
    }, [mode, state.search, accessToken])

    // --- Loading flag ---
    useEffect(() => {
        setLoading(!caches.metadataLoaded || !caches.reviewsLoaded)
    }, [caches.metadataLoaded, caches.reviewsLoaded])

    // --- Resize → recompute auto page size ---
    useEffect(() => {
        const onResize = () => setAutoPageSize(computePageSize())
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [])

    // --- Scroll restoration ---
    useEffect(() => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = state.scrollTop
        }
        // run once on mount only
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const onScrollContainerScroll = useCallback(() => {
        if (!scrollContainerRef.current) return
        const top = scrollContainerRef.current.scrollTop
        // throttle: only persist when changed by > 24px
        onStateChange(prev => Math.abs(prev.scrollTop - top) > 24 ? { ...prev, scrollTop: top } : prev)
    }, [onStateChange])

    // --- Client-side filter pipeline (used in search & fullload modes) ---
    const applyAllClientFilters = useCallback(<T extends Map | MapMetadata>(rows: T[]): T[] => {
        return rows.filter(m => {
            if (state.authorFilter !== 'all') {
                const a = getAuthorString(m as Map)
                if (a.toLowerCase() !== state.authorFilter.toLowerCase()) return false
            }
            if (state.tagFilter !== 'all') {
                const tags = (m.tags ?? '').toLowerCase()
                if (!tags.split(',').map(t => t.trim()).includes(state.tagFilter.toLowerCase())) return false
            }
            if (state.yearFilter !== 'all') {
                const y = String(new Date(m.added).getFullYear())
                if (y !== state.yearFilter) return false
            }
            if (!isMapInDifficultyTier(m.difficulty, state.difficultyFilter)) return false
            if (state.newOnly && !isNew(m.added)) return false

            const ratings = caches.avgRatings[m.name]
            if (!isInRatingTier(ratingScale100(ratings?.overall), state.ratingFilter)) return false
            if (!isInRatingTier(ratingScale100(ratings?.aesthetics), state.aestheticsFilter)) return false
            if (!isInRatingTier(ratingScale100(ratings?.learning), state.learningFilter)) return false
            if (!isInLuckTier(ratingScale100(ratings?.luck), state.luckFilter)) return false

            const wr = (m as Map).world_record
            if (!isInRecordTimeTier(wr, state.recordTimeFilter)) return false

            if (state.cappedFilter !== 'all') {
                const bestCap = caches.bestCaps[m.name]
                const tier = computeMedalTier(bestCap, m as MapMetadata)
                if (state.cappedFilter === 'capped') {
                    if (!bestCap) return false
                } else if (state.cappedFilter !== tier) {
                    return false
                }
            }

            return true
        })
    }, [
        state.authorFilter, state.tagFilter, state.yearFilter, state.difficultyFilter,
        state.newOnly, state.ratingFilter, state.aestheticsFilter, state.learningFilter,
        state.luckFilter, state.recordTimeFilter, state.cappedFilter,
        caches.avgRatings, caches.bestCaps,
    ])

    const sortRows = useCallback(<T extends Map | MapMetadata>(rows: T[]): T[] => {
        const out = [...rows]
        out.sort((a, b) => {
            // WR sort: missing always pushed to end regardless of direction.
            if (state.sortBy === 'world_record') {
                const aWR = (a as Map).world_record
                const bWR = (b as Map).world_record
                const aEmpty = !(aWR != null && aWR > 0)
                const bEmpty = !(bWR != null && bWR > 0)
                if (aEmpty && bEmpty) return 0
                if (aEmpty) return 1
                if (bEmpty) return -1
                const cmp = (aWR as number) - (bWR as number)
                return state.sortDir === 'asc' ? cmp : -cmp
            }

            // Rating sort: maps with no reviews always pushed to end.
            // Ties on overall broken by aesthetics (higher better), then luck (lower better).
            if (state.sortBy === 'rating') {
                const aRow = caches.avgRatings[a.name]
                const bRow = caches.avgRatings[b.name]
                const aEmpty = aRow == null
                const bEmpty = bRow == null
                if (aEmpty && bEmpty) return 0
                if (aEmpty) return 1
                if (bEmpty) return -1
                let cmp = aRow.overall - bRow.overall
                if (cmp === 0) cmp = aRow.aesthetics - bRow.aesthetics
                if (cmp === 0) cmp = bRow.luck - aRow.luck
                return state.sortDir === 'asc' ? cmp : -cmp
            }

            // My-rating sort: same as rating but uses the current user's own review.
            if (state.sortBy === 'my_rating') {
                const aR = caches.myReviews[a.name]
                const bR = caches.myReviews[b.name]
                const aEmpty = aR == null
                const bEmpty = bR == null
                if (aEmpty && bEmpty) return 0
                if (aEmpty) return 1
                if (bEmpty) return -1
                let cmp = aR.overall - bR.overall
                if (cmp === 0) cmp = aR.aesthetics - bR.aesthetics
                if (cmp === 0) cmp = bR.luck - aR.luck
                return state.sortDir === 'asc' ? cmp : -cmp
            }

            let cmp = 0
            if (state.sortBy === 'name') cmp = a.name.localeCompare(b.name)
            else if (state.sortBy === 'author') {
                const aA = getAuthorString(a as Map).toLowerCase()
                const bA = getAuthorString(b as Map).toLowerCase()
                if (!aA && bA) cmp = 1
                else if (aA && !bA) cmp = -1
                else cmp = aA.localeCompare(bA)
            }
            else if (state.sortBy === 'added') cmp = new Date(a.added).getTime() - new Date(b.added).getTime()
            else if (state.sortBy === 'difficulty') cmp = a.difficulty - b.difficulty
            else if (state.sortBy === 'medal') {
                const aT = computeMedalTier(caches.bestCaps[a.name], a as MapMetadata)
                const bT = computeMedalTier(caches.bestCaps[b.name], b as MapMetadata)
                cmp = TIER_RANK[aT] - TIER_RANK[bT]
            }
            return state.sortDir === 'asc' ? cmp : -cmp
        })
        return out
    }, [state.sortBy, state.sortDir, caches.avgRatings, caches.bestCaps, caches.myReviews])

    // --- Display rows + counts ---
    const { totalForCount, pageItems, totalPages, page } = useMemo(() => {
        let allRows: (Map | MapMetadata)[]
        if (mode === 'browse') {
            const sorted = sortRows(caches.pageMaps)
            return {
                totalForCount: caches.totalCount,
                pageItems: sorted,
                totalPages: Math.max(1, Math.ceil(caches.totalCount / pageSize)),
                page: state.currentPage,
            }
        } else if (mode === 'search') {
            allRows = applyAllClientFilters(searchResults)
        } else {
            allRows = applyAllClientFilters((caches.metadata ?? []) as MapMetadata[])
        }
        const sorted = sortRows(allRows as Map[])
        const total = sorted.length
        const totalPages = Math.max(1, Math.ceil(total / pageSize))
        const page = Math.min(state.currentPage, totalPages)
        return {
            totalForCount: total,
            pageItems: sorted.slice((page - 1) * pageSize, page * pageSize),
            totalPages,
            page,
        }
    }, [mode, caches.pageMaps, caches.totalCount, caches.metadata, searchResults, applyAllClientFilters, sortRows, pageSize, state.currentPage])

    // --- Dropdown options (derived from metadata) ---
    const uniqueAuthors = caches.authors

    const uniqueTags = useMemo(() => {
        if (!caches.metadata) return []
        const set = new Set<string>()
        caches.metadata.forEach(m => {
            m.tags?.split(',').forEach(t => {
                const trimmed = t.trim()
                if (trimmed) set.add(trimmed)
            })
        })
        return [...set].sort((a, b) => a.localeCompare(b))
    }, [caches.metadata])

    const uniqueYears = useMemo(() => {
        if (!caches.metadata) return []
        const set = new Set<number>()
        caches.metadata.forEach(m => set.add(new Date(m.added).getFullYear()))
        return [...set].sort((a, b) => b - a)
    }, [caches.metadata])

    // --- Setters that reset to page 1 ---
    const updateFilter = useCallback(<K extends keyof MapsPageState>(key: K, value: MapsPageState[K]) => {
        onStateChange(prev => ({ ...prev, [key]: value, currentPage: 1 }))
    }, [onStateChange])

    const handleSort = (field: SortField) => {
        onStateChange(prev => {
            if (prev.sortBy === field) {
                return { ...prev, sortDir: prev.sortDir === 'asc' ? 'desc' : 'asc', currentPage: 1 }
            }
            return { ...prev, sortBy: field, sortDir: 'asc', currentPage: 1 }
        })
    }


    const resetFilters = () => {
        onStateChange(prev => ({ ...DEFAULT_MAPS_STATE, filtersPanelOpen: prev.filtersPanelOpen }))
    }

    const captureFilters = (): PresetFilters => ({
        search: state.search,
        authorFilter: state.authorFilter,
        tagFilter: state.tagFilter,
        yearFilter: state.yearFilter,
        difficultyFilter: state.difficultyFilter,
        ratingFilter: state.ratingFilter,
        aestheticsFilter: state.aestheticsFilter,
        learningFilter: state.learningFilter,
        luckFilter: state.luckFilter,
        recordTimeFilter: state.recordTimeFilter,
        cappedFilter: state.cappedFilter,
        newOnly: state.newOnly,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
    })

    const handleSavePreset = () => {
        const name = presetNameInput.trim()
        if (!name) return
        const next = [...presets, { id: newPresetId(), name, filters: captureFilters() }]
        setPresets(next)
        persistPresets(next)
        setSavePresetOpen(false)
        setPresetNameInput('')
    }

    const handleLoadPreset = (p: MapsPreset) => {
        onStateChange(prev => ({
            ...prev,
            ...p.filters,
            currentPage: 1,
            scrollTop: 0,
        }))
    }

    const handleDeletePreset = (id: string) => {
        const next = presets.filter(p => p.id !== id)
        setPresets(next)
        persistPresets(next)
    }

    const confirmDeletePreset = () => {
        if (!presetPendingDelete) return
        handleDeletePreset(presetPendingDelete.id)
        setPresetPendingDelete(null)
    }

    const refresh = () => {
        onCachesChange(() => ({ ...DEFAULT_MAPS_CACHES }))
        // loadCaches will trigger via useEffect when caches reset
        loadCaches(true)
        loadBrowsePage()
    }

    const SortIcon = ({ field }: { field: SortField }) => {
        if (state.sortBy !== field) return <ArrowUpDown className="size-3 opacity-30" />
        return state.sortDir === 'asc'
            ? <ChevronUp className="size-3 text-blue-400" />
            : <ChevronDown className="size-3 text-blue-400" />
    }

    // --- Active filter count for badge ---
    const activeFilterCount = [
        state.authorFilter !== 'all',
        state.tagFilter !== 'all',
        state.yearFilter !== 'all',
        state.difficultyFilter !== 'all',
        state.ratingFilter !== 'all',
        state.aestheticsFilter !== 'all',
        state.learningFilter !== 'all',
        state.luckFilter !== 'all',
        state.recordTimeFilter !== 'all',
        state.cappedFilter !== 'all',
        state.newOnly,
    ].filter(Boolean).length

    const hasActiveFilters = activeFilterCount > 0 || state.search.trim() !== ''

    const showSkeleton =
        (loading && pageItems.length === 0) ||
        (mode === 'search' && searchLoading)

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-white">Maps</h1>
                    {!showSkeleton && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">
                            {totalForCount}
                        </span>
                    )}
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={refresh}
                    disabled={loading || pageLoading}
                    className="text-muted-foreground hover:text-white"
                >
                    <RefreshCw className={cn("size-4", (loading || pageLoading) && "animate-spin")} />
                </Button>
            </div>

            {/* Filters toolbar */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="relative flex-1 min-w-48">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search for a map name..."
                        value={state.search}
                        onChange={e => updateFilter('search', e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-card/50 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50 focus:bg-card/80 transition-colors"
                    />
                </div>

                <button
                    onClick={() => onStateChange(prev => ({ ...prev, filtersPanelOpen: !prev.filtersPanelOpen }))}
                    className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer",
                        state.filtersPanelOpen
                            ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                            : "bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
                    )}
                >
                    <SlidersHorizontal className="size-4" />
                    Filters
                    {activeFilterCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white">
                            {activeFilterCount}
                        </span>
                    )}
                </button>

                <button
                    onClick={() => updateFilter('newOnly', !state.newOnly)}
                    className={cn(
                        "px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer flex items-center gap-2",
                        state.newOnly
                            ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                            : "bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
                    )}
                >
                    New Only
                    {newMapCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white">
                            {newMapCount}
                        </span>
                    )}
                </button>

                <DropdownMenu open={presetsMenuOpen} onOpenChange={setPresetsMenuOpen}>
                    <DropdownMenuTrigger asChild>
                        <button
                            className="px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer flex items-center gap-2 bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
                        >
                            <Bookmark className="size-4" />
                            Presets
                            {presets.length > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-muted-foreground">
                                    {presets.length}
                                </span>
                            )}
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-56 max-w-80">
                        <DropdownMenuLabel>Saved presets</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {presets.length === 0 ? (
                            <div className="px-2 py-2 text-xs text-muted-foreground">
                                No saved presets. Configure filters, then click "Save preset".
                            </div>
                        ) : (
                            presets.map(p => (
                                <DropdownMenuItem
                                    key={p.id}
                                    onSelect={() => handleLoadPreset(p)}
                                    className="flex items-center gap-2 pr-1"
                                >
                                    <span className="flex-1 truncate">{p.name}</span>
                                    <button
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            setPresetsMenuOpen(false)
                                            setPresetPendingDelete(p)
                                        }}
                                        className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-300 transition-colors cursor-pointer"
                                        aria-label={`Delete preset ${p.name}`}
                                    >
                                        <Trash2 className="size-3.5" />
                                    </button>
                                </DropdownMenuItem>
                            ))
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                {hasActiveFilters && (
                    <button
                        onClick={() => {
                            setPresetNameInput('')
                            setSavePresetOpen(true)
                        }}
                        className="px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer flex items-center gap-2 bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
                    >
                        <BookmarkPlus className="size-4" />
                        Save preset
                    </button>
                )}

                {hasActiveFilters && (
                    <button
                        onClick={resetFilters}
                        className="px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer flex items-center gap-2 bg-card/50 border-white/10 text-muted-foreground hover:text-red-300 hover:border-red-500/30"
                    >
                        <X className="size-4" />
                        Clear filters
                    </button>
                )}
            </div>

            {/* Inline filter panel */}
            {state.filtersPanelOpen && (
                <div className="bg-card/30 border border-white/10 rounded-xl p-4 space-y-4 shrink-0">
                    <FilterPanelRow label="Map Attributes">
                        <FilterSelect
                            label="Difficulty"
                            value={state.difficultyFilter}
                            onChange={v => updateFilter('difficultyFilter', v as DifficultyTier)}
                            options={[
                                ['all', 'All'],
                                ['beginner', 'Beginner (1–3)'],
                                ['intermediate', 'Intermediate (4–6)'],
                                ['advanced', 'Advanced (7–8)'],
                                ['expert', 'Expert (9–10)'],
                            ]}
                        />
                        <FilterSelect
                            label="Author"
                            value={state.authorFilter}
                            onChange={v => updateFilter('authorFilter', v)}
                            options={[['all', 'Any'], ...uniqueAuthors.map(a => [a, a] as [string, string])]}
                        />
                        <FilterSelect
                            label="Tag"
                            value={state.tagFilter}
                            onChange={v => updateFilter('tagFilter', v)}
                            options={[['all', 'Any'], ...uniqueTags.map(t => [t, t] as [string, string])]}
                        />
                        <FilterSelect
                            label="Year"
                            value={state.yearFilter}
                            onChange={v => updateFilter('yearFilter', v)}
                            options={[['all', 'Any'], ...uniqueYears.map(y => [String(y), String(y)] as [string, string])]}
                        />
                    </FilterPanelRow>

                    <FilterPanelRow label="Map Ratings">
                        <FilterSelect
                            label="Overall"
                            value={state.ratingFilter}
                            onChange={v => updateFilter('ratingFilter', v as RatingTier)}
                            options={ratingTierOptions}
                        />
                        <FilterSelect
                            label="Aesthetics"
                            value={state.aestheticsFilter}
                            onChange={v => updateFilter('aestheticsFilter', v as RatingTier)}
                            options={ratingTierOptions}
                        />
                        <FilterSelect
                            label="Learning"
                            value={state.learningFilter}
                            onChange={v => updateFilter('learningFilter', v as RatingTier)}
                            options={ratingTierOptions}
                        />
                        <FilterSelect
                            label="Luck"
                            value={state.luckFilter}
                            onChange={v => updateFilter('luckFilter', v as LuckTier)}
                            options={luckTierOptions}
                        />
                    </FilterPanelRow>

                    <FilterPanelRow label="Miscellaneous">
                        <FilterSelect
                            label="World Record Time"
                            value={state.recordTimeFilter}
                            onChange={v => updateFilter('recordTimeFilter', v as RecordTimeTier)}
                            options={recordTimeOptions}
                        />
                        <FilterSelect
                            label="Cap Status"
                            value={state.cappedFilter}
                            onChange={v => updateFilter('cappedFilter', v as CappedFilter)}
                            options={cappedOptions}
                        />
                    </FilterPanelRow>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm shrink-0">
                    <span>{error}</span>
                    <Button variant="ghost" size="sm" onClick={refresh} className="text-red-400 hover:text-red-300">
                        <RefreshCw className="size-4 mr-1" /> Retry
                    </Button>
                </div>
            )}

            {/* Table */}
            <div
                ref={scrollContainerRef}
                onScroll={onScrollContainerScroll}
                className="flex-1 min-h-0 bg-card/30 border border-white/5 rounded-xl overflow-auto"
            >
                <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                        <tr className="border-b border-white/10">
                            <th className="px-4 py-3 text-left w-20 text-muted-foreground font-medium text-xs uppercase tracking-wider"></th>
                            <th className="px-2 py-3 text-center w-10 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                <button
                                    onClick={() => handleSort('medal')}
                                    title="Sort by Medal"
                                    className="inline-flex items-center justify-center hover:text-white transition-colors cursor-pointer"
                                >
                                    <SortIcon field="medal" />
                                </button>
                            </th>
                            <th className="px-4 py-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                <button onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                                    Map <SortIcon field="name" />
                                </button>
                            </th>
                            <th className="px-4 py-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                <button onClick={() => handleSort('author')} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                                    Author <SortIcon field="author" />
                                </button>
                            </th>
                            <th className="px-4 py-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                <button onClick={() => handleSort('difficulty')} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                                    Difficulty <SortIcon field="difficulty" />
                                </button>
                            </th>
                            <th className="px-4 py-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                <button onClick={() => handleSort('world_record')} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                                    World Record <SortIcon field="world_record" />
                                </button>
                            </th>
                            <th className="px-4 py-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">Tags</th>
                            <th className="px-4 py-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                <button onClick={() => handleSort('rating')} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                                    Community Rating <SortIcon field="rating" />
                                </button>
                            </th>
                            <th className="px-4 py-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                                <button onClick={() => handleSort('my_rating')} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                                    Your Rating <SortIcon field="my_rating" />
                                </button>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {showSkeleton ? (
                            Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} />)
                        ) : pageItems.length === 0 ? (
                            <tr>
                                <td colSpan={9} className="px-4 py-16 text-center text-muted-foreground">
                                    No maps match your filters.
                                </td>
                            </tr>
                        ) : (
                            pageItems.map(map => {
                                const author = getAuthorString(map as Map) || '—'
                                const tags = map.tags ? map.tags.split(',').map(t => t.trim()).filter(Boolean) : []
                                const ratings = caches.avgRatings[map.name]
                                const myReview = caches.myReviews[map.name]
                                const mapNew = isNew(map.added)
                                const wr = (map as Map).world_record
                                const bestCap = caches.bestCaps[map.name]
                                const medalTier = computeMedalTier(bestCap, map as MapMetadata)

                                return (
                                    <tr
                                        key={map.name}
                                        onClick={() => onMapSelect(map.name)}
                                        className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group"
                                    >
                                        <td className="px-4 py-3">
                                            <MapThumbnail mapName={map.name} />
                                        </td>
                                        <td className="px-2 py-3 text-center">
                                            <div className="inline-flex justify-center">
                                                <MedalIndicator tier={medalTier} bestCap={bestCap} />
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className="font-medium text-white group-hover:text-blue-300 transition-colors">
                                                    {map.name}
                                                </span>
                                                {mapNew && (
                                                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                                                        New
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-muted-foreground">
                                            <PlayerInfo alias={author || '—'} size="sm" />
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-2">
                                                <span className={cn("text-sm font-bold w-4 text-center", difficultyTextColor(map.difficulty))}>
                                                    {map.difficulty}
                                                </span>
                                                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className={cn("h-full rounded-full", difficultyColor(map.difficulty))}
                                                        style={{ width: `${(map.difficulty / 10) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 font-mono text-sm text-muted-foreground">
                                            {wr != null && wr > 0
                                                ? <span className="text-amber-300">{formatCapTime(wr)}</span>
                                                : <span className="opacity-30">—</span>
                                            }
                                        </td>
                                        <td className="px-4 py-3">
                                            {tags.length > 0 ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {tags.slice(0, 3).map(tag => (
                                                        <span
                                                            key={tag}
                                                            className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-muted-foreground"
                                                        >
                                                            {tag}
                                                        </span>
                                                    ))}
                                                    {tags.length > 3 && (
                                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-muted-foreground">
                                                            +{tags.length - 3}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="opacity-30 text-muted-foreground">—</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={e => { e.stopPropagation(); setReviewsModalMap(map.name) }}
                                                title="View reviews"
                                                className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                                            >
                                                {ratings ? (
                                                    <>
                                                        <span className={cn("text-sm font-bold w-4 text-center", ratingTextColor(ratings.overall))}>
                                                            {ratings.overall}
                                                        </span>
                                                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                            <div
                                                                className={cn("h-full rounded-full", ratingColor(ratings.overall))}
                                                                style={{ width: `${(ratings.overall / 10) * 100}%` }}
                                                            />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="opacity-50 text-muted-foreground text-xs underline-offset-2 hover:underline">
                                                        No reviews — add one
                                                    </span>
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={e => { e.stopPropagation(); setReviewsModalMap(map.name) }}
                                                title={myReview ? 'Update your review' : 'Add your review'}
                                                className="flex items-center gap-2 hover:opacity-80 transition-opacity cursor-pointer"
                                            >
                                                {myReview ? (
                                                    <>
                                                        <span className={cn("text-sm font-bold w-4 text-center", ratingTextColor(myReview.overall))}>
                                                            {myReview.overall}
                                                        </span>
                                                        <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                            <div
                                                                className={cn("h-full rounded-full", ratingColor(myReview.overall))}
                                                                style={{ width: `${(myReview.overall / 10) * 100}%` }}
                                                            />
                                                        </div>
                                                    </>
                                                ) : (
                                                    <span className="opacity-50 text-muted-foreground text-xs underline-offset-2 hover:underline">
                                                        Rate this map
                                                    </span>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {!showSkeleton && totalForCount > 0 && (
                <PaginationBar
                    page={page}
                    totalPages={totalPages}
                    pageSize={pageSize}
                    totalForCount={totalForCount}
                    mode={mode}
                    pageSizePreference={state.pageSizePreference}
                    autoPageSize={autoPageSize}
                    onPageChange={p => onStateChange(prev => ({ ...prev, currentPage: p }))}
                    onPageSizeChange={pref => onStateChange(prev => ({ ...prev, pageSizePreference: pref, currentPage: 1 }))}
                />
            )}

            <MapReviewsModal
                open={reviewsModalMap !== null}
                onClose={() => setReviewsModalMap(null)}
                accessToken={accessToken}
                userId={userId}
                mapName={reviewsModalMap}
                onReviewSubmitted={async () => {
                    if (!accessToken) return
                    try {
                        const reviewsData = await fetchAllMapReviews(accessToken)
                        onCachesChange(prev => ({
                            ...prev,
                            avgRatings: aggregateReviews(reviewsData),
                            myReviews: indexMyReviews(reviewsData, userId),
                        }))
                    } catch {}
                }}
            />

            <Modal
                isOpen={savePresetOpen}
                onClose={() => setSavePresetOpen(false)}
                title="Save filter preset"
                className="w-[95%] sm:w-[480px] max-w-md"
                offsetSidebar
                footer={
                    <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2 shrink-0">
                        <Button variant="ghost" onClick={() => setSavePresetOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleSavePreset} disabled={!presetNameInput.trim()}>
                            Save preset
                        </Button>
                    </div>
                }
            >
                <div className="space-y-3">
                    <label className="text-sm font-medium text-white">Preset name</label>
                    <input
                        autoFocus
                        type="text"
                        value={presetNameInput}
                        onChange={e => setPresetNameInput(e.target.value)}
                        onKeyDown={e => {
                            if (e.key === 'Enter' && presetNameInput.trim()) {
                                e.preventDefault()
                                handleSavePreset()
                            }
                        }}
                        placeholder="e.g. Easy maps from 2024"
                        className="w-full px-3 py-2 bg-card/50 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50"
                    />
                    <p className="text-xs text-muted-foreground">
                        Saves current search, filters, and sort. Loadable from the Presets menu.
                    </p>
                </div>
            </Modal>

            <Modal
                isOpen={presetPendingDelete !== null}
                onClose={() => setPresetPendingDelete(null)}
                title="Delete preset?"
                className="w-[95%] sm:w-[420px] max-w-md"
                offsetSidebar
                footer={
                    <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2 shrink-0">
                        <Button variant="ghost" onClick={() => setPresetPendingDelete(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDeletePreset}>
                            Delete
                        </Button>
                    </div>
                }
            >
                <p className="text-sm text-muted-foreground">
                    Delete preset{' '}
                    <span className="font-semibold text-white">"{presetPendingDelete?.name}"</span>?
                    This cannot be undone.
                </p>
            </Modal>
        </div>
    )
}

const PAGE_SIZE_OPTIONS: (number | 'auto')[] = ['auto', 10, 25, 50, 100, 200]

function buildPageList(current: number, total: number): (number | 'ellipsis')[] {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1)
    }
    const pages: (number | 'ellipsis')[] = [1]
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    if (start > 2) pages.push('ellipsis')
    for (let i = start; i <= end; i++) pages.push(i)
    if (end < total - 1) pages.push('ellipsis')
    pages.push(total)
    return pages
}

function PaginationBar({
    page, totalPages, pageSize, totalForCount, mode,
    pageSizePreference, autoPageSize,
    onPageChange, onPageSizeChange,
}: {
    page: number
    totalPages: number
    pageSize: number
    totalForCount: number
    mode: 'browse' | 'search' | 'fullload'
    pageSizePreference: number | 'auto'
    autoPageSize: number
    onPageChange: (p: number) => void
    onPageSizeChange: (pref: number | 'auto') => void
}) {
    const [jumpInput, setJumpInput] = useState('')
    const pageList = buildPageList(page, totalPages)

    const handleJump = () => {
        const n = parseInt(jumpInput, 10)
        if (!isNaN(n) && n >= 1 && n <= totalPages) {
            onPageChange(n)
            setJumpInput('')
        }
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground shrink-0">
            <div className="flex items-center gap-3">
                <span>
                    Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalForCount)} of {totalForCount}
                    {mode !== 'browse' && <span className="ml-2 opacity-50">({mode === 'search' ? 'search' : 'filtered'})</span>}
                </span>
                <div className="flex items-center gap-2">
                    <label className="text-xs uppercase tracking-wider">Per page</label>
                    <select
                        value={String(pageSizePreference)}
                        onChange={e => {
                            const v = e.target.value
                            onPageSizeChange(v === 'auto' ? 'auto' : parseInt(v, 10))
                        }}
                        style={{ colorScheme: 'dark' }}
                        className="px-2 py-1 bg-card/50 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
                    >
                        {PAGE_SIZE_OPTIONS.map(opt => (
                            <option key={String(opt)} value={String(opt)} className="bg-[#0f1115] text-white">
                                {opt === 'auto' ? `Auto (${autoPageSize})` : opt}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPageChange(1)}
                        disabled={page <= 1}
                        title="First page"
                        className="text-muted-foreground hover:text-white px-2"
                    >
                        «
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPageChange(Math.max(1, page - 1))}
                        disabled={page <= 1}
                        className="text-muted-foreground hover:text-white px-2"
                    >
                        ‹ Prev
                    </Button>

                    <div className="flex items-center gap-1">
                        {pageList.map((p, i) =>
                            p === 'ellipsis' ? (
                                <span key={`e${i}`} className="px-1 text-muted-foreground/50 select-none">…</span>
                            ) : (
                                <button
                                    key={p}
                                    onClick={() => onPageChange(p)}
                                    className={cn(
                                        "min-w-7 h-7 px-2 rounded border text-xs transition-colors cursor-pointer",
                                        p === page
                                            ? "bg-blue-500/20 border-blue-500/50 text-blue-200 font-bold"
                                            : "bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
                                    )}
                                >
                                    {p}
                                </button>
                            )
                        )}
                    </div>

                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
                        disabled={page >= totalPages}
                        className="text-muted-foreground hover:text-white px-2"
                    >
                        Next ›
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onPageChange(totalPages)}
                        disabled={page >= totalPages}
                        title="Last page"
                        className="text-muted-foreground hover:text-white px-2"
                    >
                        »
                    </Button>

                    <div className="flex items-center gap-1 ml-2">
                        <input
                            type="number"
                            min={1}
                            max={totalPages}
                            value={jumpInput}
                            onChange={e => setJumpInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleJump() }}
                            placeholder="Go to"
                            className="w-16 px-2 py-1 bg-card/50 border border-white/10 rounded text-xs text-white placeholder:text-muted-foreground/50 focus:outline-none focus:border-blue-500/50"
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleJump}
                            disabled={!jumpInput}
                            className="text-muted-foreground hover:text-white px-2"
                        >
                            Go
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}

const ratingTierOptions: [string, string][] = [
    ['all', 'Any'],
    ['excellent', 'Excellent (8.0+)'],
    ['good', 'Good (6.0–7.9)'],
    ['average', 'Average (4.0–5.9)'],
    ['poor', 'Poor (0–3.9)'],
]

const luckTierOptions: [string, string][] = [
    ['all', 'Any'],
    ['low', 'Low (0–3.9)'],
    ['fair', 'Medium (4.0–5.9)'],
    ['some', 'High (6.0–7.9)'],
    ['high', 'Extreme (8.0+)'],
]

const recordTimeOptions: [string, string][] = (Object.keys(RECORD_TIME_LABELS) as RecordTimeTier[])
    .map(k => [k, RECORD_TIME_LABELS[k]])

const cappedOptions: [string, string][] = [
    ['all', 'All Maps'],
    ['uncapped', 'Uncapped Maps'],
    ['capped', 'Capped Maps (any)'],
    ['verified', 'Verified Caps'],
    ['casual', 'Casual Caps'],
    ['bronze', 'Bronze'],
    ['silver', 'Silver'],
    ['gold', 'Gold'],
    ['champion', 'Champion'],
]

function FilterPanelRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">{label}</div>
            <div className="flex flex-wrap items-end gap-3">{children}</div>
        </div>
    )
}

function FilterSelect({
    label, value, onChange, options,
}: {
    label: string
    value: string
    onChange: (v: string) => void
    options: [string, string][]
}) {
    return (
        <div className="flex flex-col gap-1 min-w-40">
            <label className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</label>
            <select
                value={value}
                onChange={e => onChange(e.target.value)}
                style={{ colorScheme: 'dark' }}
                className="px-3 py-2 bg-card/50 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
            >
                {options.map(([val, lbl]) => (
                    <option key={val} value={val} className="bg-[#0f1115] text-white">
                        {lbl}
                    </option>
                ))}
            </select>
        </div>
    )
}
