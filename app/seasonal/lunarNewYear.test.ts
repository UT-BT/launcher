import { describe, expect, it } from 'vitest'
import { LUNAR_NEW_YEAR_YEARS, lunarNewYearsDay } from './lunarNewYear'

function ymd(date: Date | null): [number, number, number] | null {
    return date && [date.getFullYear(), date.getMonth() + 1, date.getDate()]
}

const ALMANAC: Array<[number, number, number]> = [
    [2026, 2, 17],
    [2027, 2, 6],
    [2028, 1, 26],
    [2029, 2, 13],
    [2031, 1, 23],
    [2033, 1, 31],
    [2034, 2, 19],
    [2038, 2, 4],
    [2042, 1, 22],
    [2045, 2, 17],
    [2048, 2, 14],
    [2050, 1, 23],
]

describe('lunarNewYearsDay', () => {
    it('covers every year from 2026 through 2050, and nothing else', () => {
        expect(LUNAR_NEW_YEAR_YEARS[0]).toBe(2026)
        expect(LUNAR_NEW_YEAR_YEARS[LUNAR_NEW_YEAR_YEARS.length - 1]).toBe(2050)
        expect(LUNAR_NEW_YEAR_YEARS).toEqual(Array.from({ length: 25 }, (_, index) => 2026 + index))
    })

    it.each(ALMANAC)('matches the almanac in %i: %i-%i', (year, month, day) => {
        expect(ymd(lunarNewYearsDay(year))).toEqual([year, month, day])
    })

    it('falls between Jan 21 and Feb 20 every year of the table', () => {
        for (const year of LUNAR_NEW_YEAR_YEARS) {
            const day = lunarNewYearsDay(year)
            expect(day, String(year)).not.toBeNull()
            expect(day!.getTime(), String(year)).toBeGreaterThanOrEqual(new Date(year, 0, 21).getTime())
            expect(day!.getTime(), String(year)).toBeLessThanOrEqual(new Date(year, 1, 20).getTime())
        }
    })

    it.each([2025, 2051, 2100])('has no date in %i, outside the table', year => {
        expect(lunarNewYearsDay(year)).toBeNull()
    })
})
