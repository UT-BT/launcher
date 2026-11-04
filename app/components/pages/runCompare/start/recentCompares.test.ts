import { describe, expect, it } from 'vitest'
import { cleanRecentName, parseRecent, RECENT_LIMIT, RECENT_NAME_MAX, recentEntry, recentLabel, renamedRecent, withRecent, type RecentCompare } from './recentCompares'

const A = 'a1a1a1a1-0000-4000-8000-0000000000a1'
const B = 'b2b2b2b2-0000-4000-8000-0000000000b2'
const C = 'c3c3c3c3-0000-4000-8000-0000000000c3'

function entry(query: string, at = 1): RecentCompare {
    return recentEntry({ query, title: 'a vs b on Map', map: 'CTF-BT-Map', runs: 2, team: false }, at)!
}

describe('the recent comparisons on the start view', () => {
    it('keys a set by its runs in any order and drops the start time from the link', () => {
        const first = entry(`runs=${A},${B}&t=12.5`)
        const reordered = entry(`runs=${B},${A}`)

        expect(first.key).toBe(reordered.key)
        expect(first.query).not.toContain('t=')
        expect(first.query).toContain(A)
    })

    it('keeps nothing for a link without runs', () => {
        expect(recentEntry({ query: 'map=CTF-BT-Map', title: 'x', map: 'CTF-BT-Map', runs: 0, team: false }, 1)).toBeNull()
    })

    it('puts the latest first, moves a repeated set to the top and keeps the newest few', () => {
        const ab = entry(`runs=${A},${B}`, 1)
        const ac = entry(`runs=${A},${C}`, 2)
        const again = entry(`runs=${B},${A}`, 3)

        const list = withRecent(withRecent(withRecent([], ab), ac), again)
        expect(list.map(item => item.at)).toEqual([3, 2])

        let many: RecentCompare[] = []
        for (let i = 0; i < RECENT_LIMIT + 3; i++) many = withRecent(many, { ...ab, key: `k${i}`, at: i })
        expect(many).toHaveLength(RECENT_LIMIT)
        expect(many[0].at).toBe(RECENT_LIMIT + 2)
    })

    it('keeps a name the player gave a set when the set is opened again', () => {
        const named = renamedRecent([entry(`runs=${A},${B}`, 1)], entry(`runs=${A},${B}`).key, '  Bun   vs the WR ')
        expect(named[0].name).toBe('Bun vs the WR')

        const reopened = withRecent(named, entry(`runs=${B},${A}`, 5))
        expect(reopened).toHaveLength(1)
        expect(reopened[0]).toMatchObject({ name: 'Bun vs the WR', at: 5 })
    })

    it('clears a blank name and trims a long one', () => {
        expect(cleanRecentName('   ')).toBeNull()
        expect(cleanRecentName('x'.repeat(RECENT_NAME_MAX + 10))).toHaveLength(RECENT_NAME_MAX)
    })

    it('labels a set by its name, else by its runs without the map', () => {
        const plain = entry(`runs=${A},${B}`)
        expect(recentLabel(plain, 'Map')).toBe('a vs b')
        expect(recentLabel({ ...plain, name: 'Race night' }, 'Map')).toBe('Race night')
    })

    it('reads back only well-formed entries', () => {
        const good = entry(`runs=${A},${B}`)
        expect(parseRecent(JSON.stringify([good, { key: 1 }, null, 'x']))).toEqual([good])
        const { name: _name, ...unnamed } = good
        expect(parseRecent(JSON.stringify([unnamed]))).toEqual([{ ...good, name: null }])
        expect(parseRecent('{oops')).toEqual([])
        expect(parseRecent(null)).toEqual([])
        expect(parseRecent(JSON.stringify({ key: 'x' }))).toEqual([])
    })
})
