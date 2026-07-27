import { describe, expect, it } from 'vitest'
import { normaliseGatewayServers } from './gateway'

describe('normaliseGatewayServers', () => {
    it('returns [] for non-array payloads', () => {
        expect(normaliseGatewayServers(undefined)).toEqual([])
        expect(normaliseGatewayServers(null)).toEqual([])
        expect(normaliseGatewayServers({})).toEqual([])
        expect(normaliseGatewayServers('oops')).toEqual([])
    })

    it('drops entries without a usable identity', () => {
        expect(normaliseGatewayServers([null, 'x', {}, { player_count: 3 }])).toEqual([])
    })

    it('keeps a hostname-only row and derives its id from the hostname', () => {
        const [server] = normaliseGatewayServers([{ hostname: 'UTBT Duel #1' }])
        expect(server.id).toBe('UTBT Duel #1')
        expect(server.players).toEqual([])
    })

    it('defaults missing fields on a partially scraped server', () => {
        const [server] = normaliseGatewayServers([{ id: 1, ip: '10.0.0.1' }])
        expect(server.id).toBe('1')
        expect(server.hostname).toBe('')
        expect(server.map_name).toBe('')
        expect(server.players).toEqual([])
        expect(server.player_count).toBe(0)
        expect(server.max_players).toBe(0)
        expect(server.spectators).toBe(0)
    })

    it('coerces numeric strings and normalises player rows', () => {
        const [server] = normaliseGatewayServers([{
            id: 's1',
            ip: '10.0.0.1',
            player_count: '3',
            players: [null, { name: 7, ping: '12', is_spectator: 1 }, { id: 2, name: 'Bob' }],
        }])
        expect(server.player_count).toBe(3)
        expect(server.players).toHaveLength(2)
        expect(server.players[0].name).toBe('')
        expect(server.players[0].ping).toBe(12)
        expect(server.players[0].is_spectator).toBe(true)
        expect(server.players[1].id).toBe('2')
        expect(server.players[1].name).toBe('Bob')
        expect(server.players[1].is_spectator).toBe(false)
    })

    it('derives an id from ip and port when id is missing', () => {
        const [server] = normaliseGatewayServers([{ ip: '10.0.0.1', hostport: 7777 }])
        expect(server.id).toBe('10.0.0.1:7777')
    })
})
