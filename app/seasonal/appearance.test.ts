import { describe, expect, it } from 'vitest'
import { resolveAppearance } from './appearance'
import type { Hemisphere, HemisphereSetting } from './hemisphere'
import type { EntryId, EntryPreview } from './seasons'

function at(year: number, month: number, day: number, hour = 0, minute = 0): Date {
    return new Date(year, month - 1, day, hour, minute)
}

function resolve(now: Date, themeId: string, preview: EntryPreview | null = null) {
    return resolveAppearance({ now, themeId, preview, timeZone: 'Europe/London', hemisphereSetting: 'auto', hemispherePreview: null })
}

interface Where {
    timeZone: string | undefined
    setting?: HemisphereSetting
    preview?: Hemisphere | null
}

function resolveWhere(now: Date, themeId: string, where: Where, preview: EntryPreview | null = null) {
    return resolveAppearance({
        now,
        themeId,
        preview,
        timeZone: where.timeZone,
        hemisphereSetting: where.setting ?? 'auto',
        hemispherePreview: where.preview ?? null,
    })
}

type WindowCase = [string, Date, EntryId | null, EntryId]

const HOLIDAY_WINDOWS: WindowCase[] = [
    ['the minute before Halloween', at(2026, 10, 23, 23, 59), null, 'autumn'],
    ['the local midnight Halloween starts', at(2026, 10, 24), 'halloween', 'halloween'],
    ['Halloween night', at(2026, 10, 31, 20), 'halloween', 'halloween'],
    ['the last minute of Halloween', at(2026, 11, 7, 23, 59), 'halloween', 'halloween'],
    ['the local midnight Halloween ends', at(2026, 11, 8), null, 'autumn'],
    ['the minute before Christmas', at(2026, 12, 17, 23, 59), null, 'winter'],
    ['the local midnight Christmas starts', at(2026, 12, 18), 'christmas', 'christmas'],
    ['Christmas Eve', at(2026, 12, 24, 12), 'christmas', 'christmas'],
    ['the last minute of Dec 30', at(2026, 12, 30, 23, 59), 'christmas', 'christmas'],
    ['the local midnight Christmas ends, Dec 31', at(2026, 12, 31), null, 'winter'],
    ['New Year\'s Day', at(2027, 1, 1), null, 'winter'],
    ['Jan 15, inside the old Christmas window', at(2027, 1, 15, 12), null, 'winter'],
    ['the minute before Easter 2026', at(2026, 3, 28, 23, 59), null, 'spring'],
    ['the local midnight Easter 2026 starts', at(2026, 3, 29), 'easter', 'easter'],
    ['Easter Sunday 2026', at(2026, 4, 5, 12), 'easter', 'easter'],
    ['the last minute of Easter 2026', at(2026, 4, 12, 23, 59), 'easter', 'easter'],
    ['the local midnight Easter 2026 ends', at(2026, 4, 13), null, 'spring'],
    ['an early Easter, 2035', at(2035, 3, 18), 'easter', 'easter'],
    ['the last day of a late Easter, 2038', at(2038, 5, 2), 'easter', 'easter'],
    ['the day after a late Easter, 2038', at(2038, 5, 3), null, 'spring'],
    ['Valentine\'s Day', at(2026, 2, 14), null, 'winter'],
    ['midsummer', at(2026, 7, 1), null, 'summer'],
    ['early December', at(2026, 12, 1), null, 'winter'],
]

