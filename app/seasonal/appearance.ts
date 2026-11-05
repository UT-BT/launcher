import { ENTRIES, type Entry, type EntryId, type EntryPreview, type EntryWindow, type Hemisphere } from './seasons'

export const SEASONAL_THEME_ID = 'seasonal'

export interface AppearanceInput {
    now: Date
    themeId: string
    preview: EntryPreview | null
    hemisphere: Hemisphere
}

export interface Appearance {
    seasonal: EntryId | null
    logo: EntryId | null
    until: number
}

const REGISTRY: readonly Entry[] = ENTRIES
const DAY_MS = 24 * 60 * 60 * 1000

function entriesIn(hemisphere: Hemisphere): Entry[] {
    return REGISTRY.filter(entry => !entry.hemisphere || entry.hemisphere === hemisphere)
}

function windowsAround(entry: Entry, time: number, hemisphere: Hemisphere): EntryWindow[] {
    const year = new Date(time).getFullYear()
    return [year - 1, year, year + 1].flatMap(windowYear => entry.window(windowYear, hemisphere) ?? [])
}

function winnerAt(time: number, hemisphere: Hemisphere): Entry | null {
    let winner: Entry | null = null
    let winnerDays = 0
    for (const entry of entriesIn(hemisphere)) {
        const window = windowsAround(entry, time, hemisphere).find(({ start, endExclusive }) => time >= start.getTime() && time < endExclusive.getTime())
        if (!window) continue
        const days = Math.round((window.endExclusive.getTime() - window.start.getTime()) / DAY_MS)
        const outranks = !winner || (entry.kind === winner.kind ? entry.kind === 'holiday' && days < winnerDays : entry.kind === 'holiday')
        if (outranks) {
            winner = entry
            winnerDays = days
        }
    }
    return winner
}

function logoOf(entry: Entry): EntryId {
    return entry.logo ?? entry.id
}

function outputsAt(time: number, themeId: string, hemisphere: Hemisphere): Omit<Appearance, 'until'> {
    const winner = winnerAt(time, hemisphere)
    if (themeId === SEASONAL_THEME_ID) return { seasonal: winner?.id ?? null, logo: winner ? logoOf(winner) : null }
    return { seasonal: null, logo: winner?.kind === 'holiday' ? logoOf(winner) : null }
}

function nextChange(time: number, themeId: string, hemisphere: Hemisphere): number {
    const current = outputsAt(time, themeId, hemisphere)
    const boundaries = entriesIn(hemisphere)
        .flatMap(entry => windowsAround(entry, time, hemisphere).flatMap(window => [window.start.getTime(), window.endExclusive.getTime()]))
        .filter(boundary => boundary > time)
        .sort((a, b) => a - b)
    const change = boundaries.find(boundary => {
        const next = outputsAt(boundary, themeId, hemisphere)
        return next.seasonal !== current.seasonal || next.logo !== current.logo
    })
    return change ?? time + DAY_MS
}

function previewed(preview: EntryPreview): Omit<Appearance, 'until'> {
    const entry = REGISTRY.find(candidate => candidate.id === preview)
    return entry ? { seasonal: entry.id, logo: logoOf(entry) } : { seasonal: null, logo: null }
}

export function resolveAppearance(input: AppearanceInput): Appearance {
    const time = input.now.getTime()
    const outputs = input.preview ? previewed(input.preview) : outputsAt(time, input.themeId, input.hemisphere)
    return { ...outputs, until: nextChange(time, input.themeId, input.hemisphere) }
}
