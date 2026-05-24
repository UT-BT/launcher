import { Server } from '@/app/components/pages/ServerBrowserPage'

export type ServerType = 'Certified' | 'Duel' | 'Casual' | 'Unknown'
export type SortOption = 'Players' | 'Ping'
export type FilterState = {
    types: Record<ServerType, boolean>
    hideEmpty: boolean
    hideFull: boolean
    regions: Record<string, boolean>
}

export const DEFAULT_FILTERS: FilterState = {
    types: { Certified: true, Duel: true, Casual: true, Unknown: true },
    hideEmpty: false,
    hideFull: false,
    regions: {}
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

export const sortServers = (servers: Server[], option: SortOption): Server[] => {
    return [...servers].sort((a, b) => {
        switch (option) {
            case 'Players':
                if (a.player_count !== b.player_count) return b.player_count - a.player_count
                return b.max_players - a.max_players
            case 'Ping': {
                const pingA = a.ping || 9999
                const pingB = b.ping || 9999
                return pingA - pingB
            }
            default:
                return 0
        }
    })
}

export const filterServers = (servers: Server[], filters: FilterState): Server[] => {
    return servers.filter(server => {
        const type = getServerType(server.hostname)
        if (!filters.types[type]) return false

        if (filters.hideEmpty && server.player_count === 0) return false
        if (filters.hideFull && server.player_count >= server.max_players) return false

        const region = getServerRegion(server.hostname)
        if (filters.regions[region] === false) return false

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
