import { getSynced, setSynced, subscribeSynced } from '@/app/utils/userState'
import { isHemisphere, type Hemisphere, type HemisphereSetting } from './hemisphere'
import { isEntryPreview, type EntryId, type EntryPreview } from './seasons'

const OVERRIDE_KEY = 'utbt:seasonOverride:v1'
const PIN_KEY = 'utbt:seasonPin:v1'
const CACHE_KEY = 'utbt:season:v2'
const HEMISPHERE_KEY = 'utbt:hemisphere:v1'
const HEMISPHERE_OVERRIDE_KEY = 'utbt:hemisphereOverride:v1'
const EFFECTS_KEY = 'utbt:seasonalEffects:v1'

export interface SeasonCache {
    id: EntryId | null
    until: number
}

const overrideListeners = new Set<() => void>()
const hemisphereOverrideListeners = new Set<() => void>()

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

export function parseHemisphereSetting(stored: unknown): HemisphereSetting {
    return isHemisphere(stored) ? stored : 'auto'
}

export function loadHemisphereSetting(): HemisphereSetting {
    return parseHemisphereSetting(getSynced<unknown>(HEMISPHERE_KEY, null))
}

export function saveHemisphereSetting(setting: HemisphereSetting): void {
    setSynced(HEMISPHERE_KEY, setting)
}

export function subscribeHemisphereSetting(callback: () => void): () => void {
    return subscribeSynced(HEMISPHERE_KEY, callback)
}

export function parseSeasonalEffects(stored: unknown): boolean {
    return typeof stored === 'boolean' ? stored : true
}

export function loadSeasonalEffects(): boolean {
    return parseSeasonalEffects(getSynced<unknown>(EFFECTS_KEY, null))
}

export function saveSeasonalEffects(on: boolean): void {
    setSynced(EFFECTS_KEY, on)
}

export function subscribeSeasonalEffects(callback: () => void): () => void {
    return subscribeSynced(EFFECTS_KEY, callback)
}

export function parseHemisphereParam(search: string): Hemisphere | null {
    const value = new URLSearchParams(search).get('hemisphere')
    return isHemisphere(value) ? value : null
}

export function readHemisphereOverride(): Hemisphere | null {
    if (typeof window === 'undefined') return null
    try {
        const value = window.sessionStorage.getItem(HEMISPHERE_OVERRIDE_KEY)
        return isHemisphere(value) ? value : null
    } catch {
        return null
    }
}

export function writeHemisphereOverride(value: Hemisphere | null): void {
    if (typeof window === 'undefined') return
    try {
        if (value) window.sessionStorage.setItem(HEMISPHERE_OVERRIDE_KEY, value)
        else window.sessionStorage.removeItem(HEMISPHERE_OVERRIDE_KEY)
    } catch {
        return
    } finally {
        hemisphereOverrideListeners.forEach(listener => listener())
    }
}

export function subscribeHemisphereOverride(callback: () => void): () => void {
    hemisphereOverrideListeners.add(callback)
    return () => { hemisphereOverrideListeners.delete(callback) }
}

export function captureHemisphereOverride(search: string): void {
    const value = parseHemisphereParam(search)
    if (value) writeHemisphereOverride(value)
}
