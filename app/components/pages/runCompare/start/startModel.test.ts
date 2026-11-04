import { describe, expect, it } from 'vitest'
import type { Map as MapRow, Record as WorldRecord } from '@/app/utils/api'
import { addPicks, mapPicks, mapQuery, pickedQuery, recordPicks, searchTermOf, teamSizeLabel, togglePick } from './startModel'

function mapRow(name: string, players = 1): MapRow {
    return { name, added: '2026-01-01', difficulty: 3, active: true, author: 'someone', required_players: players, screenshot_updated: null }
}

function record(map: string, alias: string, extra: Partial<WorldRecord> = {}): WorldRecord {
    return { cap_id: `${map}-${alias}`, user_id: `${alias}-id`, map, added: '2026-11-01', cap_time_seconds: 23.474, alias, active_title: null, ...extra }
}

describe('the map step', () => {
    it('searches once the term has two letters', () => {
        expect(searchTermOf(' a ')).toBeNull()
        expect(searchTermOf(' pu ')).toBe('pu')
    })

    it('links a picked map to an empty comparison on it', () => {
        expect(mapQuery('CTF-BT-(Fran)PureJump')).toBe('map=CTF-BT-(Fran)PureJump')
    })

    it('labels team maps by their size and lists each map once', () => {
        expect(teamSizeLabel(1)).toBeNull()
        expect(teamSizeLabel(2)).toBe('2-player')
        expect(mapPicks([mapRow('CTF-BT-A'), mapRow('CTF-BT-B', 2), mapRow('CTF-BT-A')])).toEqual([
            { name: 'CTF-BT-A', team: null, version: null },
            { name: 'CTF-BT-B', team: '2-player', version: null },
        ])
    })
})

describe('the latest records', () => {
    it('keeps the newest record of each map up to the limit', () => {
        const picks = recordPicks([record('CTF-BT-A', 'one'), record('CTF-BT-A', 'two'), record('CTF-BT-B', 'three'), record('CTF-BT-C', 'four')], 2)
        expect(picks.map(pick => [pick.map, pick.holders[0].alias])).toEqual([['CTF-BT-A', 'one'], ['CTF-BT-B', 'three']])
    })

    it('shows a team record by its first members and counts the rest', () => {
        const member = (alias: string) => ({ user: `${alias}-id`, alias, cap_id: alias, cap_time_seconds: 40, verified: true, active_title: null })
        const [pick] = recordPicks([record('CTF-BT-T', 'lead', { members: [member('a'), member('b'), member('c')] })])
        expect(pick.team).toBe('3-player')
        expect(pick.holders.map(holder => holder.alias)).toEqual(['a', 'b'])
        expect(pick.more).toBe(1)
    })

    it('shows a solo record by its holder', () => {
        const [pick] = recordPicks([record('CTF-BT-S', 'solo')])
        expect(pick).toEqual({ map: 'CTF-BT-S', seconds: 23.474, team: null, holders: [{ user: 'solo-id', alias: 'solo', title: null }], more: 0 })
    })
})

describe('picking runs before comparing', () => {
    it('toggles a run in and out, keeping pick order, and stops at the limit', () => {
        expect(togglePick([], 'a', 2)).toEqual(['a'])
        expect(togglePick(['a'], 'b', 2)).toEqual(['a', 'b'])
        expect(togglePick(['a', 'b'], 'c', 2)).toEqual(['a', 'b'])
        expect(togglePick(['a', 'b'], 'a', 2)).toEqual(['b'])
    })

    it('adds a quick pick without repeats and up to the limit', () => {
        expect(addPicks(['b'], ['a', 'b', 'c', 'd'], 3)).toEqual(['b', 'a', 'c'])
    })

    it('links the picked runs as the set to compare', () => {
        expect(pickedQuery(['a1a1a1a1-0000-4000-8000-0000000000a1'])).toBe('runs=a1a1a1a1-0000-4000-8000-0000000000a1')
    })
})
