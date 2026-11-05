import { describe, expect, it } from 'vitest'
import { normaliseGatewayServers } from '@/app/platform/gateway'
import {
    DEFAULT_FILTERS,
    filterServers,
    getGameStatusText,
    getServerType,
    isCertifiedServer,
    sanitizeServerFilters,
    sortServers,
    type FilterState,
    type Server,
} from './server-utils'

function server(id: string, overrides: Partial<Server> = {}): Server {
    return {
        id,
        ip: '192.0.2.1',
        hostname: `Server ${id}`,
        hostport: 7777,
        map_name: 'CTF-BT-Test',
        player_count: 0,
        max_players: 12,
        spectators: 0,
        time_limit_minutes: 0,
        remaining_time_seconds: 0,
        goal_team_score: 0,
        red_team_score: 0,
        blue_team_score: 0,
        certified_records: false,
        ruleset: 'casual',
        region: null,
        tournament: null,
        password_protected: null,
        players: [],
        ...overrides,
    }
}

const filters = (overrides: Partial<FilterState>): FilterState => ({ ...DEFAULT_FILTERS, ...overrides })

const ids = (servers: Server[]) => servers.map(row => row.id)

describe('getServerType', () => {
    it('is Duel for a certified server in tournament mode', () => {
        expect(getServerType(server('a', { ruleset: 'certified', tournament: true }))).toBe('Duel')
    })

    it('is Certified for a certified server outside tournament mode', () => {
        expect(getServerType(server('a', { ruleset: 'certified', tournament: false }))).toBe('Certified')
        expect(getServerType(server('b', { ruleset: 'certified', tournament: null }))).toBe('Certified')
    })

    it('is Casual for a casual server, even in tournament mode', () => {
        expect(getServerType(server('a', { ruleset: 'casual' }))).toBe('Casual')
        expect(getServerType(server('b', { ruleset: 'casual', tournament: true }))).toBe('Casual')
    })

    it('is Casual for a row from a gateway without the fields', () => {
        const [row] = normaliseGatewayServers([{ id: 'old', hostname: '[UTBT.NET] - BunnyTrack Certified Server #1 (Germany)', certified_records: true }])
        expect(getServerType(row)).toBe('Casual')
        expect(row.region).toBeNull()
        expect(row.password_protected).toBeNull()
    })

    it('ignores the name: a casual server named Certified or Duel is Casual', () => {
        expect(getServerType(server('a', { hostname: '[UTBT.NET] - BunnyTrack Certified Server #4 (US Seattle)' }))).toBe('Casual')
        expect(getServerType(server('b', { hostname: 'BunnyTrack Duel Server #1' }))).toBe('Casual')
    })

    it('ignores the name: a certified server named Casual is Certified', () => {
        expect(getServerType(server('a', { hostname: 'BunnyTrack Casual Server #1', ruleset: 'certified' }))).toBe('Certified')
    })
})

describe('isCertifiedServer', () => {
    it('reads the ruleset, not certified_records', () => {
        expect(isCertifiedServer(server('a', { ruleset: 'certified', certified_records: false }))).toBe(true)
        expect(isCertifiedServer(server('b', { ruleset: 'casual', certified_records: true }))).toBe(false)
    })
})

describe('getGameStatusText', () => {
    it('shows the time left while the match runs', () => {
        expect(getGameStatusText(server('a', { remaining_time_seconds: 125 }))).toBe('2:05 left')
    })

    it('is Overtime on a certified server once time runs out, whatever the score', () => {
        expect(getGameStatusText(server('a', { ruleset: 'certified', red_team_score: 2, blue_team_score: 1 }))).toBe('Overtime')
    })

    it('is Overtime on a casual server with a tied score, and Match Ended otherwise', () => {
        expect(getGameStatusText(server('a', { red_team_score: 1, blue_team_score: 1 }))).toBe('Overtime')
        expect(getGameStatusText(server('b', { red_team_score: 2, blue_team_score: 1 }))).toBe('Match Ended')
    })

    it('takes the certified state from the ruleset, not certified_records', () => {
        expect(getGameStatusText(server('a', { certified_records: true, red_team_score: 2, blue_team_score: 1 }))).toBe('Match Ended')
    })
})

describe('sortServers', () => {
    const rows = [
        server('casual', { ruleset: 'casual', region: 'Germany', hostname: 'BunnyTrack Certified Server #9' }),
        server('duel', { ruleset: 'certified', tournament: true, region: 'United Kingdom', hostname: 'Alpha' }),
        server('certified', { ruleset: 'certified', tournament: false, region: 'Australia', hostname: 'BunnyTrack Casual Server #1' }),
        server('none', { region: null, hostname: 'Zulu' }),
    ]

    it('sorts by type from the fields: Certified, Duel, then Casual', () => {
        expect(ids(sortServers(rows, 'type', 'asc'))).toEqual(['certified', 'duel', 'casual', 'none'])
        expect(ids(sortServers(rows, 'type', 'desc'))).toEqual(['none', 'casual', 'duel', 'certified'])
    })

    it('sorts by the region field, with no region last', () => {
        expect(ids(sortServers(rows, 'region', 'asc'))).toEqual(['certified', 'casual', 'duel', 'none'])
    })

    it('does not read the region from the name', () => {
        const named = [
            server('a', { hostname: 'Server (Australia)', region: 'Norway' }),
            server('b', { hostname: 'Server (Norway)', region: 'Australia' }),
        ]
        expect(ids(sortServers(named, 'region', 'asc'))).toEqual(['b', 'a'])
    })
})

describe('filterServers', () => {
    const rows = [
        server('casual', { ruleset: 'casual', region: 'Germany', hostname: 'BunnyTrack Certified Server #1 (Germany)' }),
        server('duel', { ruleset: 'certified', tournament: true, region: 'Germany' }),
        server('certified', { ruleset: 'certified', region: 'Australia', hostname: 'BunnyTrack Casual Server #1 (Germany)' }),
        server('none', { region: null, hostname: 'Server (Germany)' }),
    ]

    it('filters by type from the fields', () => {
        expect(ids(filterServers(rows, filters({ types: ['Certified'] }), new Set()))).toEqual(['certified'])
        expect(ids(filterServers(rows, filters({ types: ['Duel'] }), new Set()))).toEqual(['duel'])
        expect(ids(filterServers(rows, filters({ types: ['Casual'] }), new Set()))).toEqual(['casual', 'none'])
    })

    it('filters by the region field, never by the name', () => {
        expect(ids(filterServers(rows, filters({ regions: ['Germany'] }), new Set()))).toEqual(['casual', 'duel'])
        expect(ids(filterServers(rows, filters({ regions: ['Australia'] }), new Set()))).toEqual(['certified'])
    })

    it('combines type and region', () => {
        expect(ids(filterServers(rows, filters({ types: ['Certified', 'Duel'], regions: ['Germany'] }), new Set()))).toEqual(['duel'])
    })
})

describe('sanitizeServerFilters', () => {
    it('drops the retired Unknown type from stored filters', () => {
        expect(sanitizeServerFilters({ types: ['Unknown', 'Duel'] }).types).toEqual(['Duel'])
    })
})
