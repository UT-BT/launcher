import { describe, expect, it } from 'vitest'
import { ENTRIES, ENTRY_IDS, easterSunday, isEntryPreview } from './seasons'

const WESTERN_EASTER: Array<[number, number, number]> = [
    [2019, 4, 21],
    [2024, 3, 31],
    [2025, 4, 20],
    [2026, 4, 5],
    [2027, 3, 28],
    [2028, 4, 16],
    [2029, 4, 1],
    [2030, 4, 21],
    [2031, 4, 13],
    [2032, 3, 28],
    [2033, 4, 17],
    [2034, 4, 9],
    [2035, 3, 25],
    [2036, 4, 13],
    [2037, 4, 5],
    [2038, 4, 25],
    [2039, 4, 10],
    [2040, 4, 1],
]

describe('easterSunday', () => {
    it.each(WESTERN_EASTER)('finds Western Easter %i-%i-%i', (year, month, day) => {
        const sunday = easterSunday(year)
        expect([sunday.getFullYear(), sunday.getMonth() + 1, sunday.getDate()]).toEqual([year, month, day])
        expect(sunday.getDay()).toBe(0)
    })
})

describe('ENTRIES', () => {
    it('gives every entry a distinct lowercase id, a display label and a kind', () => {
        expect(new Set(ENTRY_IDS).size).toBe(ENTRY_IDS.length)
        for (const entry of ENTRIES) {
            expect(entry.id).toMatch(/^[a-z]+(-[a-z]+)*$/)
            expect(entry.label.trim().length).toBeGreaterThan(0)
            expect(['season', 'holiday']).toContain(entry.kind)
        }
        expect(ENTRIES.find(entry => entry.id === 'halloween')?.label).toBe('Halloween')
    })

    it('keeps Halloween, Christmas and Easter as holidays', () => {
        expect(ENTRIES.filter(entry => entry.kind === 'holiday').map(entry => entry.id)).toEqual(expect.arrayContaining(['halloween', 'christmas', 'easter']))
    })

    it('is where ENTRY_IDS comes from', () => {
        expect(ENTRY_IDS).toEqual(ENTRIES.map(entry => entry.id))
    })
})

describe('isEntryPreview', () => {
    it.each(ENTRY_IDS)('accepts the registered entry %s', id => {
        expect(isEntryPreview(id)).toBe(true)
    })

    it('accepts none and rejects anything else', () => {
        expect(isEntryPreview('none')).toBe(true)
        expect(isEntryPreview('aurora')).toBe(false)
        expect(isEntryPreview('')).toBe(false)
        expect(isEntryPreview(null)).toBe(false)
    })
})
