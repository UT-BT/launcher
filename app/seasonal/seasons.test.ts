import { describe, expect, it } from 'vitest'
import { ENTRIES, ENTRY_IDS, easterSunday, isEntryPreview, type Entry } from './seasons'

const REGISTRY: readonly Entry[] = ENTRIES

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

    it('opens with the four seasons, each for both hemispheres', () => {
        expect(REGISTRY.slice(0, 4).map(({ id, label, kind }) => ({ id, label, kind }))).toEqual([
            { id: 'spring', label: 'Spring', kind: 'season' },
            { id: 'summer', label: 'Summer', kind: 'season' },
            { id: 'autumn', label: 'Autumn', kind: 'season' },
            { id: 'winter', label: 'Winter', kind: 'season' },
        ])
        const seasons = REGISTRY.filter(entry => entry.kind === 'season')
        expect(seasons).toHaveLength(4)
        for (const season of seasons) {
            expect(season.hemisphere, season.id).toBeUndefined()
            expect(season.logo, season.id).toBeUndefined()
        }
    })

    it('follows the seasons with New Year and Lunar New Year, holidays for both hemispheres with their own logos', () => {
        expect(REGISTRY.slice(4, 6).map(({ id, label, kind, hemisphere, logo }) => ({ id, label, kind, hemisphere, logo }))).toEqual([
            { id: 'new-year', label: 'New Year', kind: 'holiday', hemisphere: undefined, logo: undefined },
            { id: 'lunar-new-year', label: 'Lunar New Year', kind: 'holiday', hemisphere: undefined, logo: undefined },
        ])
    })

    it('runs New Year from Dec 31 to Jan 3, across the year change', () => {
        const newYear = REGISTRY.find(entry => entry.id === 'new-year')
        expect(newYear?.window(2026, 'north')).toEqual({ start: new Date(2026, 11, 31), endExclusive: new Date(2027, 0, 4) })
        expect(newYear?.window(2026, 'south')).toEqual(newYear?.window(2026, 'north'))
    })

    it('runs Lunar New Year from its eve to day 6, in both hemispheres', () => {
        const lunarNewYear = REGISTRY.find(entry => entry.id === 'lunar-new-year')
        expect(lunarNewYear?.window(2029, 'north')).toEqual({ start: new Date(2029, 1, 12), endExclusive: new Date(2029, 1, 19) })
        expect(lunarNewYear?.window(2029, 'south')).toEqual(lunarNewYear?.window(2029, 'north'))
        expect(lunarNewYear?.window(2051, 'north')).toBeNull()
    })

    it('follows Lunar New Year with Valentine\'s Day and St Patrick\'s Day, holidays for both hemispheres with their own logos', () => {
        expect(REGISTRY.slice(6, 8).map(({ id, label, kind, hemisphere, logo }) => ({ id, label, kind, hemisphere, logo }))).toEqual([
            { id: 'valentines', label: 'Valentine\'s Day', kind: 'holiday', hemisphere: undefined, logo: undefined },
            { id: 'st-patricks', label: 'St Patrick\'s Day', kind: 'holiday', hemisphere: undefined, logo: undefined },
        ])
        expect(REGISTRY[8].id).toBe('easter')
    })

    it('runs Valentine\'s Day from Feb 12 to 15, in both hemispheres', () => {
        const valentines = REGISTRY.find(entry => entry.id === 'valentines')
        expect(valentines?.window(2026, 'north')).toEqual({ start: new Date(2026, 1, 12), endExclusive: new Date(2026, 1, 16) })
        expect(valentines?.window(2026, 'south')).toEqual(valentines?.window(2026, 'north'))
    })

    it('runs St Patrick\'s Day from Mar 15 to 17, in both hemispheres', () => {
        const stPatricks = REGISTRY.find(entry => entry.id === 'st-patricks')
        expect(stPatricks?.window(2026, 'north')).toEqual({ start: new Date(2026, 2, 15), endExclusive: new Date(2026, 2, 18) })
        expect(stPatricks?.window(2026, 'south')).toEqual(stPatricks?.window(2026, 'north'))
    })

    it('closes with Summer Christmas, southern only and on the Christmas logo, while Christmas stays northern', () => {
        const last = REGISTRY[REGISTRY.length - 1]
        expect({ id: last.id, label: last.label, kind: last.kind, hemisphere: last.hemisphere, logo: last.logo }).toEqual({
            id: 'christmas-summer',
            label: 'Summer Christmas',
            kind: 'holiday',
            hemisphere: 'south',
            logo: 'christmas',
        })
        const christmas = REGISTRY.find(entry => entry.id === 'christmas')
        expect(christmas?.hemisphere).toBe('north')
        expect(last.window(2026, 'south')).toEqual(christmas?.window(2026, 'north'))
        expect(last.window(2026, 'south')).toEqual({ start: new Date(2026, 11, 18), endExclusive: new Date(2026, 11, 31) })
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
