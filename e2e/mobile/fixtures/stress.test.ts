import { describe, expect, it } from 'vitest'
import { stressed, STRESS_VARIANTS } from './stress'

const LIST = {
    success: true,
    data: [
        { id: 'c1', map: 'CTF-BT-Aurora', alias: 'Velocity', user: '11', cap_time_seconds: 41.2, team: null, notes: '' },
        { id: 'c2', map: 'CTF-BT-Basalt', alias: 'Hopper', user: '12', cap_time_seconds: 50.5, team: 'Red Rockets', notes: 'clean' },
        { id: 'c3', map: 'CTF-BT-Cobalt', alias: null, user: '13', cap_time_seconds: 60 },
    ],
}

type Row = Record<string, unknown>

const DETAIL = { success: true, data: { cap: { id: 'c1', map: 'CTF-BT-Aurora', alias: 'Velocity' }, checkpoints: [{ index: 1, seconds: 3.2 }], count: 3 } }

describe('stress variants', () => {
    it('names four variants', () => {
        expect([...STRESS_VARIANTS]).toEqual(['long-text', 'most-columns', 'empty', 'single-row'])
    })

    it('long-text stretches the aliases, names and map names in every row, keeping ids and numbers', () => {
        const rows = (stressed('long-text', LIST) as typeof LIST).data
        expect(rows[0].map).toBe('CTF-BT-Aurora-RemasteredWithAnExtraordinarilyLongMapNameEdition')
        expect(rows[0].alias).toBe('Velocity-TheUnbelievablyLongPlayerAliasOfDoom')
        expect(rows[1].team).toBe('Red Rockets')
        expect(rows[2].alias).toBeNull()
        expect(rows.map(row => [row.id, row.user, row.cap_time_seconds])).toEqual([['c1', '11', 41.2], ['c2', '12', 50.5], ['c3', '13', 60]])
    })

    it('long-text leaves a detail object alone, so the page still finds its own record', () => {
        expect((stressed('long-text', DETAIL) as typeof DETAIL).data.cap).toEqual(DETAIL.data.cap)
    })

    it('most-columns fills every empty optional field from another row', () => {
        const rows = (stressed('most-columns', LIST) as typeof LIST).data
        expect(rows[0]).toEqual({ id: 'c1', map: 'CTF-BT-Aurora', alias: 'Velocity', user: '11', cap_time_seconds: 41.2, team: 'Red Rockets', notes: 'clean' })
        expect(rows[2]).toEqual({ id: 'c3', map: 'CTF-BT-Cobalt', alias: 'Velocity', user: '13', cap_time_seconds: 60, team: 'Red Rockets', notes: 'clean' })
    })

    it('most-columns leaves a missing list missing, so a row keeps its kind', () => {
        const rows = (stressed('most-columns', { data: [{ alias: 'Solo', members: null }, { alias: null, members: [{ alias: 'A' }, { alias: 'B' }] }] }) as { data: Row[] }).data
        expect(rows[0]).toEqual({ alias: 'Solo', members: null })
    })

    it('empty clears every list and zeroes counts', () => {
        expect(stressed('empty', LIST)).toEqual({ success: true, data: [] })
        expect(stressed('empty', DETAIL)).toEqual({ success: true, data: { cap: DETAIL.data.cap, checkpoints: [], count: 0 } })
    })

    it('single-row keeps the first row of every list and counts one', () => {
        expect(stressed('single-row', LIST)).toEqual({ success: true, data: [LIST.data[0]] })
        expect((stressed('single-row', DETAIL) as typeof DETAIL).data.count).toBe(1)
    })

    it('leaves non-JSON and scalar bodies alone', () => {
        expect(stressed('empty', undefined)).toBeUndefined()
        expect(stressed('long-text', 'plain')).toBe('plain')
    })
})
