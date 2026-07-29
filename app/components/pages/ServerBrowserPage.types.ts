import {
    DEFAULT_FILTERS,
    type FilterState,
    type Server,
    type ServerSortField,
    type SortDir,
} from '@/app/utils/server-utils'

export type ServerColumnId =
    | 'thumbnail' | 'type' | 'name' | 'map' | 'region' | 'ping'
    | 'players' | 'spectators' | 'status' | 'actions'

export interface ServerBrowserState {
    filters: FilterState
    sortBy: ServerSortField
    sortDir: SortDir
    filtersPanelOpen: boolean
    columnVisibility: Record<ServerColumnId, boolean>
    columnOrder: ServerColumnId[]
    scrollTop: number
}

export interface ServerBrowserCaches {
    servers: Server[]
    lastRefreshIso: string | null
}

export const DEFAULT_COLUMN_ORDER: ServerColumnId[] = [
    'thumbnail', 'type', 'name', 'map', 'region', 'ping', 'players', 'spectators', 'status', 'actions',
]

export const DEFAULT_COLUMN_VISIBILITY: Record<ServerColumnId, boolean> = {
    thumbnail: true,
    type: true,
    name: true,
    map: true,
    region: true,
    ping: true,
    players: true,
    spectators: true,
    status: true,
    actions: true,
}

export const DEFAULT_SERVERS_STATE: ServerBrowserState = {
    filters: DEFAULT_FILTERS,
    sortBy: 'players',
    sortDir: 'desc',
    filtersPanelOpen: false,
    columnVisibility: DEFAULT_COLUMN_VISIBILITY,
    columnOrder: DEFAULT_COLUMN_ORDER,
    scrollTop: 0,
}

export const DEFAULT_SERVERS_CACHES: ServerBrowserCaches = {
    servers: [],
    lastRefreshIso: null,
}
