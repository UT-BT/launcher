export type SeasonId = 'halloween' | 'christmas' | 'easter'

export type SeasonOverride = SeasonId | 'none'

export const SEASON_IDS: readonly SeasonId[] = ['halloween', 'christmas', 'easter']

export interface ActiveSeason {
    id: SeasonId
    until: number
}

interface SeasonWindow {
    start: Date
    endExclusive: Date
}

interface Season {
    id: SeasonId
    window(year: number): SeasonWindow
}

export function easterSunday(year: number): Date {
    const a = year % 19
    const b = Math.floor(year / 100)
    const c = year % 100
    const d = Math.floor(b / 4)
    const e = b % 4
    const f = Math.floor((b + 8) / 25)
    const g = Math.floor((b - f + 1) / 3)
    const h = (19 * a + b - d - g + 15) % 30
    const i = Math.floor(c / 4)
    const k = c % 4
    const l = (32 + 2 * e + 2 * i - h - k) % 7
    const m = Math.floor((a + 11 * h + 22 * l) / 451)
    const month = Math.floor((h + l - 7 * m + 114) / 31)
    const day = ((h + l - 7 * m + 114) % 31) + 1
    return new Date(year, month - 1, day)
}

function daysAround(anchor: Date, before: number, after: number): SeasonWindow {
    const year = anchor.getFullYear()
    const month = anchor.getMonth()
    const day = anchor.getDate()
    return { start: new Date(year, month, day - before), endExclusive: new Date(year, month, day + after + 1) }
}

const SEASONS: readonly Season[] = [
    {
        id: 'halloween',
        window: year => ({ start: new Date(year, 9, 24), endExclusive: new Date(year, 10, 8) }),
    },
    {
        id: 'christmas',
        window: year => ({ start: new Date(year, 11, 18), endExclusive: new Date(year + 1, 0, 16) }),
    },
    {
        id: 'easter',
        window: year => daysAround(easterSunday(year), 7, 7),
    },
]

export function activeSeason(now: Date): ActiveSeason | null {
    const time = now.getTime()
    const year = now.getFullYear()
    for (const season of SEASONS) {
        for (const windowYear of [year - 1, year]) {
            const { start, endExclusive } = season.window(windowYear)
            if (time >= start.getTime() && time < endExclusive.getTime()) {
                return { id: season.id, until: endExclusive.getTime() }
            }
        }
    }
    return null
}

export function isSeasonOverride(value: unknown): value is SeasonOverride {
    return value === 'none' || SEASON_IDS.includes(value as SeasonId)
}

export function resolveSeason(input: { dateSeason: SeasonId | null; enabled: boolean; override: SeasonOverride | null }): SeasonId | null {
    if (input.override) return input.override === 'none' ? null : input.override
    return input.enabled ? input.dateSeason : null
}
