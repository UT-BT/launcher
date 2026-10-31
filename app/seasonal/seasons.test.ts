import { describe, expect, it } from 'vitest'
import { SEASONS, SEASON_IDS, activeSeason, easterSunday, isSeasonOverride, resolveSeason } from './seasons'

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

function at(year: number, month: number, day: number, hour = 0, minute = 0): Date {
    return new Date(year, month - 1, day, hour, minute)
}

describe('easterSunday', () => {
    it.each(WESTERN_EASTER)('finds Western Easter %i-%i-%i', (year, month, day) => {
        const sunday = easterSunday(year)
        expect([sunday.getFullYear(), sunday.getMonth() + 1, sunday.getDate()]).toEqual([year, month, day])
        expect(sunday.getDay()).toBe(0)
    })
})

describe('activeSeason', () => {
    it('runs Halloween from Oct 24 through Nov 7', () => {
        expect(activeSeason(at(2026, 10, 23, 23, 59))).toBeNull()
        expect(activeSeason(at(2026, 10, 24))?.id).toBe('halloween')
        expect(activeSeason(at(2026, 10, 31, 20))?.id).toBe('halloween')
        expect(activeSeason(at(2026, 11, 7, 23, 59))?.id).toBe('halloween')
        expect(activeSeason(at(2026, 11, 8))).toBeNull()
    })

    it('runs Christmas from Dec 18 through Jan 15, across the new year', () => {
        expect(activeSeason(at(2026, 12, 17, 23, 59))).toBeNull()
        expect(activeSeason(at(2026, 12, 18))?.id).toBe('christmas')
        expect(activeSeason(at(2026, 12, 31, 23, 59))?.id).toBe('christmas')
        expect(activeSeason(at(2027, 1, 1))?.id).toBe('christmas')
        expect(activeSeason(at(2027, 1, 15, 23, 59))?.id).toBe('christmas')
        expect(activeSeason(at(2027, 1, 16))).toBeNull()
    })

    it('runs Easter from a week before Easter Sunday to a week after', () => {
        expect(activeSeason(at(2026, 3, 28, 23, 59))).toBeNull()
        expect(activeSeason(at(2026, 3, 29))?.id).toBe('easter')
        expect(activeSeason(at(2026, 4, 5, 12))?.id).toBe('easter')
        expect(activeSeason(at(2026, 4, 12, 23, 59))?.id).toBe('easter')
        expect(activeSeason(at(2026, 4, 13))).toBeNull()
    })

    it('follows the moving Easter date', () => {
        expect(activeSeason(at(2035, 3, 18))?.id).toBe('easter')
        expect(activeSeason(at(2038, 5, 2))?.id).toBe('easter')
        expect(activeSeason(at(2038, 5, 3))).toBeNull()
    })

    it('reports when the season ends, as the local midnight after its last day', () => {
        expect(activeSeason(at(2026, 10, 30))?.until).toBe(at(2026, 11, 8).getTime())
        expect(activeSeason(at(2027, 1, 2))?.until).toBe(at(2027, 1, 16).getTime())
        expect(activeSeason(at(2026, 4, 1))?.until).toBe(at(2026, 4, 13).getTime())
    })

    it('is quiet outside every season', () => {
        expect(activeSeason(at(2026, 2, 14))).toBeNull()
        expect(activeSeason(at(2026, 7, 1))).toBeNull()
        expect(activeSeason(at(2026, 12, 1))).toBeNull()
    })
})

describe('resolveSeason', () => {
    it('shows the date season when the viewer keeps seasonal themes on', () => {
        expect(resolveSeason({ dateSeason: 'christmas', enabled: true, override: null })).toBe('christmas')
        expect(resolveSeason({ dateSeason: null, enabled: true, override: null })).toBeNull()
    })

    it('shows nothing when the viewer turned seasonal themes off', () => {
        expect(resolveSeason({ dateSeason: 'christmas', enabled: false, override: null })).toBeNull()
    })

    it('lets a preview override beat both the toggle and the date', () => {
        expect(resolveSeason({ dateSeason: null, enabled: false, override: 'easter' })).toBe('easter')
        expect(resolveSeason({ dateSeason: 'halloween', enabled: true, override: 'christmas' })).toBe('christmas')
        expect(resolveSeason({ dateSeason: 'halloween', enabled: true, override: 'none' })).toBeNull()
    })
})

describe('SEASONS', () => {
    it('gives every season a distinct lowercase id and a display label', () => {
        expect(new Set(SEASON_IDS).size).toBe(SEASON_IDS.length)
        for (const season of SEASONS) {
            expect(season.id).toMatch(/^[a-z]+$/)
            expect(season.label.trim().length).toBeGreaterThan(0)
        }
        expect(SEASONS.find(season => season.id === 'halloween')?.label).toBe('Halloween')
    })

    it('is where SEASON_IDS comes from', () => {
        expect(SEASON_IDS).toEqual(SEASONS.map(season => season.id))
    })
})

describe('isSeasonOverride', () => {
    it.each(SEASON_IDS)('accepts the registered season %s', id => {
        expect(isSeasonOverride(id)).toBe(true)
    })

    it('accepts none and rejects anything else', () => {
        expect(isSeasonOverride('halloween')).toBe(true)
        expect(isSeasonOverride('none')).toBe(true)
        expect(isSeasonOverride('summer')).toBe(false)
        expect(isSeasonOverride(null)).toBe(false)
    })
})
