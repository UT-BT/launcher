import { describe, expect, it } from 'vitest'
import { buildMatchLinks, matchStreamPath, parseStreamPath } from './matchLinks'

describe('buildMatchLinks', () => {
    it('returns absolute public-origin player and stream links', () => {
        const links = buildMatchLinks('2v2-cup-2026', '77')

        expect(links.playerLink).toBe('https://utbt.net/events/2v2-cup-2026/matches/77')
        expect(links.streamLink).toBe('https://utbt.net/events/2v2-cup-2026/matches/77/stream')
    })

    it('encodes slug and match id segments', () => {
        const links = buildMatchLinks('groups a', 'id/with slash')

        expect(links.playerLink).toBe('https://utbt.net/events/groups%20a/matches/id%2Fwith%20slash')
        expect(links.streamLink).toBe('https://utbt.net/events/groups%20a/matches/id%2Fwith%20slash/stream')
    })

    it('never varies with the build target — desktop has no usable site origin at runtime', () => {
        const links = buildMatchLinks('2v2-cup-2026', '77')

        expect(links.playerLink.startsWith('https://utbt.net')).toBe(true)
        expect(links.streamLink.startsWith('https://utbt.net')).toBe(true)
    })
})

describe('matchStreamPath', () => {
    it('nests the stream path under the pick/ban page path', () => {
        expect(matchStreamPath('2v2-cup-2026', '77')).toBe('/events/2v2-cup-2026/matches/77/stream')
    })
})

describe('parseStreamPath', () => {
    it('round-trips a path built by matchStreamPath', () => {
        expect(parseStreamPath(matchStreamPath('2v2-cup-2026', '77'))).toEqual({
            eventSlug: '2v2-cup-2026',
            matchId: '77',
        })
    })

    it('decodes encoded slug and match id segments', () => {
        expect(parseStreamPath('/events/groups%20a/matches/id%2Fwith%20slash/stream')).toEqual({
            eventSlug: 'groups a',
            matchId: 'id/with slash',
        })
    })

    it('returns null for the plain pick/ban page path', () => {
        expect(parseStreamPath('/events/2v2-cup-2026/matches/77')).toBeNull()
    })

    it('returns null for an unrelated path', () => {
        expect(parseStreamPath('/events/2v2-cup-2026')).toBeNull()
        expect(parseStreamPath('/')).toBeNull()
    })

    it('returns null for a path with the stream segment in the wrong place', () => {
        expect(parseStreamPath('/events/2v2-cup-2026/matches/77/stream/extra')).toBeNull()
    })

    it('does not throw on a malformed percent escape', () => {
        expect(() => parseStreamPath('/events/%/matches/77/stream')).not.toThrow()
    })
})
