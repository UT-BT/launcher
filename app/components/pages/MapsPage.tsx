import { useState, useEffect, useMemo, useRef, useCallback, Fragment } from 'react'
import { Search, RefreshCw, ChevronUp, ChevronDown, ArrowUpDown, SlidersHorizontal, X, Bookmark, BookmarkPlus, Trash2, Columns3, ArrowLeft, GripVertical, HelpCircle, Share2, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
    DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from '@/app/components/ui/dropdown-menu'
import { Modal } from '@/app/components/ui/modal'
import { Tooltip } from '@/app/components/ui/tooltip'
import {
    UserProfile, Map, MapMetadata, MapReview, BestCap,
    fetchMaps, fetchMapsCount, fetchMapsMetadata, fetchMapsFuzzy, fetchAllMapReviews, fetchMapAuthors,
    fetchBestCaps, fetchWorldRecordsForMaps, fetchDemoStatus, getFirstPersonVideoUrl,
} from '@/app/utils/api'

import { MapReviewsModal } from '@/app/components/modals/MapReviewsModal'
import { ReplayPickerModal } from '@/app/components/modals/ReplayPickerModal'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { MapsTutorial } from '@/app/components/pages/maps/MapsTutorial'
import { useMapsTutorialState } from '@/app/components/pages/maps/useMapsTutorialState'
import { buildSteps } from '@/app/components/pages/maps/mapsTutorialSteps'
import { PaginationBar } from '@/app/components/ui/pagination'
import { MultiFilterDropdown } from '@/app/components/ui/multi-filter-dropdown'
import { FilterPanelRow } from '@/app/components/ui/filter-panel-row'
import { formatCapTime, formatDelta, formatAddedDate, isNew } from '@/app/utils/format'
import { difficultyTextColor, difficultyBgColor, scoreTextColor, scoreBgColor } from '@/app/utils/scoreColors'

import championIcon from '@/app/assets/champion.png'
import goldIcon from '@/app/assets/gold.png'
import silverIcon from '@/app/assets/silver.png'
import bronzeIcon from '@/app/assets/bronze.png'
import certifiedIcon from '@/app/assets/certified.png'
import casualIcon from '@/app/assets/casual.png'
import worldRecordIcon from '@/app/assets/world_record.png'

export type RatingTier = 'all' | 'excellent' | 'good' | 'average' | 'poor'
export type LuckTier = 'all' | 'low' | 'fair' | 'some' | 'high'
export type RecordTimeTier = 'all' | 'sub15' | 'sub30' | 'sub45' | 'sub60' | 'sub90' | 'sub120' | 'sub180' | 'sub300' | 'over300'
export type DifficultyTier = 'all' | 'beginner' | 'intermediate' | 'advanced' | 'expert'
export type CappedFilter =
    | 'all' | 'uncapped' | 'capped' | 'verified' | 'casual'
    | 'bronze' | 'silver' | 'gold' | 'champion' | 'world_record'

export type RatedTier = 'all' | 'rated' | 'unrated'

export type CappedFilterValue = Exclude<CappedFilter, 'all'>
export type DifficultyValue = Exclude<DifficultyTier, 'all'>
export type RatingValue = Exclude<RatingTier, 'all'>
export type LuckValue = Exclude<LuckTier, 'all'>
export type RecordTimeValue = Exclude<RecordTimeTier, 'all'>
export type RatedValue = Exclude<RatedTier, 'all'>
export type SortField = 'name' | 'author' | 'added' | 'difficulty' | 'world_record' | 'pb' | 'rating' | 'my_rating' | 'medal'
export type SortDir = 'asc' | 'desc'

export interface AvgRatings {
    overall: number
    aesthetics: number
    learning: number
    luck: number
}

export interface MapsPageState {
    search: string
    authorFilters: string[]
    tagFilters: string[]
    yearFilters: string[]
    difficultyFilters: DifficultyValue[]
    ratingFilters: RatingValue[]
    aestheticsFilters: RatingValue[]
    learningFilters: RatingValue[]
    luckFilters: LuckValue[]
    recordTimeFilters: RecordTimeValue[]
    cappedFilters: CappedFilterValue[]
    ratedFilters: RatedValue[]
    newOnly: boolean
    favoritesOnly: boolean
    sortBy: SortField
    sortDir: SortDir
    currentPage: number
    pageSizePreference: number | 'auto'
    filtersPanelOpen: boolean
    scrollTop: number
}

export interface WRHolder {
    user_id: string
    alias: string
    cap_id?: string
    color_r?: number
    color_g?: number
    color_b?: number
}

export interface MapsPageCaches {
    metadata: MapMetadata[] | null
    avgRatings: Record<string, AvgRatings>
    myReviews: Record<string, MapReview>
    authors: string[]
    bestCaps: Record<string, BestCap>
    wrHolders: Record<string, WRHolder>
    wrHoldersFetched: string[]
    pageMaps: Map[]
    totalCount: number
    metadataLoaded: boolean
    reviewsLoaded: boolean
    authorsLoaded: boolean
    bestCapsLoaded: boolean
}

export const DEFAULT_MAPS_STATE: MapsPageState = {
    search: '',
    authorFilters: [],
    tagFilters: [],
    yearFilters: [],
    difficultyFilters: [],
    ratingFilters: [],
    aestheticsFilters: [],
    learningFilters: [],
    luckFilters: [],
    recordTimeFilters: [],
    cappedFilters: [],
    ratedFilters: [],
    newOnly: false,
    favoritesOnly: false,
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
    wrHolders: {},
    wrHoldersFetched: [],
    pageMaps: [],
    totalCount: 0,
    metadataLoaded: false,
    reviewsLoaded: false,
    authorsLoaded: false,
    bestCapsLoaded: false,
}

const PRESETS_KEY = 'utbt:mapsPresets:v1'
const COLUMNS_KEY = 'utbt:mapsColumns:v1'

export type ColumnId =
    | 'thumbnail' | 'name' | 'tags' | 'medal' | 'author' | 'difficulty' | 'added'
    | 'world_record' | 'pb' | 'replay' | 'community_rating' | 'my_rating'

const COLUMN_LABELS: Record<ColumnId, string> = {
    thumbnail: 'Thumbnail',
    name: 'Map',
    tags: 'Tags',
    medal: 'Medal Earned',
    author: 'Author',
    difficulty: 'Difficulty',
    added: 'Added',
    world_record: 'World Record',
    pb: 'Personal Best',
    replay: 'Demos',
    community_rating: 'Community Review',
    my_rating: 'Your Review',
}

const DEFAULT_COLUMN_ORDER: ColumnId[] = [
    'thumbnail', 'name', 'tags', 'author', 'difficulty', 'added',
    'world_record', 'medal', 'pb', 'replay',
    'community_rating', 'my_rating',
]

const NON_TABLE_COLUMNS: ReadonlySet<ColumnId> = new Set(['tags'])
const REQUIRED_COLUMNS: ReadonlySet<ColumnId> = new Set(['name'])

const DEFAULT_COLUMN_VISIBILITY: Record<ColumnId, boolean> = {
    thumbnail: true,
    name: true,
    tags: true,
    medal: true,
    author: true,
    difficulty: true,
    added: true,
    world_record: true,
    pb: true,
    replay: true,
    community_rating: true,
    my_rating: true,
}

const loadColumnVisibility = (): Record<ColumnId, boolean> => {
    try {
        const raw = localStorage.getItem(COLUMNS_KEY)
        if (!raw) return { ...DEFAULT_COLUMN_VISIBILITY }
        const parsed = JSON.parse(raw)
        if (!parsed || typeof parsed !== 'object') return { ...DEFAULT_COLUMN_VISIBILITY }
        return { ...DEFAULT_COLUMN_VISIBILITY, ...parsed }
    } catch {
        return { ...DEFAULT_COLUMN_VISIBILITY }
    }
}

const persistColumnVisibility = (cols: Record<ColumnId, boolean>): void => {
    try { localStorage.setItem(COLUMNS_KEY, JSON.stringify(cols)) } catch { /* ignore */ }
}

const COLUMN_ORDER_KEY = 'utbt:mapsColumnOrder:v1'

const loadColumnOrder = (): ColumnId[] => {
    try {
        const raw = localStorage.getItem(COLUMN_ORDER_KEY)
        if (!raw) return [...DEFAULT_COLUMN_ORDER]
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return [...DEFAULT_COLUMN_ORDER]
        const valid = new Set<ColumnId>(DEFAULT_COLUMN_ORDER)
        const seen = new Set<ColumnId>()
        const out: ColumnId[] = []
        for (const id of parsed) {
            if (valid.has(id) && !seen.has(id)) {
                out.push(id)
                seen.add(id)
            }
        }
        for (const id of DEFAULT_COLUMN_ORDER) {
            if (!seen.has(id)) out.push(id)
        }
        return out
    } catch {
        return [...DEFAULT_COLUMN_ORDER]
    }
}

const persistColumnOrder = (order: ColumnId[]): void => {
    try { localStorage.setItem(COLUMN_ORDER_KEY, JSON.stringify(order)) } catch { /* ignore */ }
}

const normalizeColumnOrder = (order: ColumnId[]): ColumnId[] => {
    let next = [...order]
    // tags always immediately after name
    const nameIdx = next.indexOf('name')
    const tagsIdx = next.indexOf('tags')
    if (nameIdx !== -1 && tagsIdx !== -1 && tagsIdx !== nameIdx + 1) {
        next = next.filter(id => id !== 'tags')
        const i = next.indexOf('name')
        next.splice(i + 1, 0, 'tags')
    }
    // medal always immediately before pb
    const pbIdx = next.indexOf('pb')
    const medalIdx = next.indexOf('medal')
    if (pbIdx !== -1 && medalIdx !== -1 && medalIdx !== pbIdx - 1) {
        next = next.filter(id => id !== 'medal')
        const i = next.indexOf('pb')
        next.splice(i, 0, 'medal')
    }
    return next
}

export type PresetFilters = Pick<MapsPageState,
    'search' | 'authorFilters' | 'tagFilters' | 'yearFilters' |
    'difficultyFilters' | 'ratingFilters' | 'aestheticsFilters' | 'learningFilters' |
    'luckFilters' | 'recordTimeFilters' | 'cappedFilters' | 'ratedFilters' | 'newOnly' | 'favoritesOnly' |
    'sortBy' | 'sortDir'>

export interface MapsPreset {
    id: string
    name: string
    filters: PresetFilters
}

const SINGLE_TO_MULTI_PRESET_KEYS: Array<[string, string]> = [
    ['authorFilter', 'authorFilters'],
    ['tagFilter', 'tagFilters'],
    ['yearFilter', 'yearFilters'],
    ['difficultyFilter', 'difficultyFilters'],
    ['ratingFilter', 'ratingFilters'],
    ['aestheticsFilter', 'aestheticsFilters'],
    ['learningFilter', 'learningFilters'],
    ['luckFilter', 'luckFilters'],
    ['recordTimeFilter', 'recordTimeFilters'],
    ['cappedFilter', 'cappedFilters'],
]

const loadPresets = (): MapsPreset[] => {
    try {
        const raw = localStorage.getItem(PRESETS_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed.map((p: any) => {
            if (p?.filters) {
                for (const [oldKey, newKey] of SINGLE_TO_MULTI_PRESET_KEYS) {
                    if (oldKey in p.filters && !(newKey in p.filters)) {
                        const v = p.filters[oldKey]
                        p.filters[newKey] = v && v !== 'all' ? [v] : []
                        delete p.filters[oldKey]
                    }
                }
            }
            return p as MapsPreset
        })
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
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
}


export type MedalTier = 'uncapped' | 'casual' | 'verified' | 'bronze' | 'silver' | 'gold' | 'champion' | 'world_record'

export const TIER_ICONS: Record<Exclude<MedalTier, 'uncapped'>, string> = {
    casual: casualIcon,
    verified: certifiedIcon,
    bronze: bronzeIcon,
    silver: silverIcon,
    gold: goldIcon,
    champion: championIcon,
    world_record: worldRecordIcon,
}

export const TIER_LABELS: Record<MedalTier, string> = {
    uncapped: 'Uncapped',
    casual: 'Casual',
    verified: 'Verified',
    bronze: 'Bronze',
    silver: 'Silver',
    gold: 'Gold',
    champion: 'Champion',
    world_record: 'World Record',
}

const TIER_RANK: Record<MedalTier, number> = {
    uncapped: 0,
    casual: 1,
    verified: 2,
    bronze: 3,
    silver: 4,
    gold: 5,
    champion: 6,
    world_record: 7,
}

// Epsilon for matching a PB against a world record. Cap times are reported in
// seconds with sub-millisecond noise from server round-trips, so an exact ===
// comparison would never trigger the world_record tier.
const WR_TIME_EPSILON_SECONDS = 0.0005

export function computeMedalTier(
    bestCap: BestCap | undefined,
    map: (Pick<MapMetadata, 'bronze_medal' | 'silver_medal' | 'gold_medal' | 'champion_medal'> & { world_record?: number }) | undefined,
): MedalTier {
    if (!bestCap) return 'uncapped'
    if (bestCap.cap_type !== 2) return 'casual'
    if (!map) return 'verified'
    const t = bestCap.cap_time_seconds
    if (map.world_record != null && map.world_record > 0 && t - map.world_record <= WR_TIME_EPSILON_SECONDS) return 'world_record'
    if (map.champion_medal != null && t <= map.champion_medal) return 'champion'
    if (map.gold_medal != null && t <= map.gold_medal) return 'gold'
    if (map.silver_medal != null && t <= map.silver_medal) return 'silver'
    if (map.bronze_medal != null && t <= map.bronze_medal) return 'bronze'
    return 'verified'
}

// Mock data shown in the first row while the tutorial is active so the PB,
// World Record, ratings, and review cells always demo something visible.
function getTutorialMockRow(mapName: string): {
    ratings: AvgRatings
    review: MapReview
    bestCap: BestCap
    wrHolder: WRHolder
    wr: number
} {
    return {
        ratings: { overall: 9, aesthetics: 8, learning: 7, luck: 4 },
        review: {
            id: 0, map_name: mapName, user: 0,
            aesthetics: 8, learning: 7, luck: 4, difficulty: 5, overall: 8,
        },
        bestCap: {
            map: mapName, cap_id: 'tutorial-mock-pb',
            cap_time_seconds: 48.234, cap_type: 2, verified: true,
        },
        wrHolder: {
            user_id: '0', alias: 'TopPlayer', cap_id: 'tutorial-mock-wr',
            color_r: 100, color_g: 200, color_b: 255,
        },
        wr: 42.567,
    }
}

// Deterministic hue per tag string. Same name → same color forever.
// djb2 hash → mod 360 → HSL with controlled saturation/lightness so every
// tag reads well on the dark table background.
function tagColorStyle(tag: string): React.CSSProperties {
    let hash = 5381
    const s = tag.toLowerCase()
    for (let i = 0; i < s.length; i++) {
        hash = ((hash << 5) + hash) ^ s.charCodeAt(i)
    }
    const hue = Math.abs(hash) % 360
    return {
        color: `hsl(${hue}, 75%, 78%)`,
        backgroundColor: `hsla(${hue}, 65%, 50%, 0.14)`,
        borderColor: `hsla(${hue}, 60%, 55%, 0.35)`,
    }
}

const pbTextColor = (tier: MedalTier, isWR: boolean): string => {
    if (isWR || tier === 'world_record') return 'text-blue-400'
    switch (tier) {
        case 'champion': return 'text-red-400'
        case 'gold': return 'text-yellow-400'
        case 'silver': return 'text-slate-300'
        case 'bronze': return 'text-amber-600'
        case 'verified': return 'text-zinc-400'
        case 'casual': return 'text-zinc-300'
        default: return 'text-emerald-300'
    }
}

const MedalIndicator = ({ tier, bestCap }: { tier: MedalTier; bestCap?: BestCap }) => {
    const tip = bestCap
        ? `${TIER_LABELS[tier]}`
        : 'Not capped yet'
    if (tier === 'uncapped') {
        return <span aria-hidden className="inline-block size-5 shrink-0" />
    }
    return (
        <Tooltip content={tip} side="top">
            <img
                src={TIER_ICONS[tier]}
                alt={TIER_LABELS[tier]}
                className="size-5 shrink-0 object-contain"
            />
        </Tooltip>
    )
}

const SKELETON_CELL: Partial<Record<ColumnId, React.ReactNode>> = {
    thumbnail: <td className="px-4 py-3"><div className="w-12 h-12 rounded bg-white/5 animate-pulse" /></td>,
    name: <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-white/5 animate-pulse" /></td>,
    author: <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-white/5 animate-pulse" /></td>,
    difficulty: <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-white/5 animate-pulse" /></td>,
    added: <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-white/5 animate-pulse" /></td>,
    world_record: <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-white/5 animate-pulse" /></td>,
    medal: <td className="px-2 py-3 text-center"><div className="inline-block size-5 rounded-full bg-white/5 animate-pulse" /></td>,
    pb: <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-white/5 animate-pulse" /></td>,
    replay: <td className="px-2 py-3 text-center"><div className="inline-block w-16 h-6 rounded-md bg-white/5 animate-pulse" /></td>,
    community_rating: <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-white/5 animate-pulse" /></td>,
    my_rating: <td className="px-4 py-3"><div className="h-4 w-16 rounded bg-white/5 animate-pulse" /></td>,
}

const SkeletonRow = ({ order, visibility }: { order: ColumnId[]; visibility: Record<ColumnId, boolean> }) => (
    <tr className="border-b border-white/5">
        {order.map(id => {
            if (NON_TABLE_COLUMNS.has(id)) return null
            if (!REQUIRED_COLUMNS.has(id) && !visibility[id]) return null
            const cell = SKELETON_CELL[id]
            if (!cell) return null
            return <Fragment key={id}>{cell}</Fragment>
        })}
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

// Approximate table-row height in px; matches the py-3 padding + 56px image.
const TABLE_ROW_HEIGHT_PX = 56
// Approximate chrome around the table (header + filters + pagination).
const TABLE_CHROME_PX = 320
const AUTO_PAGE_SIZE_MIN_ROWS = 10
const AUTO_PAGE_SIZE_MAX_ROWS = 60

function computePageSize(): number {
    if (typeof window === 'undefined') return 25
    const usable = Math.max(window.innerHeight - TABLE_CHROME_PX, TABLE_ROW_HEIGHT_PX * AUTO_PAGE_SIZE_MIN_ROWS)
    const rows = Math.floor(usable / TABLE_ROW_HEIGHT_PX)
    return Math.min(AUTO_PAGE_SIZE_MAX_ROWS, Math.max(AUTO_PAGE_SIZE_MIN_ROWS, rows))
}

const SKELETON_ROW_COUNT = 10
const SEARCH_DEBOUNCE_MS = 200

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
    favoriteMapNames, onToggleFavorite,
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
    const presetNameInputRef = useRef<HTMLInputElement | null>(null)
    const [presetPendingDelete, setPresetPendingDelete] = useState<MapsPreset | null>(null)
    const [presetsMenuOpen, setPresetsMenuOpen] = useState(false)
    const [columnVisibility, setColumnVisibility] = useState<Record<ColumnId, boolean>>(() => loadColumnVisibility())
    const [expandedTagMaps, setExpandedTagMaps] = useState<Set<string>>(() => new Set())
    const [videoModal, setVideoModal] = useState<{
        url: string
        mapName: string
        time?: number
        alias?: string
        fromPicker?: boolean
    } | null>(null)
    const [replayPickerMap, setReplayPickerMap] = useState<string | null>(null)
    const [capLoadingMap, setCapLoadingMap] = useState<string | null>(null)
    const [replayError, setReplayError] = useState<string | null>(null)
    const [shareCopied, setShareCopied] = useState(false)
    const shareTimerRef = useRef<number | null>(null)

    const copyReplayLink = async () => {
        if (!videoModal?.url) return
        try {
            await navigator.clipboard.writeText(videoModal.url)
            setShareCopied(true)
            if (shareTimerRef.current) window.clearTimeout(shareTimerRef.current)
            shareTimerRef.current = window.setTimeout(() => setShareCopied(false), 1500)
        } catch (err) {
            console.error('Copy replay link failed', err)
        }
    }

    const openCapReplay = async (mapName: string, capId: string | undefined, seconds: number | undefined, alias: string | undefined) => {
        if (!capId) return
        setCapLoadingMap(mapName)
        try {
            const status = await fetchDemoStatus(capId)
            const url = getFirstPersonVideoUrl(status)
            if (url) {
                setVideoModal({
                    url,
                    mapName,
                    time: seconds,
                    alias,
                    fromPicker: true,
                })
            } else {
                setReplayError('Demo is still being processed by DemoConverter. Please try again later.')
            }
        } catch {
            setReplayError('Could not load this replay. Please try again later.')
        } finally {
            setCapLoadingMap(null)
        }
    }

    const toggleTagExpansion = (mapName: string) => {
        setExpandedTagMaps(prev => {
            const next = new Set(prev)
            if (next.has(mapName)) next.delete(mapName)
            else next.add(mapName)
            return next
        })
    }

    const [columnOrder, setColumnOrder] = useState<ColumnId[]>(() => normalizeColumnOrder(loadColumnOrder()))

    const toggleColumn = (id: ColumnId) => {
        if (REQUIRED_COLUMNS.has(id)) return
        setColumnVisibility(prev => {
            const next = { ...prev, [id]: !prev[id] }
            persistColumnVisibility(next)
            return next
        })
    }

    const [draggingColumn, setDraggingColumn] = useState<ColumnId | null>(null)
    const [dragOverColumn, setDragOverColumn] = useState<ColumnId | null>(null)

    // Tutorial: first-time onboarding for the Maps page.
    const tutorial = useMapsTutorialState()
    const [tutorialActive, setTutorialActive] = useState(false)
    const [tutorialStep, setTutorialStep] = useState(0)
    const [columnsMenuOpen, setColumnsMenuOpen] = useState(false)
    const searchRef = useRef<HTMLInputElement | null>(null)
    const filtersButtonRef = useRef<HTMLButtonElement | null>(null)
    const filterPanelRef = useRef<HTMLDivElement | null>(null)
    const columnsButtonRef = useRef<HTMLButtonElement | null>(null)
    const presetsButtonRef = useRef<HTMLButtonElement | null>(null)
    const sortHeaderRef = useRef<HTMLButtonElement | null>(null)
    const firstRowFavRef = useRef<HTMLSpanElement | null>(null)
    const firstRowWrRef = useRef<HTMLButtonElement | null>(null)
    const firstRowReplayRef = useRef<HTMLButtonElement | null>(null)
    const firstRowRatingRef = useRef<HTMLButtonElement | null>(null)
    const firstRowMyRatingRef = useRef<HTMLButtonElement | null>(null)
    const firstRowNameRef = useRef<HTMLButtonElement | null>(null)
    const firstRowPbRef = useRef<HTMLElement | null>(null)

    const startTutorial = useCallback(() => {
        setTutorialStep(0)
        setTutorialActive(true)
    }, [])
    const closeTutorial = useCallback(() => {
        setTutorialActive(false)
        setTutorialStep(0)
        setPresetsMenuOpen(false)
        setColumnsMenuOpen(false)
        onStateChange(prev => ({ ...prev, filtersPanelOpen: false }))
    }, [onStateChange])

    // Focus the preset-name input when the save modal opens. Modal traps
    // focus on its first focusable element (the close X) on mount, so we
    // re-focus the input after that effect runs.
    useEffect(() => {
        if (!savePresetOpen) return
        const id = window.setTimeout(() => presetNameInputRef.current?.focus(), 0)
        return () => window.clearTimeout(id)
    }, [savePresetOpen])

    const reorderColumn = (sourceId: ColumnId, targetId: ColumnId) => {
        if (sourceId === targetId) return
        const isMedalPbPair = (id: ColumnId) => id === 'medal' || id === 'pb'
        setColumnOrder(prev => {
            const fromIdx = prev.indexOf(sourceId)
            const toIdx = prev.indexOf(targetId)
            if (fromIdx === -1 || toIdx === -1) return prev

            let next: ColumnId[]
            if (isMedalPbPair(sourceId)) {
                // Move medal+pb together. No-op if target is the other half.
                if (isMedalPbPair(targetId)) return prev
                const without: ColumnId[] = prev.filter(id => id !== 'medal' && id !== 'pb')
                const insertAt = without.indexOf(targetId)
                if (insertAt === -1) return prev
                const offset = fromIdx < toIdx ? 1 : 0
                without.splice(insertAt + offset, 0, 'medal', 'pb')
                next = without
            } else {
                next = [...prev]
                const [moved] = next.splice(fromIdx, 1)
                const insertAt = next.indexOf(targetId)
                next.splice(insertAt + (fromIdx < toIdx ? 1 : 0), 0, moved)
            }
            const normalized = normalizeColumnOrder(next)
            persistColumnOrder(normalized)
            return normalized
        })
    }

    const isColumnVisible = (id: ColumnId): boolean =>
        REQUIRED_COLUMNS.has(id) || columnVisibility[id]

    const visibleColumnCount = columnOrder.reduce(
        (n, id) => n + (!NON_TABLE_COLUMNS.has(id) && isColumnVisible(id) ? 1 : 0),
        0,
    )
    const searchAbortRef = useRef<AbortController | null>(null)
    const scrollContainerRef = useRef<HTMLDivElement | null>(null)

    const accessToken = userProfile?.accessToken

    // --- Mode derivation ---
    const isSearchMode = state.search.trim().length > 0
    const usesClientOnlyFilter =
        state.ratingFilters.length > 0 ||
        state.aestheticsFilters.length > 0 ||
        state.learningFilters.length > 0 ||
        state.luckFilters.length > 0 ||
        state.recordTimeFilters.length > 0 ||
        state.yearFilters.length > 0 ||
        state.cappedFilters.length > 0 ||
        state.ratedFilters.length > 0 ||
        state.authorFilters.length > 0 ||
        state.tagFilters.length > 0 ||
        state.difficultyFilters.length > 0 ||
        state.favoritesOnly ||
        state.sortBy === 'rating' ||
        state.sortBy === 'my_rating' ||
        state.sortBy === 'world_record' ||
        state.sortBy === 'pb' ||
        state.sortBy === 'author' ||
        state.sortBy === 'medal'
    const mode: 'browse' | 'search' | 'fullload' =
        isSearchMode ? 'search' : usesClientOnlyFilter ? 'fullload' : 'browse'

    // --- Server-side filter object (used in browse mode) ---
    const browseServerFilters = useMemo(() => {
        const filters: Parameters<typeof fetchMaps>[1] = { active: true }
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
    }, [state.newOnly, state.sortBy, state.sortDir])

    const userId = userProfile?.id ?? undefined

    const newMapCount = useMemo(() => {
        if (!caches.metadata) return 0
        return caches.metadata.reduce((n, m) => n + (isNew(m.added) ? 1 : 0), 0)
    }, [caches.metadata])

    // --- Initial caches load ---
    const loadCachesInFlightRef = useRef({
        metadata: false,
        reviews: false,
        authors: false,
        bestCaps: false,
    })
    const loadCaches = useCallback(async (force = false) => {
        if (!accessToken) return
        const inFlight = loadCachesInFlightRef.current
        const needsMetadata = (force || !caches.metadataLoaded) && !inFlight.metadata
        const needsReviews = (force || !caches.reviewsLoaded) && !inFlight.reviews
        const needsAuthors = (force || !caches.authorsLoaded) && !inFlight.authors
        const needsBestCaps = (force || !caches.bestCapsLoaded) && !!userId && !inFlight.bestCaps
        if (!needsMetadata && !needsReviews && !needsAuthors && !needsBestCaps) return

        if (needsMetadata) inFlight.metadata = true
        if (needsReviews) inFlight.reviews = true
        if (needsAuthors) inFlight.authors = true
        if (needsBestCaps) inFlight.bestCaps = true

        setError(null)
        try {
            const [metadataData, reviewsData, authorsData, bestCapsData] = await Promise.all([
                needsMetadata ? fetchMapsMetadata(accessToken) : Promise.resolve(null),
                needsReviews ? fetchAllMapReviews(accessToken) : Promise.resolve(null),
                needsAuthors ? fetchMapAuthors(accessToken) : Promise.resolve(null),
                needsBestCaps ? fetchBestCaps(accessToken, userId) : Promise.resolve(null),
            ])
            onCachesChange(prev => ({
                ...prev,
                metadata: needsMetadata ? (metadataData as MapMetadata[]) : prev.metadata,
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
        } finally {
            if (needsMetadata) inFlight.metadata = false
            if (needsReviews) inFlight.reviews = false
            if (needsAuthors) inFlight.authors = false
            if (needsBestCaps) inFlight.bestCaps = false
        }
    }, [accessToken, userId, caches.metadataLoaded, caches.reviewsLoaded, caches.authorsLoaded, caches.bestCapsLoaded, onCachesChange])

    useEffect(() => { loadCaches() }, [loadCaches])

    // --- Browse-mode page fetch + adjacent prefetch ---
    type PageEntry = Map[] | Promise<Map[] | null>
    type CountEntry = number | Promise<number | null>
    const pageCacheRef = useRef<Record<string, PageEntry>>({})
    const countCacheRef = useRef<Record<string, CountEntry>>({})

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

    const fetchPage = useCallback((p: number): Promise<Map[] | null> => {
        if (!accessToken) return Promise.resolve(null)
        const key = keyFor(p)
        const existing = pageCacheRef.current[key]
        if (existing !== undefined) {
            return Array.isArray(existing) ? Promise.resolve(existing) : existing
        }
        const offset = (p - 1) * pageSize
        const promise = fetchMaps(accessToken, { ...browseServerFilters, limit: pageSize, offset })
            .then(maps => {
                pageCacheRef.current[key] = maps
                return maps
            })
            .catch(() => {
                delete pageCacheRef.current[key]
                return null
            })
        pageCacheRef.current[key] = promise
        return promise
    }, [accessToken, browseServerFilters, pageSize, keyFor])

    const fetchCount = useCallback((): Promise<number | null> => {
        if (!accessToken) return Promise.resolve(null)
        const ck = countKeyFor()
        const existing = countCacheRef.current[ck]
        if (existing !== undefined) {
            return typeof existing === 'number' ? Promise.resolve(existing) : existing
        }
        const promise = fetchMapsCount(accessToken, browseServerFilters)
            .then(count => {
                countCacheRef.current[ck] = count
                return count
            })
            .catch(() => {
                delete countCacheRef.current[ck]
                return null
            })
        countCacheRef.current[ck] = promise
        return promise
    }, [accessToken, browseServerFilters, countKeyFor])

    const loadBrowsePage = useCallback(async () => {
        if (!accessToken || mode !== 'browse') return

        const currentKey = keyFor(state.currentPage)
        const cachedPageEntry = pageCacheRef.current[currentKey]
        const cachedCountEntry = countCacheRef.current[countKeyFor()]
        const cachedPage = Array.isArray(cachedPageEntry) ? cachedPageEntry : undefined
        const cachedCount = typeof cachedCountEntry === 'number' ? cachedCountEntry : undefined

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
        }, SEARCH_DEBOUNCE_MS)
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
            if (state.authorFilters.length > 0) {
                const a = getAuthorString(m as Map).toLowerCase()
                if (!state.authorFilters.some(f => f.toLowerCase() === a)) return false
            }
            if (state.tagFilters.length > 0) {
                const tags = (m.tags ?? '').toLowerCase().split(',').map(t => t.trim()).filter(Boolean)
                if (!state.tagFilters.some(f => tags.includes(f.toLowerCase()))) return false
            }
            if (state.yearFilters.length > 0) {
                const y = String(new Date(m.added).getFullYear())
                if (!state.yearFilters.includes(y)) return false
            }
            if (state.difficultyFilters.length > 0) {
                if (!state.difficultyFilters.some(t => isMapInDifficultyTier(m.difficulty, t))) return false
            }
            if (state.newOnly && !isNew(m.added)) return false
            if (state.favoritesOnly && !favoriteMapNames.has(m.name)) return false

            const ratings = caches.avgRatings[m.name]
            if (state.ratingFilters.length > 0) {
                const v = ratingScale100(ratings?.overall)
                if (!state.ratingFilters.some(t => isInRatingTier(v, t))) return false
            }
            if (state.aestheticsFilters.length > 0) {
                const v = ratingScale100(ratings?.aesthetics)
                if (!state.aestheticsFilters.some(t => isInRatingTier(v, t))) return false
            }
            if (state.learningFilters.length > 0) {
                const v = ratingScale100(ratings?.learning)
                if (!state.learningFilters.some(t => isInRatingTier(v, t))) return false
            }
            if (state.luckFilters.length > 0) {
                const v = ratingScale100(ratings?.luck)
                if (!state.luckFilters.some(t => isInLuckTier(v, t))) return false
            }

            const wr = (m as Map).world_record
            if (state.recordTimeFilters.length > 0) {
                if (!state.recordTimeFilters.some(t => isInRecordTimeTier(wr, t))) return false
            }

            if (state.cappedFilters.length > 0) {
                const bestCap = caches.bestCaps[m.name]
                const tier = computeMedalTier(bestCap, m as MapMetadata)
                const matches =
                    (state.cappedFilters.includes('uncapped') && tier === 'uncapped') ||
                    (state.cappedFilters.includes('capped') && !!bestCap) ||
                    (tier !== 'uncapped' && state.cappedFilters.includes(tier as CappedFilterValue))
                if (!matches) return false
            }

            if (state.ratedFilters.length > 0) {
                const rated = !!caches.myReviews[m.name]
                const matches =
                    (state.ratedFilters.includes('rated') && rated) ||
                    (state.ratedFilters.includes('unrated') && !rated)
                if (!matches) return false
            }

            return true
        })
    }, [
        state.authorFilters, state.tagFilters, state.yearFilters, state.difficultyFilters,
        state.newOnly, state.favoritesOnly, state.ratingFilters, state.aestheticsFilters, state.learningFilters,
        state.luckFilters, state.recordTimeFilters, state.cappedFilters, state.ratedFilters,
        caches.avgRatings, caches.bestCaps, caches.myReviews, favoriteMapNames,
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

            // PB sort: missing PBs always pushed to end regardless of direction.
            if (state.sortBy === 'pb') {
                const aPB = caches.bestCaps[a.name]?.cap_time_seconds
                const bPB = caches.bestCaps[b.name]?.cap_time_seconds
                const aEmpty = !(aPB != null && aPB > 0)
                const bEmpty = !(bPB != null && bPB > 0)
                if (aEmpty && bEmpty) return 0
                if (aEmpty) return 1
                if (bEmpty) return -1
                const cmp = (aPB as number) - (bPB as number)
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

            // Medal sort: maps without a medal (uncapped or casual) always pushed to end.
            if (state.sortBy === 'medal') {
                const aT = computeMedalTier(caches.bestCaps[a.name], a as MapMetadata)
                const bT = computeMedalTier(caches.bestCaps[b.name], b as MapMetadata)
                const aEmpty = aT === 'uncapped' || aT === 'casual'
                const bEmpty = bT === 'uncapped' || bT === 'casual'
                if (aEmpty && bEmpty) return 0
                if (aEmpty) return 1
                if (bEmpty) return -1
                const cmp = TIER_RANK[aT] - TIER_RANK[bT]
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

    // --- Lazy WR-holder fetch: only for currently visible map names ---
    const wrHoldersInFlightRef = useRef<Set<string>>(new Set())
    useEffect(() => {
        if (!accessToken) return
        const fetchedSet = new Set(caches.wrHoldersFetched)
        const inFlight = wrHoldersInFlightRef.current
        const missing: string[] = []
        for (const m of pageItems) {
            if (fetchedSet.has(m.name)) continue
            if (inFlight.has(m.name)) continue
            missing.push(m.name)
        }
        if (missing.length === 0) return
        missing.forEach(name => inFlight.add(name))
        let cancelled = false
        ;(async () => {
            try {
                const records = await fetchWorldRecordsForMaps(accessToken, missing)
                if (cancelled) return
                const additions: Record<string, WRHolder> = {}
                for (const r of records) {
                    additions[r.map] = {
                        user_id: r.user_id,
                        alias: r.alias,
                        cap_id: r.cap_id,
                        color_r: r.color_r,
                        color_g: r.color_g,
                        color_b: r.color_b,
                    }
                }
                onCachesChange(prev => ({
                    ...prev,
                    wrHolders: { ...prev.wrHolders, ...additions },
                    wrHoldersFetched: Array.from(new Set([...prev.wrHoldersFetched, ...missing])),
                }))
            } finally {
                missing.forEach(name => inFlight.delete(name))
            }
        })()
        return () => {
            cancelled = true
        }
    }, [pageItems, accessToken, caches.wrHoldersFetched, onCachesChange])

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
        onStateChange(prev => ({
            ...DEFAULT_MAPS_STATE,
            filtersPanelOpen: prev.filtersPanelOpen,
            pageSizePreference: prev.pageSizePreference,
        }))
    }

    const captureFilters = (): PresetFilters => ({
        search: state.search,
        authorFilters: state.authorFilters,
        tagFilters: state.tagFilters,
        yearFilters: state.yearFilters,
        difficultyFilters: state.difficultyFilters,
        ratingFilters: state.ratingFilters,
        aestheticsFilters: state.aestheticsFilters,
        learningFilters: state.learningFilters,
        luckFilters: state.luckFilters,
        recordTimeFilters: state.recordTimeFilters,
        cappedFilters: state.cappedFilters,
        ratedFilters: state.ratedFilters,
        newOnly: state.newOnly,
        favoritesOnly: state.favoritesOnly,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
    })

    const [activePresetId, setActivePresetId] = useState<string | null>(null)

    const handleSavePreset = () => {
        const name = presetNameInput.trim()
        if (!name) return
        const id = newPresetId()
        const next = [...presets, { id, name, filters: captureFilters() }]
        setPresets(next)
        persistPresets(next)
        setActivePresetId(id)
        setSavePresetOpen(false)
        setPresetNameInput('')
    }

    const handleLoadPreset = (p: MapsPreset) => {
        setActivePresetId(p.id)
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
        if (activePresetId === id) setActivePresetId(null)
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
        state.authorFilters.length > 0,
        state.tagFilters.length > 0,
        state.yearFilters.length > 0,
        state.difficultyFilters.length > 0,
        state.ratingFilters.length > 0,
        state.aestheticsFilters.length > 0,
        state.learningFilters.length > 0,
        state.luckFilters.length > 0,
        state.recordTimeFilters.length > 0,
        state.cappedFilters.length > 0,
        state.ratedFilters.length > 0,
        state.newOnly,
        state.favoritesOnly,
    ].filter(Boolean).length

    const hasActiveFilters = activeFilterCount > 0 || state.search.trim() !== ''

    const activePreset = activePresetId ? presets.find(p => p.id === activePresetId) ?? null : null
    useEffect(() => {
        if (!activePreset) return
        const current = captureFilters()
        const target = activePreset.filters
        const matches = (Object.keys(target) as (keyof PresetFilters)[]).every(k => {
            const a = current[k]
            const b = target[k]
            if (Array.isArray(a) && Array.isArray(b)) {
                if (a.length !== b.length) return false
                const sa = [...a].sort()
                const sb = [...b].sort()
                return sa.every((v, i) => v === sb[i])
            }
            return a === b
        })
        if (!matches) setActivePresetId(null)
        // captureFilters is intentionally omitted: it closes over every filter
        // state field we already list, and including it would re-run on each
        // render. The effect only needs to re-evaluate when a filter changes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        activePreset,
        state.search, state.authorFilters, state.tagFilters, state.yearFilters,
        state.difficultyFilters, state.ratingFilters, state.aestheticsFilters,
        state.learningFilters, state.luckFilters, state.recordTimeFilters,
        state.cappedFilters, state.newOnly, state.favoritesOnly, state.sortBy, state.sortDir,
    ])

    const showSkeleton =
        (loading && pageItems.length === 0) ||
        (mode === 'search' && searchLoading)

    const renderColumnHeader = (id: ColumnId): React.ReactNode => {
        if (NON_TABLE_COLUMNS.has(id)) return null
        if (!isColumnVisible(id)) return null
        switch (id) {
            case 'thumbnail':
                return <th key={id} className="px-4 py-3 text-left w-20 text-muted-foreground font-medium text-xs uppercase tracking-wider"></th>
            case 'name':
                return (
                    <th key={id} className="px-4 py-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                        <button ref={sortHeaderRef} onClick={() => handleSort('name')} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                            Map <SortIcon field="name" />
                        </button>
                    </th>
                )
            case 'author':
                return (
                    <th key={id} className="px-4 py-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                        <button onClick={() => handleSort('author')} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                            Author <SortIcon field="author" />
                        </button>
                    </th>
                )
            case 'difficulty':
                return (
                    <th key={id} className="px-4 py-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                        <button onClick={() => handleSort('difficulty')} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                            Difficulty <SortIcon field="difficulty" />
                        </button>
                    </th>
                )
            case 'added':
                return (
                    <th key={id} className="px-4 py-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                        <button onClick={() => handleSort('added')} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                            Added <SortIcon field="added" />
                        </button>
                    </th>
                )
            case 'world_record':
                return (
                    <th key={id} className="px-4 py-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                        <button onClick={() => handleSort('world_record')} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                            World Record <SortIcon field="world_record" />
                        </button>
                    </th>
                )
            case 'medal':
                return (
                    <th key={id} className="px-2 py-3 text-center w-10 text-muted-foreground font-medium text-xs uppercase tracking-wider">
                        <Tooltip content="Sort by Medal" side="top">
                            <button
                                onClick={() => handleSort('medal')}
                                className="inline-flex items-center justify-center hover:text-white transition-colors cursor-pointer"
                            >
                                Medal
                                <SortIcon field="medal" />
                            </button>
                        </Tooltip>
                    </th>
                )
            case 'pb':
                return (
                    <th key={id} className="px-4 py-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                        <button onClick={() => handleSort('pb')} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                            Personal Best <SortIcon field="pb" />
                        </button>
                    </th>
                )
            case 'replay':
                return <th key={id} className="px-2 py-3 text-center w-20 text-muted-foreground font-medium text-xs uppercase tracking-wider"></th>
            case 'community_rating':
                return (
                    <th key={id} className="px-4 py-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                        <button onClick={() => handleSort('rating')} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                            Community Review <SortIcon field="rating" />
                        </button>
                    </th>
                )
            case 'my_rating':
                return (
                    <th key={id} className="px-4 py-3 text-left text-muted-foreground font-medium text-xs uppercase tracking-wider">
                        <button onClick={() => handleSort('my_rating')} className="flex items-center gap-1 hover:text-white transition-colors cursor-pointer">
                            Your Review <SortIcon field="my_rating" />
                        </button>
                    </th>
                )
            default:
                return null
        }
    }

    type RowCtx = {
        map: Map | MapMetadata
        author: string
        tags: string[]
        ratings: AvgRatings | undefined
        myReview: MapReview | undefined
        mapNew: boolean
        wr: number | undefined
        bestCap: BestCap | undefined
        wrHolder: WRHolder | undefined
        medalTier: MedalTier
        isFirstRow: boolean
    }

    const renderColumnCell = (id: ColumnId, ctx: RowCtx): React.ReactNode => {
        if (NON_TABLE_COLUMNS.has(id)) return null
        if (!isColumnVisible(id)) return null
        const { map, author, tags, ratings, myReview, mapNew, wr, bestCap, wrHolder, medalTier, isFirstRow } = ctx
        switch (id) {
            case 'thumbnail':
                return (
                    <td key={id} className="px-4 py-3">
                        <MapThumbnail mapName={map.name} className="w-12 h-12" />
                    </td>
                )
            case 'name': {
                const expanded = expandedTagMaps.has(map.name)
                const shown = expanded ? tags : tags.slice(0, 3)
                return (
                    <td key={id} className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span ref={isFirstRow ? firstRowFavRef : undefined} className="inline-flex">
                                <FavoriteStar
                                    mapName={map.name}
                                    isFavorited={favoriteMapNames.has(map.name)}
                                    onToggle={onToggleFavorite}
                                    size="md"
                                />
                            </span>
                            <Tooltip content="Open map details" side="top">
                                <button
                                    ref={isFirstRow ? firstRowNameRef : undefined}
                                    type="button"
                                    onClick={e => {
                                        e.stopPropagation()
                                        onMapSelect(map.name)
                                    }}
                                    className="font-bold text-white hover:text-blue-300 underline-offset-4 transition-colors cursor-pointer text-left text-md"
                                >
                                    {map.name}
                                </button>
                            </Tooltip>
                            {mapNew && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase tracking-wider">
                                    New
                                </span>
                            )}
                            {columnVisibility.tags && (
                                <>
                                    {shown.map(tag => (
                                        <span
                                            key={tag}
                                            style={tagColorStyle(tag)}
                                            className="text-[10px] font-medium px-1.5 py-0.5 rounded border"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                    {tags.length > 3 && (
                                        <Tooltip content={expanded ? 'Collapse tags' : tags.slice(3).join(', ')} side="top">
                                            <button
                                                type="button"
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    toggleTagExpansion(map.name)
                                                }}
                                                className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-muted-foreground hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                                            >
                                                {expanded ? '− Show less' : `+${tags.length - 3}`}
                                            </button>
                                        </Tooltip>
                                    )}
                                </>
                            )}
                        </div>
                    </td>
                )
            }
            case 'author':
                return (
                    <td key={id} className="px-4 py-3 text-muted-foreground">
                        <PlayerInfo alias={author || '—'} size="md" />
                    </td>
                )
            case 'difficulty':
                return (
                    <td key={id} className="px-4 py-3">
                        <div className="flex items-center gap-2">
                            <span className={cn("text-sm font-bold w-4 text-center", difficultyTextColor(map.difficulty))}>
                                {map.difficulty}
                            </span>
                            <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={cn("h-full rounded-full", difficultyBgColor(map.difficulty))}
                                    style={{ width: `${(map.difficulty / 10) * 100}%` }}
                                />
                            </div>
                        </div>
                    </td>
                )
            case 'added':
                return (
                    <td key={id} className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                        {formatAddedDate(map.added)}
                    </td>
                )
            case 'world_record': {
                if (!(wr != null && wr > 0)) {
                    return (
                        <td key={id} className="px-4 py-3 font-mono text-sm text-muted-foreground">
                            <span className="opacity-30">—</span>
                        </td>
                    )
                }
                const capId = wrHolder?.cap_id
                const clickable = !!capId
                const isLoading = capLoadingMap === map.name
                const aliasStyle: React.CSSProperties | undefined = wrHolder?.color_r != null
                    ? { color: `rgb(${wrHolder.color_r}, ${wrHolder.color_g}, ${wrHolder.color_b})` }
                    : undefined
                const timeNode = (
                    <span className={cn(
                        "text-amber-300 transition-[color,text-shadow] duration-150 w-fit",
                        clickable && "group/wr group-hover/wr:text-amber-200 group-hover/wr:[text-shadow:0_0_6px_rgba(252,211,77,0.85),0_0_12px_rgba(252,211,77,0.45)]",
                        isLoading && "opacity-60",
                    )}>
                        {formatCapTime(wr)}
                    </span>
                )
                const timeButton = clickable ? (
                    <Tooltip content="Watch run" side="top">
                        <button
                            ref={isFirstRow ? firstRowWrRef : undefined}
                            type="button"
                            disabled={isLoading}
                            onClick={e => {
                                e.stopPropagation()
                                openCapReplay(map.name, capId, wr, wrHolder?.alias)
                            }}
                            className="text-left cursor-pointer group/wr"
                        >
                            {timeNode}
                        </button>
                    </Tooltip>
                ) : (
                    <div ref={isFirstRow ? (firstRowWrRef as unknown as React.RefObject<HTMLDivElement | null>) : undefined} className="text-left">{timeNode}</div>
                )
                return (
                    <td key={id} className="px-4 py-3 font-mono text-sm text-muted-foreground">
                        <div className="flex flex-col leading-tight">
                            {timeButton}
                            {wrHolder && (wrHolder.user_id ? (
                                <button
                                    type="button"
                                    onClick={e => {
                                        e.stopPropagation()
                                        window.dispatchEvent(new CustomEvent('open-player', {
                                            detail: { userId: wrHolder.user_id },
                                        }))
                                    }}
                                    className="text-[12px] font-sans font-bold truncate max-w-[140px] hover:underline underline-offset-2 cursor-pointer text-left"
                                    style={aliasStyle}
                                >
                                    {wrHolder.alias}
                                </button>
                            ) : (
                                <span
                                    className="text-[12px] font-sans font-bold truncate max-w-[140px]"
                                    style={aliasStyle}
                                >
                                    {wrHolder.alias}
                                </span>
                            ))}
                        </div>
                    </td>
                )
            }
            case 'medal':
                return (
                    <td key={id} className="px-2 py-3 text-center">
                        <div className="inline-flex justify-center">
                            <MedalIndicator tier={medalTier} bestCap={bestCap} />
                        </div>
                    </td>
                )
            case 'pb': {
                if (!(bestCap && bestCap.cap_time_seconds > 0)) {
                    return (
                        <td key={id} className="px-4 py-3 font-mono text-sm text-muted-foreground">
                            <span className="opacity-30">—</span>
                        </td>
                    )
                }
                const isWR = wr != null && wr > 0 && bestCap.cap_time_seconds - wr <= 0.0005
                const pbCapId = bestCap.cap_id ?? undefined
                const clickable = bestCap.cap_type === 2 && !!pbCapId
                const isLoading = capLoadingMap === map.name
                const myAlias = userProfile?.alias ?? undefined
                const timeText = (
                    <span className={cn(
                        pbTextColor(medalTier, isWR),
                        clickable && "transition-[text-shadow] duration-150 group-hover/pb:[text-shadow:0_0_6px_currentColor,0_0_12px_currentColor]",
                        isLoading && "opacity-60",
                    )}>
                        {formatCapTime(bestCap.cap_time_seconds)}
                    </span>
                )
                const deltaText = wr != null && wr > 0 && (
                    isWR ? (
                        <span className="text-[12px] text-blue-400 font-bold tracking-wider font-sans">World Record</span>
                    ) : (
                        <span className="text-[12px] text-muted-foreground/70">+{formatDelta(bestCap.cap_time_seconds - wr)}</span>
                    )
                )
                return (
                    <td key={id} className="px-4 py-3 font-mono text-sm text-muted-foreground">
                        {clickable ? (
                            <Tooltip content="Watch your run" side="top">
                                <button
                                    ref={isFirstRow ? (firstRowPbRef as React.RefObject<HTMLButtonElement | null>) : undefined}
                                    type="button"
                                    disabled={isLoading}
                                    onClick={e => {
                                        e.stopPropagation()
                                        openCapReplay(map.name, pbCapId, bestCap.cap_time_seconds, myAlias)
                                    }}
                                    className="flex flex-col leading-tight text-left cursor-pointer group/pb"
                                >
                                    {timeText}
                                    {deltaText}
                                </button>
                            </Tooltip>
                        ) : (
                            <div
                                ref={isFirstRow ? (firstRowPbRef as React.RefObject<HTMLDivElement | null>) : undefined}
                                className="flex flex-col leading-tight"
                            >
                                {timeText}
                                {deltaText}
                            </div>
                        )}
                    </td>
                )
            }
            case 'replay':
                return (
                    <td key={id} className="px-2 py-3 text-center">
                        <button
                            ref={isFirstRow ? firstRowReplayRef : undefined}
                            type="button"
                            onClick={e => {
                                e.stopPropagation()
                                setReplayPickerMap(map.name)
                            }}
                            className="inline-flex items-center justify-center px-3 py-1 rounded-md text-xs font-medium border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/25 hover:text-rose-100 hover:border-rose-500/50 transition-colors cursor-pointer"
                        >
                            Demos
                        </button>
                    </td>
                )
            case 'community_rating':
                return (
                    <td key={id} className="px-4 py-3">
                        <Tooltip content="View reviews" side="top">
                            <button
                                ref={isFirstRow ? firstRowRatingRef : undefined}
                                onClick={e => { e.stopPropagation(); setReviewsModalMap(map.name) }}
                                className="flex items-center gap-2 cursor-pointer group/rating"
                            >
                            {ratings ? (
                                <>
                                    <span className={cn(
                                        "text-sm font-bold w-4 text-center transition-[text-shadow] duration-150",
                                        scoreTextColor(ratings.overall),
                                        "group-hover/rating:[text-shadow:0_0_6px_currentColor,0_0_12px_currentColor]",
                                    )}>
                                        {ratings.overall}
                                    </span>
                                    <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full rounded-full", scoreBgColor(ratings.overall))}
                                            style={{ width: `${(ratings.overall / 10) * 100}%` }}
                                        />
                                    </div>
                                </>
                            ) : (
                                <span className="opacity-50 text-muted-foreground text-xs underline-offset-2 group-hover/rating:underline group-hover/rating:text-white">
                                    No reviews, add one?
                                </span>
                            )}
                            </button>
                        </Tooltip>
                    </td>
                )
            case 'my_rating':
                return (
                    <td key={id} className="px-4 py-3">
                        <Tooltip content={myReview ? 'Update review' : 'Add review'} side="top">
                            <button
                                ref={isFirstRow ? firstRowMyRatingRef : undefined}
                                onClick={e => { e.stopPropagation(); setReviewsModalMap(map.name) }}
                                className="flex items-center gap-2 cursor-pointer group/myrating"
                            >
                            {myReview ? (
                                <>
                                    <span className={cn(
                                        "text-sm font-bold w-4 text-center transition-[text-shadow] duration-150",
                                        scoreTextColor(myReview.overall),
                                        "group-hover/myrating:[text-shadow:0_0_6px_currentColor,0_0_12px_currentColor]",
                                    )}>
                                        {myReview.overall}
                                    </span>
                                    <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                        <div
                                            className={cn("h-full rounded-full", scoreBgColor(myReview.overall))}
                                            style={{ width: `${(myReview.overall / 10) * 100}%` }}
                                        />
                                    </div>
                                </>
                            ) : (
                                <span className="opacity-50 text-muted-foreground text-xs underline-offset-2 group-hover/myrating:underline group-hover/myrating:text-white">
                                    Review this map
                                </span>
                            )}
                            </button>
                        </Tooltip>
                    </td>
                )
            default:
                return null
        }
    }

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-end justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white leading-tight">Maps</h1>
                    {!showSkeleton && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Showing {totalForCount.toLocaleString()} of {(caches.metadata?.length ?? totalForCount).toLocaleString()} maps
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Tooltip content="Launch Tutorial" side="bottom">
                        <button
                            type="button"
                            onClick={() => startTutorial()}
                            aria-label="Restart Maps tutorial"
                            className="p-2 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            <HelpCircle className="size-4" />
                        </button>
                    </Tooltip>
                    <Tooltip content="Refresh Data" side="bottom">
                        <button
                            type="button"
                            onClick={refresh}
                            disabled={loading || pageLoading}
                            className="p-2 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={cn("size-4", (loading || pageLoading) && "animate-spin")} />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {/* Filters toolbar */}
            <div className="flex flex-wrap items-center gap-3 shrink-0">
                <div className="relative flex-1 min-w-48 max-w-xs">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <input
                        ref={searchRef}
                        type="text"
                        placeholder="Search for a map name..."
                        value={state.search}
                        onChange={e => updateFilter('search', e.target.value)}
                        className="w-full pl-9 pr-9 py-2 bg-card/50 border border-white/10 rounded-lg text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50 focus:bg-card/80 transition-colors"
                    />
                    {state.search && (
                        <button
                            type="button"
                            onClick={() => updateFilter('search', '')}
                            aria-label="Clear search"
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-white transition-colors cursor-pointer"
                        >
                            <X className="size-3.5" />
                        </button>
                    )}
                </div>

                <button
                    ref={filtersButtonRef}
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

                <DropdownMenu open={columnsMenuOpen} onOpenChange={setColumnsMenuOpen} modal={false}>
                    <DropdownMenuTrigger asChild>
                        <button
                            ref={columnsButtonRef}
                            className="px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer flex items-center gap-2 bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20"
                        >
                            <Columns3 className="size-4" />
                            Columns
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="min-w-72">
                        <DropdownMenuLabel>Columns</DropdownMenuLabel>
                        <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-muted-foreground">
                            Drag the handle to reorder
                            <br />
                            Checkbox toggles visibility
                        </div>
                        <DropdownMenuSeparator />
                        {columnOrder
                            .filter(id => id !== 'tags')
                            .map(id => {
                                const required = REQUIRED_COLUMNS.has(id)
                                const isDragging = draggingColumn === id
                                const isDragOver = dragOverColumn === id && draggingColumn !== id
                                return (
                                    <div
                                        key={id}
                                        draggable
                                        onDragStart={e => {
                                            setDraggingColumn(id)
                                            e.dataTransfer.effectAllowed = 'move'
                                            e.dataTransfer.setData('text/plain', id)
                                        }}
                                        onDragEnter={e => {
                                            e.preventDefault()
                                            if (draggingColumn && draggingColumn !== id) setDragOverColumn(id)
                                        }}
                                        onDragOver={e => {
                                            e.preventDefault()
                                            e.dataTransfer.dropEffect = 'move'
                                        }}
                                        onDragLeave={() => {
                                            if (dragOverColumn === id) setDragOverColumn(null)
                                        }}
                                        onDrop={e => {
                                            e.preventDefault()
                                            if (draggingColumn) reorderColumn(draggingColumn, id)
                                            setDraggingColumn(null)
                                            setDragOverColumn(null)
                                        }}
                                        onDragEnd={() => {
                                            setDraggingColumn(null)
                                            setDragOverColumn(null)
                                        }}
                                        className={cn(
                                            "flex items-center gap-2 px-2 py-1.5 text-sm select-none rounded transition-colors",
                                            isDragging && "opacity-40",
                                            isDragOver && "bg-blue-500/15 ring-1 ring-blue-500/40",
                                        )}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={isColumnVisible(id)}
                                            disabled={required}
                                            onChange={() => toggleColumn(id)}
                                            aria-label={`Toggle ${COLUMN_LABELS[id]} visibility`}
                                            className="accent-blue-500 cursor-pointer disabled:cursor-default"
                                        />
                                        <span className={cn("flex-1 truncate", required && "text-muted-foreground/80")}>
                                            {COLUMN_LABELS[id]}
                                            {required && <span className="ml-1 text-[9px] uppercase tracking-wider text-muted-foreground/60">required</span>}
                                        </span>
                                        {id === 'name' && (
                                            <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={isColumnVisible('tags')}
                                                    onChange={() => toggleColumn('tags')}
                                                    aria-label="Toggle tag chips"
                                                    className="accent-blue-500 cursor-pointer"
                                                />
                                                Show Tags
                                            </label>
                                        )}
                                        <GripVertical
                                            className="size-4 text-muted-foreground/60 cursor-grab active:cursor-grabbing"
                                            aria-label="Drag to reorder"
                                        />
                                    </div>
                                )
                            })}
                    </DropdownMenuContent>
                </DropdownMenu>

            </div>

            {/* Inline filter panel */}
            {state.filtersPanelOpen && (
                <div ref={filterPanelRef} className="bg-card/30 border border-white/10 rounded-xl p-4 space-y-4 shrink-0">
                    <FilterPanelRow label="Map">
                        <MultiFilterDropdown
                            label="Difficulty"
                            values={state.difficultyFilters}
                            onChange={v => updateFilter('difficultyFilters', v as DifficultyValue[])}
                            options={[
                                ['beginner', 'Beginner (1–3)'],
                                ['intermediate', 'Intermediate (4–6)'],
                                ['advanced', 'Advanced (7–8)'],
                                ['expert', 'Expert (9–10)'],
                            ]}
                        />
                        <MultiFilterDropdown
                            label="Author"
                            values={state.authorFilters}
                            onChange={v => updateFilter('authorFilters', v)}
                            options={uniqueAuthors.map(a => [a, a] as [string, string])}
                            searchable
                        />
                        <MultiFilterDropdown
                            label="Category"
                            values={state.tagFilters}
                            onChange={v => updateFilter('tagFilters', v)}
                            options={uniqueTags.map(t => [t, t] as [string, string])}
                            searchable
                        />
                        <MultiFilterDropdown
                            label="Year"
                            values={state.yearFilters}
                            onChange={v => updateFilter('yearFilters', v)}
                            options={uniqueYears.map(y => [String(y), String(y)] as [string, string])}
                        />
                    </FilterPanelRow>

                    <FilterPanelRow label="Ratings">
                        <MultiFilterDropdown
                            label="Overall"
                            values={state.ratingFilters}
                            onChange={v => updateFilter('ratingFilters', v as RatingValue[])}
                            options={ratingTierOptions}
                        />
                        <MultiFilterDropdown
                            label="Aesthetics"
                            values={state.aestheticsFilters}
                            onChange={v => updateFilter('aestheticsFilters', v as RatingValue[])}
                            options={aestheticsTierOptions}
                        />
                        <MultiFilterDropdown
                            label="Learning"
                            values={state.learningFilters}
                            onChange={v => updateFilter('learningFilters', v as RatingValue[])}
                            options={learningTierOptions}
                        />
                        <MultiFilterDropdown
                            label="Luck"
                            values={state.luckFilters}
                            onChange={v => updateFilter('luckFilters', v as LuckValue[])}
                            options={luckTierOptions}
                        />
                    </FilterPanelRow>

                    <FilterPanelRow label="Misc">
                        <MultiFilterDropdown
                            label="Cap Status"
                            values={state.cappedFilters}
                            onChange={v => updateFilter('cappedFilters', v as CappedFilterValue[])}
                            options={cappedOptions}
                            iconFor={v => (v !== 'uncapped' && v !== 'capped')
                                ? TIER_ICONS[v as Exclude<MedalTier, 'uncapped'>]
                                : null}
                        />
                        <MultiFilterDropdown
                            label="WR Time"
                            values={state.recordTimeFilters}
                            onChange={v => updateFilter('recordTimeFilters', v as RecordTimeValue[])}
                            options={recordTimeOptions}
                        />
                        <MultiFilterDropdown
                            label="Reviewed"
                            values={state.ratedFilters}
                            onChange={v => updateFilter('ratedFilters', v as RatedValue[])}
                            options={ratedOptions}
                        />
                        <label className="flex items-center gap-2 px-3 py-2 bg-card/50 border border-white/10 rounded-md text-sm text-white cursor-pointer hover:border-white/20 self-end">
                            <input
                                type="checkbox"
                                checked={state.newOnly}
                                onChange={e => updateFilter('newOnly', e.target.checked)}
                                className="accent-blue-500 cursor-pointer"
                            />
                            <span>New maps</span>
                            {newMapCount > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                                    {newMapCount}
                                </span>
                            )}
                        </label>
                        <label className="flex items-center gap-2 px-3 py-2 bg-card/50 border border-white/10 rounded-md text-sm text-white cursor-pointer hover:border-white/20 self-end">
                            <input
                                type="checkbox"
                                checked={state.favoritesOnly}
                                onChange={e => updateFilter('favoritesOnly', e.target.checked)}
                                className="accent-yellow-400 cursor-pointer"
                            />
                            <span>Favorites</span>
                            {favoriteMapNames.size > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                                    {favoriteMapNames.size}
                                </span>
                            )}
                        </label>
                    </FilterPanelRow>

                    {/* Presets row */}
                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
                        <div className="flex items-center gap-2">
                            <DropdownMenu open={presetsMenuOpen} onOpenChange={setPresetsMenuOpen} modal={false}>
                                <DropdownMenuTrigger asChild>
                                    <button
                                        ref={presetsButtonRef}
                                        className={cn(
                                            "h-8 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-2",
                                            activePreset
                                                ? "bg-blue-500/15 border-blue-500/40 text-blue-200 hover:bg-blue-500/25 hover:border-blue-500/60"
                                                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25 hover:text-emerald-200 hover:border-emerald-500/50",
                                        )}
                                    >
                                        <Bookmark className="size-3.5" />
                                        Saved Filters
                                        {activePreset ? (
                                            <span className="text-[11px] font-semibold text-blue-200 max-w-[160px] truncate">
                                                · {activePreset.name}
                                            </span>
                                        ) : presets.length > 0 && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-muted-foreground">
                                                {presets.length}
                                            </span>
                                        )}
                                    </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start" className="min-w-56 max-w-80">
                                    <DropdownMenuLabel>Saved Filters</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {presets.length === 0 ? (
                                        <div className="px-2 py-2 text-xs text-muted-foreground">
                                            No saved presets yet.
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
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onSelect={e => {
                                            e.preventDefault()
                                            if (!hasActiveFilters) return
                                            setPresetsMenuOpen(false)
                                            setPresetNameInput('')
                                            setSavePresetOpen(true)
                                        }}
                                        disabled={!hasActiveFilters}
                                        className={cn(
                                            "flex items-center gap-2 text-blue-300",
                                            !hasActiveFilters && "opacity-40 cursor-default",
                                        )}
                                    >
                                        <BookmarkPlus className="size-3.5" />
                                        Save Current as Preset
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                            {hasActiveFilters && (
                                <button
                                    onClick={resetFilters}
                                    className="h-8 px-3 rounded-md text-xs font-medium border transition-colors cursor-pointer flex items-center gap-2 bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/25 hover:text-red-200 hover:border-red-500/50"
                                >
                                    <X className="size-3.5" />
                                    Clear Filters
                                </button>
                            )}
                        </div>
                    </div>
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
                    <thead data-utbt-maps-thead className="sticky top-0 z-[2] bg-card/95 backdrop-blur">
                        <tr className="border-b border-white/10">
                            {columnOrder.map(id => renderColumnHeader(id))}
                        </tr>
                    </thead>
                    <tbody>
                        {showSkeleton ? (
                            Array.from({ length: SKELETON_ROW_COUNT }).map((_, i) => <SkeletonRow key={i} order={columnOrder} visibility={columnVisibility} />)
                        ) : pageItems.length === 0 ? (
                            <tr>
                                <td colSpan={visibleColumnCount} className="px-4 py-16 text-center text-muted-foreground">
                                    No maps match your filters.
                                </td>
                            </tr>
                        ) : (
                            pageItems.map((map, index) => {
                                const author = getAuthorString(map as Map) || '—'
                                const tags = map.tags
                                    ? map.tags.split(',').map(t => t.trim()).filter(Boolean).sort((a, b) => a.localeCompare(b))
                                    : []
                                let ratings = caches.avgRatings[map.name]
                                let myReview = caches.myReviews[map.name]
                                const mapNew = isNew(map.added)
                                let wr = (map as Map).world_record
                                let bestCap = caches.bestCaps[map.name]
                                let wrHolder = caches.wrHolders[map.name]
                                if (tutorialActive && index === 0) {
                                    const mock = getTutorialMockRow(map.name)
                                    ratings = mock.ratings
                                    myReview = mock.review
                                    wr = mock.wr
                                    bestCap = mock.bestCap
                                    wrHolder = mock.wrHolder
                                }
                                const medalTier = computeMedalTier(bestCap, map as MapMetadata)
                                const ctx: RowCtx = {
                                    map, author, tags, ratings, myReview, mapNew,
                                    wr, bestCap, wrHolder, medalTier,
                                    isFirstRow: index === 0,
                                }

                                return (
                                    <tr
                                        key={map.name}
                                        className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                                    >
                                        {columnOrder.map(id => renderColumnCell(id, ctx))}
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
                    meta={mode === 'browse' ? undefined : mode === 'search' ? 'search' : 'filtered'}
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
                    } catch (e) {
                        console.warn('Failed to refresh review cache', e)
                    }
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
                        ref={presetNameInputRef}
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

            <ReplayPickerModal
                open={replayPickerMap !== null}
                onClose={() => setReplayPickerMap(null)}
                accessToken={accessToken}
                userId={userId}
                mapName={replayPickerMap}
                mapMetadata={replayPickerMap ? caches.metadata?.find(m => m.name === replayPickerMap) : undefined}
                onSelect={(url, mapName, entry) => {
                    setReplayPickerMap(null)
                    setVideoModal({
                        url,
                        mapName,
                        time: entry.cap_time_seconds,
                        alias: entry.alias,
                        fromPicker: true,
                    })
                }}
            />

            <Modal
                isOpen={videoModal !== null}
                onClose={() => setVideoModal(null)}
                title={
                    videoModal
                        ? (videoModal.time != null && videoModal.alias
                            ? `Replay — ${formatCapTime(videoModal.time)} by ${videoModal.alias} on ${videoModal.mapName.replace('CTF-BT-', '')}`
                            : `Replay — ${videoModal.mapName.replace('CTF-BT-', '')}`)
                        : ''
                }
                offsetSidebar
                className="bg-[#0a0a0b]/98 border-white/5"
                maxWidth="min(90vw, 1280px)"
                leftAction={videoModal?.fromPicker ? (
                    <Tooltip content="Back to replays" side="bottom">
                        <button
                            type="button"
                            onClick={() => {
                                const mapName = videoModal.mapName
                                setVideoModal(null)
                                setReplayPickerMap(mapName)
                            }}
                            aria-label="Back to replays"
                            className="h-8 w-8 inline-flex items-center justify-center rounded-full hover:bg-background/80 text-muted-foreground hover:text-white transition-colors cursor-pointer shrink-0"
                        >
                            <ArrowLeft className="size-4" />
                        </button>
                    </Tooltip>
                ) : undefined}
                footer={
                    <div className="p-3 border-t border-border bg-muted/50 flex items-center justify-between gap-3 shrink-0">
                        <Tooltip content={shareCopied ? 'Link copied!' : 'Copy replay link'} side="top">
                            <button
                                type="button"
                                onClick={copyReplayLink}
                                aria-label="Copy replay link"
                                className={cn(
                                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-colors cursor-pointer",
                                    shareCopied
                                        ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                                        : "bg-white/[0.03] border-white/10 text-muted-foreground hover:text-white hover:bg-white/[0.06] hover:border-white/20",
                                )}
                            >
                                {shareCopied ? <Check className="size-3.5" /> : <Share2 className="size-3.5" />}
                                {shareCopied ? 'Copied' : 'Share'}
                            </button>
                        </Tooltip>
                        <div className="text-xs text-muted-foreground flex items-center">
                            Powered by{' '}
                            <a
                                href="https://democonverter.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-1 text-blue-400 hover:underline"
                            >
                                democonverter.com
                            </a>
                        </div>
                    </div>
                }
            >
                {videoModal && (
                    <video
                        key={videoModal.url}
                        src={videoModal.url}
                        controls
                        autoPlay
                        className="w-full aspect-video bg-black rounded"
                    />
                )}
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

            <Modal
                isOpen={replayError !== null}
                onClose={() => setReplayError(null)}
                title="Replay not available"
                className="w-[95%] sm:w-[440px] max-w-md"
                offsetSidebar
            >
                <p className="text-sm text-muted-foreground">
                    {replayError}
                </p>
            </Modal>

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
                    Looks like it's your first time visiting! Would you like to take a quick tutorial of the maps page features? <br /><br />
                    If not, you can reopen it anytime using the <HelpCircle className="inline size-3.5 align-text-bottom" /> icon in the top right.
                </p>
            </Modal>

            {tutorialActive && (
                <MapsTutorial
                    steps={buildSteps(
                        {
                            searchRef,
                            filtersButtonRef,
                            filterPanelRef,
                            columnsButtonRef,
                            presetsButtonRef,
                            sortHeaderRef,
                            firstRowFavRef,
                            firstRowWrRef,
                            firstRowReplayRef,
                            firstRowRatingRef,
                            firstRowMyRatingRef,
                            firstRowNameRef,
                            firstRowPbRef,
                        },
                        {
                            openFilterPanel: () => onStateChange(prev => ({ ...prev, filtersPanelOpen: true })),
                            closeFilterPanel: () => onStateChange(prev => ({ ...prev, filtersPanelOpen: false })),
                            setPresetsMenuOpen,
                            setColumnsMenuOpen,
                        },
                    )}
                    step={tutorialStep}
                    setStep={setTutorialStep}
                    onClose={closeTutorial}
                />
            )}
        </div>
    )
}

const ratingTierOptions: [string, string][] = [
    ['excellent', 'Excellent (8.0+)'],
    ['good', 'Good (6.0–7.9)'],
    ['average', 'Average (4.0–5.9)'],
    ['poor', 'Poor (0–3.9)'],
]

const learningTierOptions: [string, string][] = [
    ['poor', 'Quick to Learn (0–3.9)'],
    ['average', 'Moderate (4.0–5.9)'],
    ['good', 'Takes Effort (6.0–7.9)'],
    ['excellent', 'Very Complex (8.0+)'],
]

const aestheticsTierOptions: [string, string][] = [
    ['excellent', 'Stunning (8.0+)'],
    ['good', 'Polished (6.0–7.9)'],
    ['average', 'Decent (4.0–5.9)'],
    ['poor', 'Plain (0–3.9)'],
]

const luckTierOptions: [string, string][] = [
    ['low', 'No Luck Required (0–3.9)'],
    ['fair', 'Some Luck (4.0–5.9)'],
    ['some', 'High Luck (6.0–7.9)'],
    ['high', 'Pure Luck (8.0+)'],
]

const recordTimeOptions: [string, string][] = (Object.keys(RECORD_TIME_LABELS) as RecordTimeTier[])
    .filter(k => k !== 'all')
    .map(k => [k, RECORD_TIME_LABELS[k]])

const ratedOptions: [string, string][] = [
    ['rated', 'Reviewed by me'],
    ['unrated', 'Not reviewed by me'],
]

const cappedOptions: [string, string][] = [
    ['uncapped', 'Uncapped'],
    ['casual', 'Casual'],
    ['verified', 'Verified'],
    ['bronze', 'Bronze'],
    ['silver', 'Silver'],
    ['gold', 'Gold'],
    ['champion', 'Champion'],
    ['world_record', 'World Record'],
]

