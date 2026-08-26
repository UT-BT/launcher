import type { BestCap, Map, MapMetadata, MapReview } from '@/app/utils/api'

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

export interface WRHolder {
    user_id: string
    alias: string
    cap_id?: string
    team_cap_id?: string | null
    color_r?: number
    color_g?: number
    color_b?: number
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

export type PresetFilters = Pick<MapsPageState,
    'search' | 'authorFilters' | 'tagFilters' | 'yearFilters' | 'difficultyFilters'
    | 'ratingFilters' | 'aestheticsFilters' | 'learningFilters' | 'luckFilters'
    | 'recordTimeFilters' | 'cappedFilters' | 'ratedFilters' | 'newOnly'
    | 'favoritesOnly' | 'sortBy' | 'sortDir'>

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
