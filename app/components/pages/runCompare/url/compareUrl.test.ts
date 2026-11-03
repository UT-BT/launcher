import { describe, expect, it } from 'vitest'
import { parseCompareQuery, serializeCompareQuery } from './compareUrl'

const A = '0a0a0a0a-0000-4000-8000-00000000000a'
const B = '0b0b0b0b-0000-4000-8000-00000000000b'
const C = '0c0c0c0c-0000-4000-8000-00000000000c'
const M1 = '1d1d1d1d-0000-4000-8000-0000000000d1'
const M2 = '2d2d2d2d-0000-4000-8000-0000000000d2'

describe('the compare url round trip', () => {
    it('reads every parameter and writes it back in grammar order', () => {
        const query = `runs=${A},${B},${C}&ref=${B}&data=${C}&off=${A}:-250&pair=${M1}:${M2}&drive=${M1}&sync=position&t=12.500`
        const { state, notices } = parseCompareQuery(query, new Set([M1, M2]))

        expect(notices).toEqual([])
        expect(state).toEqual({
            runs: [A, B, C],
            refs: [B],
            data: [C],
            offsets: [{ capId: A, ms: -250 }],
            pairs: [{ runner: M1, reference: M2 }],
            drive: M1,
            sync: 'position',
            t: 12.5,
        })
        expect(serializeCompareQuery(state)).toBe(query)
    })

    it('writes parameters in grammar order whatever order they arrived in', () => {
        const { state } = parseCompareQuery(`t=3.000&sync=position&ref=${A}&runs=${A},${B}`)
        expect(serializeCompareQuery(state)).toBe(`runs=${A},${B}&ref=${A}&sync=position&t=3.000`)
    })

    it('omits empty parameters and the race sync mode', () => {
        const { state } = parseCompareQuery(`runs=${B},${A}&ref=&data=&sync=`)
        expect(serializeCompareQuery(state)).toBe(`runs=${B},${A}`)
    })

    it('keeps add order rather than sorting', () => {
        const { state } = parseCompareQuery(`runs=${C},${A},${B}`)
        expect(state.runs).toEqual([C, A, B])
    })

    it('reads an escaped comma list and a leading question mark', () => {
        const { state } = parseCompareQuery(`?runs=${A}%2C${B}`)
        expect(state.runs).toEqual([A, B])
    })

    it('reads an empty query as an empty comparison', () => {
        const { state, notices } = parseCompareQuery('')
        expect(state.runs).toEqual([])
        expect(notices).toEqual([])
        expect(serializeCompareQuery(state)).toBe('')
    })
})