describe('resolveAppearance on the Seasonal theme', () => {
    it.each(HOLIDAY_WINDOWS)('%s: the winner is both the Seasonal entry and the logo', (_, now, __, expected) => {
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
        ['Christmas starts, after a quiet November', at(2026, 11, 20), 'red', null, at(2026, 12, 18)],
        ['Christmas ends at the midnight after Dec 30', at(2026, 12, 24), 'seasonal', null, at(2026, 12, 31)],
        ['the next change from the midnight Christmas starts', at(2026, 12, 18), 'red', null, at(2026, 12, 31)],
        ['Easter starts next year, across the year change', at(2026, 12, 31), 'red', null, at(2027, 3, 21)],
        ['Easter starts, from early January', at(2027, 1, 2), 'classic', null, at(2027, 3, 21)],
        ['Easter ends', at(2026, 4, 1), 'red', null, at(2026, 4, 13)],
        ['the unpreviewed boundary under an entry preview', at(2026, 11, 20), 'red', 'christmas', at(2026, 12, 18)],
        ['the unpreviewed boundary under none', at(2026, 10, 30), 'seasonal', 'none', at(2026, 11, 8)],
    ]

    it.each(BOUNDARIES)('is the next local midnight either output changes: %s', (_, now, themeId, preview, next) => {
        expect(resolve(now, themeId, preview).until).toBe(next.getTime())
    })
})

describe('resolveAppearance through the seasons', () => {
    const NORTH: Where = { timeZone: 'Europe/London' }
    const SOUTH: Where = { timeZone: 'Australia/Sydney' }

    const BOUNDARIES: Array<[string, Date, EntryId, EntryId]> = [
        ['the last minute of Feb 28, 2027', at(2027, 2, 28, 23, 59), 'winter', 'summer'],
        ['the local midnight Mar 1, 2027', at(2027, 3, 1), 'spring', 'autumn'],
        ['Feb 29, 2028', at(2028, 2, 29, 12), 'winter', 'summer'],
        ['the last minute of Feb 29, 2028', at(2028, 2, 29, 23, 59), 'winter', 'summer'],
        ['the local midnight after Feb 29, 2028', at(2028, 3, 1), 'spring', 'autumn'],
        ['the last minute of May 31', at(2026, 5, 31, 23, 59), 'spring', 'autumn'],
        ['the local midnight Jun 1', at(2026, 6, 1), 'summer', 'winter'],
        ['the last minute of Aug 31', at(2026, 8, 31, 23, 59), 'summer', 'winter'],
        ['the local midnight Sep 1', at(2026, 9, 1), 'autumn', 'spring'],
        ['the last minute of Nov 30', at(2026, 11, 30, 23, 59), 'autumn', 'spring'],
        ['the local midnight Dec 1', at(2026, 12, 1), 'winter', 'summer'],
    ]

    it.each(BOUNDARIES)('%s: the north and the south each get their meteorological season', (_, now, north, south) => {
        expect(resolveWhere(now, 'seasonal', NORTH)).toMatchObject({ seasonal: north, logo: north })
        expect(resolveWhere(now, 'seasonal', SOUTH)).toMatchObject({ seasonal: south, logo: south })
    })

    const HOLIDAYS_OVER_SEASONS: Array<[string, Date, Where, EntryId]> = [
        ['Halloween beats autumn', at(2026, 10, 31, 20), NORTH, 'halloween'],
        ['Halloween beats spring in the south', at(2026, 10, 31, 20), SOUTH, 'halloween'],
        ['Christmas beats winter', at(2026, 12, 24, 12), NORTH, 'christmas'],
        ['Easter beats spring', at(2026, 4, 5, 12), NORTH, 'easter'],
        ['Easter beats autumn in the south', at(2026, 4, 5, 12), SOUTH, 'easter'],
    ]

    it.each(HOLIDAYS_OVER_SEASONS)('%s', (_, now, where, holiday) => {
        expect(resolveWhere(now, 'seasonal', where)).toMatchObject({ seasonal: holiday, logo: holiday })
    })

    it.each([
        ['a common year in the north', 2027, NORTH],
        ['a common year in the south', 2027, SOUTH],
        ['a leap year in the north', 2028, NORTH],
        ['a leap year in the south', 2028, SOUTH],
    ] as const)('the Seasonal theme has an entry every day of %s', (_, year, where) => {
        for (let day = new Date(year, 0, 1); day.getFullYear() === year; day = new Date(year, day.getMonth(), day.getDate() + 1)) {
            expect(resolveWhere(day, 'seasonal', where).seasonal, day.toDateString()).not.toBeNull()
        }
    })

    it.each([
        ['spring', at(2026, 5, 10), NORTH],
        ['summer', at(2026, 7, 10), NORTH],
        ['autumn', at(2026, 9, 10), NORTH],
        ['winter', at(2027, 1, 10), NORTH],
        ['the southern winter', at(2026, 7, 10), SOUTH],
        ['the southern summer', at(2027, 1, 10), SOUTH],
    ] as const)('on Red, plain %s gives no Seasonal entry and no logo', (_, now, where) => {
        expect(resolveWhere(now, 'red', where)).toMatchObject({ seasonal: null, logo: null })
    })

    const SEASON_UNTIL: Array<[string, Date, string, Where, Date]> = [
        ['summer ends', at(2026, 7, 10), 'seasonal', NORTH, at(2026, 9, 1)],
        ['the southern winter ends', at(2026, 7, 10), 'seasonal', SOUTH, at(2026, 9, 1)],
        ['spring ends', at(2026, 5, 20), 'seasonal', NORTH, at(2026, 6, 1)],
        ['the southern autumn ends', at(2026, 5, 20), 'seasonal', SOUTH, at(2026, 6, 1)],
        ['autumn ends after Halloween', at(2026, 11, 20), 'seasonal', NORTH, at(2026, 12, 1)],
        ['the southern spring ends', at(2026, 11, 20), 'seasonal', SOUTH, at(2026, 12, 1)],
        ['winter ends after Feb 28', at(2027, 2, 20), 'seasonal', NORTH, at(2027, 3, 1)],
        ['the southern summer ends after Feb 28', at(2027, 2, 20), 'seasonal', SOUTH, at(2027, 3, 1)],
        ['winter ends after Feb 29', at(2028, 2, 29, 12), 'seasonal', NORTH, at(2028, 3, 1)],
        ['Halloween starts in autumn', at(2026, 10, 10), 'seasonal', NORTH, at(2026, 10, 24)],
        ['Christmas starts in winter', at(2026, 12, 10), 'seasonal', NORTH, at(2026, 12, 18)],
        ['winter takes over from Christmas', at(2026, 12, 24), 'seasonal', NORTH, at(2026, 12, 31)],
        ['on Red, the season changes are skipped up to Halloween', at(2026, 7, 10), 'red', NORTH, at(2026, 10, 24)],
        ['on Red, Dec 1 is skipped', at(2026, 11, 20), 'red', NORTH, at(2026, 12, 18)],
    ]

    it.each(SEASON_UNTIL)('until lands on the next change: %s', (_, now, themeId, where, next) => {
        expect(resolveWhere(now, themeId, where).until).toBe(next.getTime())
    })
})

describe('resolveAppearance across hemispheres', () => {
    const CHRISTMAS_EVE = at(2026, 12, 24, 12)

    const PLACES: Array<[string, Where, EntryId | null]> = [
        ['a northern zone', { timeZone: 'Europe/Berlin' }, 'christmas'],
        ['a North American zone', { timeZone: 'America/New_York' }, 'christmas'],
        ['an equatorial-north zone', { timeZone: 'Asia/Singapore' }, 'christmas'],
        ['an unknown zone', { timeZone: 'Mars/Olympus_Mons' }, 'christmas'],
        ['a missing timezone', { timeZone: undefined }, 'christmas'],
        ['an Australian zone', { timeZone: 'Australia/Sydney' }, null],
        ['a New Zealand zone', { timeZone: 'Pacific/Auckland' }, null],
        ['a South American zone', { timeZone: 'America/Sao_Paulo' }, null],
        ['a southern African zone', { timeZone: 'Africa/Johannesburg' }, null],
        ['a legacy southern alias', { timeZone: 'Australia/ACT' }, null],
        ['the setting over a southern zone', { timeZone: 'Australia/Sydney', setting: 'north' }, 'christmas'],
        ['the setting over a northern zone', { timeZone: 'Europe/Berlin', setting: 'south' }, null],
        ['auto over a southern zone', { timeZone: 'Australia/Sydney', setting: 'auto' }, null],
        ['the preview over the setting', { timeZone: 'Europe/Berlin', setting: 'north', preview: 'south' }, null],
        ['the preview over a southern setting', { timeZone: 'Australia/Sydney', setting: 'south', preview: 'north' }, 'christmas'],
    ]

    it.each(PLACES)('Christmas Eve with %s', (_, where, expected) => {
        expect(resolveWhere(CHRISTMAS_EVE, 'seasonal', where)).toMatchObject({ seasonal: expected ?? 'summer', logo: expected ?? 'summer' })
        expect(resolveWhere(CHRISTMAS_EVE, 'red', where)).toMatchObject({ seasonal: null, logo: expected })
    })

    it.each([
        ['Halloween', at(2026, 10, 31, 20), 'halloween'],
        ['Easter', at(2026, 4, 5, 12), 'easter'],
    ] as const)('%s shows in both hemispheres', (_, now, expected) => {
        expect(resolveWhere(now, 'seasonal', { timeZone: 'Europe/Berlin' }).seasonal).toBe(expected)
        expect(resolveWhere(now, 'seasonal', { timeZone: 'Australia/Sydney' }).seasonal).toBe(expected)
    })

    it('an entry preview of Christmas shows in the south, whatever its filter', () => {
        expect(resolveWhere(at(2026, 7, 1), 'red', { timeZone: 'Australia/Sydney' }, 'christmas')).toMatchObject({ seasonal: 'christmas', logo: 'christmas' })
    })

    it('until skips the northern-only Christmas in the south', () => {
        expect(resolveWhere(at(2026, 11, 20), 'red', { timeZone: 'Australia/Sydney' }).until).toBe(at(2027, 3, 21).getTime())
        expect(resolveWhere(at(2026, 11, 20), 'red', { timeZone: 'Europe/Berlin' }).until).toBe(at(2026, 12, 18).getTime())
    })
})
