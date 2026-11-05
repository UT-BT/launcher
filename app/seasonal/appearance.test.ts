import { describe, expect, it } from 'vitest'
import { resolveAppearance } from './appearance'
import type { EntryId, EntryPreview } from './seasons'

function at(year: number, month: number, day: number, hour = 0, minute = 0): Date {
    return new Date(year, month - 1, day, hour, minute)
}

function resolve(now: Date, themeId: string, preview: EntryPreview | null = null) {
    return resolveAppearance({ now, themeId, preview, hemisphere: 'north' })
}

type WindowCase = [string, Date, EntryId | null]

const HOLIDAY_WINDOWS: WindowCase[] = [
    ['the minute before Halloween', at(2026, 10, 23, 23, 59), null],
    ['the local midnight Halloween starts', at(2026, 10, 24), 'halloween'],
    ['Halloween night', at(2026, 10, 31, 20), 'halloween'],
    ['the last minute of Halloween', at(2026, 11, 7, 23, 59), 'halloween'],
    ['the local midnight Halloween ends', at(2026, 11, 8), null],
    ['the minute before Christmas', at(2026, 12, 17, 23, 59), null],
    ['the local midnight Christmas starts', at(2026, 12, 18), 'christmas'],
    ['Christmas Eve', at(2026, 12, 24, 12), 'christmas'],
    ['the last minute of Dec 30', at(2026, 12, 30, 23, 59), 'christmas'],
    ['the local midnight Christmas ends, Dec 31', at(2026, 12, 31), null],
    ['New Year\'s Day', at(2027, 1, 1), null],
    ['Jan 15, inside the old Christmas window', at(2027, 1, 15, 12), null],
    ['the minute before Easter 2026', at(2026, 3, 28, 23, 59), null],
    ['the local midnight Easter 2026 starts', at(2026, 3, 29), 'easter'],
    ['Easter Sunday 2026', at(2026, 4, 5, 12), 'easter'],
    ['the last minute of Easter 2026', at(2026, 4, 12, 23, 59), 'easter'],
    ['the local midnight Easter 2026 ends', at(2026, 4, 13), null],
    ['an early Easter, 2035', at(2035, 3, 18), 'easter'],
    ['the last day of a late Easter, 2038', at(2038, 5, 2), 'easter'],
    ['the day after a late Easter, 2038', at(2038, 5, 3), null],
    ['Valentine\'s Day', at(2026, 2, 14), null],
    ['midsummer', at(2026, 7, 1), null],
    ['early December', at(2026, 12, 1), null],
]

describe('resolveAppearance on the Seasonal theme', () => {
    it.each(HOLIDAY_WINDOWS)('%s: the winner is both the Seasonal entry and the logo', (_, now, expected) => {
        const appearance = resolve(now, 'seasonal')
        expect(appearance.seasonal).toBe(expected)
        expect(appearance.logo).toBe(expected)
    })
})

describe('resolveAppearance on any other theme', () => {
    it.each(['red', 'classic', 'light'])('%s gets the holiday logo during a holiday and no Seasonal entry', themeId => {
        expect(resolve(at(2026, 10, 31, 20), themeId)).toMatchObject({ seasonal: null, logo: 'halloween' })
        expect(resolve(at(2026, 12, 24), themeId)).toMatchObject({ seasonal: null, logo: 'christmas' })
        expect(resolve(at(2026, 4, 5), themeId)).toMatchObject({ seasonal: null, logo: 'easter' })
    })

    it.each(HOLIDAY_WINDOWS)('on Red, %s: only a holiday logo, never a Seasonal entry', (_, now, expected) => {
        expect(resolve(now, 'red')).toMatchObject({ seasonal: null, logo: expected })
    })
})

describe('resolveAppearance with a preview', () => {
    const PREVIEWS: Array<[string, string, Date, EntryId]> = [
        ['Classic', 'classic', at(2026, 7, 1), 'easter'],
        ['Red', 'red', at(2026, 10, 31), 'christmas'],
        ['Light', 'light', at(2026, 2, 14), 'halloween'],
        ['Seasonal', 'seasonal', at(2026, 10, 31), 'easter'],
    ]

    it.each(PREVIEWS)('an entry preview on %s makes it both outputs', (_, themeId, now, preview) => {
        expect(resolve(now, themeId, preview)).toMatchObject({ seasonal: preview, logo: preview })
    })

    it.each(['seasonal', 'red', 'classic'])('none clears both outputs on %s, even during a holiday', themeId => {
        expect(resolve(at(2026, 10, 31), themeId, 'none')).toMatchObject({ seasonal: null, logo: null })
        expect(resolve(at(2026, 12, 24), themeId, 'none')).toMatchObject({ seasonal: null, logo: null })
    })
})

describe('resolveAppearance until', () => {
    const BOUNDARIES: Array<[string, Date, string, EntryPreview | null, Date]> = [
        ['Halloween ends, on Seasonal', at(2026, 10, 30), 'seasonal', null, at(2026, 11, 8)],
        ['Halloween ends, on Red', at(2026, 10, 30), 'red', null, at(2026, 11, 8)],
        ['Halloween starts, one minute ahead', at(2026, 10, 23, 23, 59), 'classic', null, at(2026, 10, 24)],
        ['Christmas starts, after a quiet November', at(2026, 11, 20), 'seasonal', null, at(2026, 12, 18)],
        ['Christmas ends at the midnight after Dec 30', at(2026, 12, 24), 'seasonal', null, at(2026, 12, 31)],
        ['the next change from the midnight Christmas starts', at(2026, 12, 18), 'red', null, at(2026, 12, 31)],
        ['Easter starts next year, across the year change', at(2026, 12, 31), 'red', null, at(2027, 3, 21)],
        ['Easter starts, from early January', at(2027, 1, 2), 'seasonal', null, at(2027, 3, 21)],
        ['Easter ends', at(2026, 4, 1), 'red', null, at(2026, 4, 13)],
        ['the unpreviewed boundary under an entry preview', at(2026, 11, 20), 'red', 'christmas', at(2026, 12, 18)],
        ['the unpreviewed boundary under none', at(2026, 10, 30), 'seasonal', 'none', at(2026, 11, 8)],
    ]

    it.each(BOUNDARIES)('is the next local midnight either output changes: %s', (_, now, themeId, preview, next) => {
        expect(resolve(now, themeId, preview).until).toBe(next.getTime())
    })
})