function ids(count: number): string[] {
    return Array.from({ length: count }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`)
}

describe('normalising the run list', () => {
    it('drops a malformed id with a notice', () => {
        const { state, notices } = parseCompareQuery(`runs=${A},not-a-cap,${B}`)
        expect(state.runs).toEqual([A, B])
        expect(notices).toEqual([{ param: 'runs', reason: 'malformed', value: 'not-a-cap' }])
    })

    it('drops a repeated run with a notice and keeps the first', () => {
        const { state, notices } = parseCompareQuery(`runs=${A},${B},${A}`)
        expect(state.runs).toEqual([A, B])
        expect(notices).toEqual([{ param: 'runs', reason: 'duplicate', value: A }])
    })

    it('reads ids case-insensitively, so an upper-case copy is a duplicate', () => {
        const { state, notices } = parseCompareQuery(`runs=${A.toUpperCase()},${A}`)
        expect(state.runs).toEqual([A])
        expect(notices).toEqual([{ param: 'runs', reason: 'duplicate', value: A }])
    })

    it('keeps the first 10 runs and drops each run past the cap with a notice', () => {
        const all = ids(12)
        const { state, notices } = parseCompareQuery(`runs=${all.join(',')}`)
        expect(state.runs).toEqual(all.slice(0, 10))
        expect(notices).toEqual([
            { param: 'runs', reason: 'over-cap', value: all[10] },
            { param: 'runs', reason: 'over-cap', value: all[11] },
        ])
    })

    it('counts the cap after dropping malformed ids and duplicates', () => {
        const all = ids(10)
        const { state } = parseCompareQuery(`runs=bad,${all[0]},${all[0]},${all.slice(1).join(',')}`)
        expect(state.runs).toEqual(all)
    })
})

describe('entries pointing outside the set', () => {
    it('drops a reference that is not one of the runs', () => {
        const { state, notices } = parseCompareQuery(`runs=${A},${B}&ref=${C},${A}`)
        expect(state.refs).toEqual([A])
        expect(notices).toEqual([{ param: 'ref', reason: 'outside-set', value: C }])
    })

    it('drops a data-only entry outside the runs and their members', () => {
        const { state, notices } = parseCompareQuery(`runs=${A}&data=${M1},${C}`, new Set([M1]))
        expect(state.data).toEqual([M1])
        expect(notices).toEqual([{ param: 'data', reason: 'outside-set', value: C }])
    })

    it('drops an offset outside the set, a non-integer offset and a second offset for one run', () => {
        const { state, notices } = parseCompareQuery(`runs=${A}&off=${A}:120,${C}:40,${A}:12.5,${A}:80`)
        expect(state.offsets).toEqual([{ capId: A, ms: 120 }])
        expect(notices).toEqual([
            { param: 'off', reason: 'outside-set', value: C },
            { param: 'off', reason: 'malformed', value: `${A}:12.5` },
            { param: 'off', reason: 'duplicate', value: A },
        ])
    })

    it('drops a pairing whose members are not in the set, and a member paired twice', () => {
        const { state, notices } = parseCompareQuery(`runs=${A}&pair=${M1}:${M2},${M1}:${C},${C}:${M2}`, new Set([M1, M2]))
        expect(state.pairs).toEqual([{ runner: M1, reference: M2 }])
        expect(notices).toEqual([
            { param: 'pair', reason: 'duplicate', value: `${M1}:${C}` },
            { param: 'pair', reason: 'duplicate', value: `${C}:${M2}` },
        ])
    })

    it('drops every pairing and the driving pair on a set with no members', () => {
        const { state, notices } = parseCompareQuery(`runs=${A},${B}&pair=${A}:${B}&drive=${A}`)
        expect(state.pairs).toEqual([])
        expect(state.drive).toBeNull()
        expect(notices).toEqual([
            { param: 'pair', reason: 'outside-set', value: `${A}:${B}` },
            { param: 'drive', reason: 'outside-set', value: A },
        ])
    })

    it('drops a malformed reference and a malformed pairing', () => {
        const { notices } = parseCompareQuery(`runs=${A}&ref=xyz&pair=${M1}`, new Set([M1]))
        expect(notices).toEqual([
            { param: 'ref', reason: 'malformed', value: 'xyz' },
            { param: 'pair', reason: 'malformed', value: M1 },
        ])
    })

    it('drops entries that pointed at runs dropped from the list', () => {
        const all = ids(11)
        const { state, notices } = parseCompareQuery(`runs=${all.join(',')}&ref=${all[10]}`)
        expect(state.refs).toEqual([])
        expect(notices).toContainEqual({ param: 'ref', reason: 'outside-set', value: all[10] })
    })
})

describe('sync and start time', () => {
    it('drops a sync mode other than position', () => {
        const { state, notices } = parseCompareQuery(`runs=${A}&sync=ghost`)
        expect(state.sync).toBe('race')
        expect(notices).toEqual([{ param: 'sync', reason: 'malformed', value: 'ghost' }])
    })

    it.each(['-3', 'abc', '1e3', '12.', 'Infinity'])('drops the start time %s', raw => {
        const { state, notices } = parseCompareQuery(`runs=${A}&t=${raw}`)
        expect(state.t).toBeNull()
        expect(notices).toEqual([{ param: 't', reason: 'malformed', value: raw }])
    })

    it('rounds a start time to milliseconds and writes it with three decimals', () => {
        const { state } = parseCompareQuery(`runs=${A}&t=7.12345`)
        expect(state.t).toBe(7.123)
        expect(serializeCompareQuery(state)).toBe(`runs=${A}&t=7.123`)
    })

    it('reads a whole-second start time', () => {
        expect(parseCompareQuery(`runs=${A}&t=0`).state.t).toBe(0)
    })
})

describe('parameters outside the grammar', () => {
    it('are dropped from the serialised query without a notice', () => {
        const { state, notices } = parseCompareQuery(`runs=${A}&utm_source=discord`)
        expect(notices).toEqual([])
        expect(serializeCompareQuery(state)).toBe(`runs=${A}`)
    })
})
