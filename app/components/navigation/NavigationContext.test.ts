import { describe, expect, it } from 'vitest'
import { paramsEqual, withReplacedParams, type NavEntry } from './NavigationContext'

describe('paramsEqual', () => {
    it('treats two different match ids as different params', () => {
        expect(paramsEqual({ eventSlug: 'cup', matchId: '1' }, { eventSlug: 'cup', matchId: '2' })).toBe(false)
    })

    it('treats the same event slug and match id as equal', () => {
        expect(paramsEqual({ eventSlug: 'cup', matchId: '1' }, { eventSlug: 'cup', matchId: '1' })).toBe(true)
    })

    it('treats two different event team ids as different params', () => {
        expect(paramsEqual({ eventSlug: 'cup', eventTeamId: 'a' }, { eventSlug: 'cup', eventTeamId: 'b' })).toBe(false)
    })

    it('treats two different event tabs as different params', () => {
        expect(paramsEqual({ eventSlug: 'cup', eventTab: 'predictions' }, { eventSlug: 'cup', eventTab: 'schedule' })).toBe(false)
    })

    it('treats the same event slug and tab as equal', () => {
        expect(paramsEqual({ eventSlug: 'cup', eventTab: 'predictions' }, { eventSlug: 'cup', eventTab: 'predictions' })).toBe(true)
    })
})

describe('paramsEqual on the compare page', () => {
    it('treats two different compare queries as different params', () => {
        expect(paramsEqual({ compare: 'runs=a,b' }, { compare: 'runs=a' })).toBe(false)
    })

    it('treats a missing and an empty compare query as equal', () => {
        expect(paramsEqual({}, { compare: '' })).toBe(true)
    })
})

describe('replacing the active entry params', () => {
    const entries: NavEntry[] = [
        { id: 3, view: 'cap-detail', params: { capId: 'a' }, state: {} },
        { id: 4, view: 'run-compare', params: { compare: 'runs=a,b,c&t=4.000' }, state: { 'compare.seekSeconds': 4 } },
        { id: 5, view: 'maps', params: {}, state: {} },
    ]

    it('swaps only that entry params, keeping its id, view, position and state', () => {
        const next = withReplacedParams(entries, 4, { compare: 'runs=a,b' })

        expect(next).toHaveLength(3)
        expect(next[1]).toEqual({ id: 4, view: 'run-compare', params: { compare: 'runs=a,b' }, state: { 'compare.seekSeconds': 4 } })
        expect(next[0]).toBe(entries[0])
        expect(next[2]).toBe(entries[2])
    })

    it('leaves the stack untouched when the entry is gone', () => {
        expect(withReplacedParams(entries, 9, { compare: 'runs=a' })).toEqual(entries)
    })
})
