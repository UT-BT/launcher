import { isEntryPreview, type EntryId, type EntryPreview } from './seasons'

const OVERRIDE_KEY = 'utbt:seasonOverride:v1'
const PIN_KEY = 'utbt:seasonPin:v1'
const CACHE_KEY = 'utbt:season:v2'

export interface SeasonCache {
    id: EntryId | null
    until: number
}

const overrideListeners = new Set<() => void>()

export function parseSeasonParam(search: string): EntryPreview | null {
    const value = new URLSearchParams(search).get('season')
    return isEntryPreview(value) ? value : null
}

function readPreview(storage: () => Storage, key: string): EntryPreview | null {
    if (typeof window === 'undefined') return null
    try {
        const value = storage().getItem(key)
        return isEntryPreview(value) ? value : null
    } catch {
        return null
    }
}

export function readSeasonOverride(): EntryPreview | null {
    return readPreview(() => window.sessionStorage, OVERRIDE_KEY)
}

export function readEntryPreview(): EntryPreview | null {
    return readSeasonOverride() ?? readPreview(() => window.localStorage, PIN_KEY)
}

export function writeSeasonOverride(value: EntryPreview | null): void {
    if (typeof window === 'undefined') return
    try {
        if (value) window.sessionStorage.setItem(OVERRIDE_KEY, value)
        else window.sessionStorage.removeItem(OVERRIDE_KEY)
    } catch {
        return
    } finally {
        overrideListeners.forEach(listener => listener())
    }
}

export function subscribeSeasonOverride(callback: () => void): () => void {
    overrideListeners.add(callback)
    return () => { overrideListeners.delete(callback) }
}

export function captureSeasonOverride(search: string): void {
    const value = parseSeasonParam(search)
    if (value) writeSeasonOverride(value)
}

export function writeSeasonCache(cache: SeasonCache): void {
    if (typeof window === 'undefined') return
    try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
    } catch {
        return
    }
}
