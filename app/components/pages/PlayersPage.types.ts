import type { PlayerListRow, PlayerSortField } from '@/app/utils/api'

export type SortDir = 'asc' | 'desc'

export type PlayerColumnId =
    | 'rank' | 'player' | 'role' | 'points' | 'world_records'
    | 'champion_medals' | 'gold_medals' | 'silver_medals' | 'bronze_medals'
    | 'registered_at'

export const DEFAULT_COLUMN_ORDER: PlayerColumnId[] = [
    'rank', 'player', 'role', 'points', 'world_records',
    'champion_medals', 'gold_medals', 'silver_medals', 'bronze_medals', 'registered_at',
]

export const DEFAULT_COLUMN_VISIBILITY: Record<PlayerColumnId, boolean> = {
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
    querySig: string | null
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
    querySig: null,
}
