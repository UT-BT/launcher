import type { Record as WorldRecord, RusherRow } from '@/app/utils/api'
import type { DifficultyTierValue } from '@/app/utils/difficulty'

export type WorldRecordsMode = 'records' | 'rushers'
export type WorldRecordsSortField = 'map' | 'holder' | 'time' | 'difficulty' | 'date'
export type WorldRecordsSortDir = 'asc' | 'desc'
export type WrDifficultyTierValue = DifficultyTierValue
export type WrTimeframe = 'all' | '7d' | '30d' | '90d' | '1y'
export type WrTimeBucket = 'u30' | '30-60' | '60-120' | '120-300' | 'o300'
export type WorldRecordsColumnId = 'map' | 'holder' | 'time' | 'difficulty' | 'date' | 'actions'

export interface WorldRecordsPageState {
    mode: WorldRecordsMode
    search: string
    difficultyFilters: WrDifficultyTierValue[]
    holderFilters: string[]
    timeFilters: WrTimeBucket[]
    yearFilters: string[]
    timeframe: WrTimeframe
    favoritesOnly: boolean
    sortBy: WorldRecordsSortField
    sortDir: WorldRecordsSortDir
    columnVisibility: Record<WorldRecordsColumnId, boolean>
    columnOrder: WorldRecordsColumnId[]
    currentPage: number
    pageSizePreference: number | 'auto'
    filtersPanelOpen: boolean
    scrollTop: number
}

export type WorldRecordsPresetFilters = Pick<WorldRecordsPageState,
    'search' | 'difficultyFilters' | 'holderFilters' | 'timeFilters' | 'yearFilters'
    | 'timeframe' | 'favoritesOnly' | 'sortBy' | 'sortDir'>

export interface WorldRecordsPageCaches {
    recordRows: WorldRecord[]
    recordTotal: number
    rusherRows: RusherRow[]
    rusherTotal: number
    totalRecords: number
    maxRusherCount: number
    querySig: string | null
    lastRefreshIso: string | null
}

export const DEFAULT_COLUMN_ORDER: WorldRecordsColumnId[] = ['map', 'holder', 'time', 'difficulty', 'date', 'actions']

export const DEFAULT_COLUMN_VISIBILITY: Record<WorldRecordsColumnId, boolean> = {
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
    difficultyFilters: [],
    holderFilters: [],
    timeFilters: [],
    yearFilters: [],
    timeframe: 'all',
    favoritesOnly: false,
    sortBy: 'date',
    sortDir: 'desc',
    columnVisibility: DEFAULT_COLUMN_VISIBILITY,
    columnOrder: DEFAULT_COLUMN_ORDER,
    currentPage: 1,
    pageSizePreference: 'auto',
    filtersPanelOpen: false,
    scrollTop: 0,
}

export const DEFAULT_WORLD_RECORDS_CACHES: WorldRecordsPageCaches = {
    recordRows: [],
    recordTotal: 0,
    rusherRows: [],
    rusherTotal: 0,
    totalRecords: 0,
    maxRusherCount: 0,
    querySig: null,
    lastRefreshIso: null,
}
