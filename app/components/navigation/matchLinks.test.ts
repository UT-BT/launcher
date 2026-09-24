import { describe, expect, it } from 'vitest'
import { buildMatchLinks, matchStreamPath } from './matchLinks'

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
