import type { Hemisphere } from './hemisphere'

export type { Hemisphere }

export type EntryKind = 'season' | 'holiday'

export interface EntryWindow {
    start: Date
    endExclusive: Date
}

interface EntryDefinition {
    id: string
    label: string
    kind: EntryKind
    window(year: number, hemisphere: Hemisphere): EntryWindow | null
    hemisphere?: Hemisphere
    logo?: string
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

function meteorological(northStartMonth: number): (year: number, hemisphere: Hemisphere) => EntryWindow {
    return (year, hemisphere) => {
        const month = hemisphere === 'north' ? northStartMonth : (northStartMonth + 6) % 12
        return { start: new Date(year, month, 1), endExclusive: new Date(year, month + 3, 1) }
    }
}

function daysAround(anchor: Date, before: number, after: number): EntryWindow {
    const year = anchor.getFullYear()
    const month = anchor.getMonth()
    const day = anchor.getDate()
    return { start: new Date(year, month, day - before), endExclusive: new Date(year, month, day + after + 1) }
}

export const ENTRIES = [
    { id: 'spring', label: 'Spring', kind: 'season', window: meteorological(2) },
    { id: 'summer', label: 'Summer', kind: 'season', window: meteorological(5) },
    { id: 'autumn', label: 'Autumn', kind: 'season', window: meteorological(8) },
    { id: 'winter', label: 'Winter', kind: 'season', window: meteorological(11) },
    {
        id: 'easter',
        label: 'Easter',
        kind: 'holiday',
        window: year => daysAround(easterSunday(year), 7, 7),
    },
    {
        id: 'halloween',
        label: 'Halloween',
        kind: 'holiday',
        window: year => ({ start: new Date(year, 9, 24), endExclusive: new Date(year, 10, 8) }),
    },
    {
        id: 'christmas',
        label: 'Christmas',
        kind: 'holiday',
        hemisphere: 'north',
        window: year => ({ start: new Date(year, 11, 18), endExclusive: new Date(year, 11, 31) }),
    },
] as const satisfies readonly EntryDefinition[]

export type EntryId = (typeof ENTRIES)[number]['id']

export interface Entry extends Omit<EntryDefinition, 'id' | 'logo'> {
    id: EntryId
    logo?: EntryId
}

export type EntryPreview = EntryId | 'none'

export const ENTRY_IDS: readonly EntryId[] = ENTRIES.map(entry => entry.id)

export function isEntryPreview(value: unknown): value is EntryPreview {
    return value === 'none' || ENTRY_IDS.includes(value as EntryId)
}
