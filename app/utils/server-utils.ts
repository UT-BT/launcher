import { asStringArray, type ActiveTitle, type ServerListingFields } from '@/app/utils/api'

export interface ServerPlayer {
    id: string
    name: string
    ping: number
    time: number
    team: number
    deaths: number
    is_spectator: boolean
    alias?: string | null
    active_title?: ActiveTitle | null
}

export interface Server extends ServerListingFields {
    id: string
    ip: string
    hostname: string
    hostport: number
    map_name: string
    player_count: number
    max_players: number
    spectators: number
    time_limit_minutes: number
    remaining_time_seconds: number
    goal_team_score: number
    red_team_score: number
    blue_team_score: number
    certified_records: boolean
    players: ServerPlayer[]
    ping?: number
}

export type ServerType = 'Certified' | 'Duel' | 'Casual'
export type ServerSortField =
    | 'type' | 'name' | 'map' | 'region' | 'ping' | 'players' | 'spectators'
export type SortDir = 'asc' | 'desc'
export type CapacityValue = 'empty' | 'full' | 'has-players'

export interface FilterState {
    types: ServerType[]
    regions: string[]
    capacity: CapacityValue[]
    favoritesOnly: boolean
}

export const DEFAULT_FILTERS: FilterState = {
    types: [],
    regions: [],
    capacity: [],
    favoritesOnly: false,
}

const SERVER_TYPE_VALUES = new Set<string>(['Certified', 'Duel', 'Casual'])
const CAPACITY_VALUES = new Set<string>(['empty', 'full', 'has-players'])

export function sanitizeServerFilters(v: unknown): FilterState {
    if (!v || typeof v !== 'object' || Array.isArray(v)) return { ...DEFAULT_FILTERS }
    const raw = v as Record<string, unknown>
    return {
        types: asStringArray(raw.types).filter((t): t is ServerType => SERVER_TYPE_VALUES.has(t)),
        regions: asStringArray(raw.regions),
        capacity: asStringArray(raw.capacity).filter((c): c is CapacityValue => CAPACITY_VALUES.has(c)),
        favoritesOnly: Boolean(raw.favoritesOnly),
    }
}

export interface ServerPresetFilters {
    filters: FilterState
    sortBy: ServerSortField
    sortDir: SortDir
}

export interface ServerPreset {
    id: string
    name: string
    filters: ServerPresetFilters
}

const TYPE_RANK: Record<ServerType, number> = {
    Certified: 0,
    Duel: 1,
    Casual: 2,
}

export const trimServerName = (originalName: string): string => {
    const match = originalName.match(/BunnyTrack\s+(.+?)\s+Server\s+(#\d+)/i)
    if (match) {
        return `${match[1]} ${match[2]}`
    }

    return originalName.replace(/^\[UTBT\.NET\]\s*-\s*/i, '').trim()
}

export const isCertifiedServer = (server: Pick<Server, 'ruleset'>): boolean =>
    server.ruleset === 'certified'

export const getServerType = (server: Pick<Server, 'ruleset' | 'tournament'>): ServerType => {
    if (!isCertifiedServer(server)) return 'Casual'
    return server.tournament === true ? 'Duel' : 'Certified'
}

const compareRegions = (a: string | null, b: string | null): number => {
    if (a === b) return 0
    if (a === null) return 1
    if (b === null) return -1
    return a.localeCompare(b)
}

export const sortServers = (
    servers: Server[],
    sortBy: ServerSortField,
    sortDir: SortDir,
): Server[] => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...servers].sort((a, b) => {
        let cmp = 0
        switch (sortBy) {
            case 'type': {
                cmp = TYPE_RANK[getServerType(a)] - TYPE_RANK[getServerType(b)]
                break
            }
            case 'name':
                cmp = trimServerName(a.hostname).localeCompare(trimServerName(b.hostname))
                break
            case 'map':
                cmp = a.map_name.localeCompare(b.map_name)
                break
            case 'region':
                cmp = compareRegions(a.region, b.region)
                break
            case 'ping':
                cmp = (a.ping ?? Number.POSITIVE_INFINITY) - (b.ping ?? Number.POSITIVE_INFINITY)
                break
            case 'players':
                cmp = a.player_count - b.player_count
                if (cmp === 0) cmp = a.max_players - b.max_players
                break
            case 'spectators':
                cmp = a.spectators - b.spectators
                break
        }
        if (cmp === 0) cmp = trimServerName(a.hostname).localeCompare(trimServerName(b.hostname))
        return cmp * dir
    })
}

export const filterServers = (
    servers: Server[],
    filters: FilterState,
    favoriteServerIds: Set<string>,
): Server[] => {
    return servers.filter(server => {
        if (filters.types.length > 0) {
            if (!filters.types.includes(getServerType(server))) return false
        }

        if (filters.regions.length > 0) {
            if (server.region === null || !filters.regions.includes(server.region)) return false
        }

        if (filters.capacity.length > 0) {
            const isEmpty = server.player_count === 0
            const isFull = server.player_count >= server.max_players
            const hasPlayers = server.player_count > 0 && !isFull
            const matches =
                (filters.capacity.includes('empty') && isEmpty) ||
                (filters.capacity.includes('full') && isFull) ||
                (filters.capacity.includes('has-players') && hasPlayers)
            if (!matches) return false
        }

        if (filters.favoritesOnly && !favoriteServerIds.has(server.id)) {
            return false
        }

        return true
    })
}

export const getRegionFlag = (region: string): string => {
    const normalizedRegion = region.toLowerCase().trim()

    const regionMap: Record<string, string> = {
        'united kingdom': 'gb',
        'uk': 'gb',
        'great britain': 'gb',
        'germany': 'de',
        'de': 'de',
        'poland': 'pl',
        'pl': 'pl',
        'netherlands': 'nl',
        'nl': 'nl',
        'norway': 'no',
        'no': 'no',
        'australia': 'au',
        'au': 'au',
        'united states': 'us',
        'usa': 'us',
        'us': 'us',
        'us miami': 'us',
        'brazil': 'br',
        'br': 'br',
        'hungary': 'hu',
        'hu': 'hu',
        'france': 'fr',
        'fr': 'fr',
        'spain': 'es',
        'es': 'es',
        'canada': 'ca',
        'ca': 'ca',
        'russia': 'ru',
        'ru': 'ru',
        'chile': 'cl',
        'cl': 'cl',
        'argentina': 'ar',
        'ar': 'ar',
        'sweden': 'se',
        'se': 'se',
        'finland': 'fi',
        'fi': 'fi',
        'denmark': 'dk',
        'dk': 'dk',
        'italy': 'it',
        'it': 'it',
        'belgium': 'be',
        'be': 'be',
        'middle east': 'aq'
    }

    const code = regionMap[normalizedRegion] || 'aq'
    return `https://flagcdn.com/w40/${code}.png`
}

export const getGameStatusText = (
    server: Pick<Server, 'remaining_time_seconds' | 'ruleset' | 'red_team_score' | 'blue_team_score'>,
): string => {
    const remainingTime = server.remaining_time_seconds
    if (remainingTime > 0) {
        const m = Math.floor(remainingTime / 60)
        const s = remainingTime % 60
        return `${m}:${s.toString().padStart(2, '0')} left`
    }

    if (isCertifiedServer(server)) {
        return 'Overtime'
    }

    if (server.red_team_score === server.blue_team_score) {
        return 'Overtime'
    }

    return 'Match Ended'
}
