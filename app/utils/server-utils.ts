import { Server } from '@/app/components/pages/ServerBrowserPage'

export type ServerType = 'Certified' | 'Duel' | 'Casual' | 'Unknown'
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

const SERVER_TYPE_VALUES = new Set<string>(['Certified', 'Duel', 'Casual', 'Unknown'])
const CAPACITY_VALUES = new Set<string>(['empty', 'full', 'has-players'])

const asStringArray = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []

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

export interface RecentServerEntry {
    id: string
    ip: string
    hostport: number
    hostname: string
    lastJoinedAt: string
}

export const RECENT_SERVERS_STORAGE_KEY = 'utbt:recentServers:v1'
const MAX_RECENT_SERVERS = 5

export function readRecentServers(): RecentServerEntry[] {
    try {
        const raw = localStorage.getItem(RECENT_SERVERS_STORAGE_KEY)
        if (!raw) return []
        const parsed = JSON.parse(raw)
        if (!Array.isArray(parsed)) return []
        return parsed
            .filter((row): row is RecentServerEntry => (
                row &&
                typeof row.id === 'string' &&
                typeof row.ip === 'string' &&
                typeof row.hostport === 'number' &&
                typeof row.hostname === 'string' &&
                typeof row.lastJoinedAt === 'string'
            ))
            .slice(0, MAX_RECENT_SERVERS)
    } catch {
        return []
    }
}

export function rememberRecentServer(server: Pick<Server, 'id' | 'ip' | 'hostport' | 'hostname'>): RecentServerEntry[] {
    const entry: RecentServerEntry = {
        id: server.id,
        ip: server.ip,
        hostport: server.hostport,
        hostname: server.hostname,
        lastJoinedAt: new Date().toISOString(),
    }
    const next = [entry, ...readRecentServers().filter(s => s.id !== server.id)].slice(0, MAX_RECENT_SERVERS)
    localStorage.setItem(RECENT_SERVERS_STORAGE_KEY, JSON.stringify(next))
    return next
}

export function forgetRecentServer(serverId: string): RecentServerEntry[] {
    const next = readRecentServers().filter(server => server.id !== serverId)
    localStorage.setItem(RECENT_SERVERS_STORAGE_KEY, JSON.stringify(next))
    return next
}

const TYPE_RANK: Record<ServerType, number> = {
    Certified: 0,
    Duel: 1,
    Casual: 2,
    Unknown: 3,
}

export const trimServerName = (originalName: string): string => {
    const match = originalName.match(/BunnyTrack\s+(.+?)\s+Server\s+(#\d+)/i)
    if (match) {
        return `${match[1]} ${match[2]}`
    }

    return originalName.replace(/^\[UTBT\.NET\]\s*-\s*/i, '').trim()
}

export const getServerType = (name: string): ServerType => {
    const lowerName = name.toLowerCase()
    if (lowerName.includes('certified')) return 'Certified'
    if (lowerName.includes('duel')) return 'Duel'
    if (lowerName.includes('casual')) return 'Casual'
    return 'Unknown'
}

export const getServerRegion = (name: string): string => {
    const match = name.match(/\(([^)]+)\)$/)
    return match ? match[1] : 'Unknown'
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
                cmp = TYPE_RANK[getServerType(a.hostname)] - TYPE_RANK[getServerType(b.hostname)]
                break
            }
            case 'name':
                cmp = trimServerName(a.hostname).localeCompare(trimServerName(b.hostname))
                break
            case 'map':
                cmp = a.map_name.localeCompare(b.map_name)
                break
            case 'region':
                cmp = getServerRegion(a.hostname).localeCompare(getServerRegion(b.hostname))
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
            const type = getServerType(server.hostname)
            if (!filters.types.includes(type)) return false
        }

        if (filters.regions.length > 0) {
            const region = getServerRegion(server.hostname)
            if (!filters.regions.includes(region)) return false
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
    remainingTime: number,
    isCertified: boolean,
    type: ServerType,
    redScore: number,
    blueScore: number
): string => {
    if (remainingTime > 0) {
        const m = Math.floor(remainingTime / 60)
        const s = remainingTime % 60
        return `${m}:${s.toString().padStart(2, '0')} left`
    }

    if (isCertified) {
        return 'Overtime'
    }

    if ((type === 'Duel' || type === 'Casual') && redScore === blueScore) {
        return 'Overtime'
    }

    return 'Match Ended'
}
