import { getSynced, setSynced, subscribeSynced } from '@/app/utils/userState'
import { isSeasonOverride, type ActiveSeason, type SeasonOverride } from './seasons'

const TOGGLE_KEY = 'utbt:seasonalThemes:v1'
const OVERRIDE_KEY = 'utbt:seasonOverride:v1'
const CACHE_KEY = 'utbt:season:v1'

const overrideListeners = new Set<() => void>()

export function parseSeasonalThemes(stored: unknown): boolean {
    return stored !== 'off'
}

export function loadSeasonalThemes(): boolean {
    return parseSeasonalThemes(getSynced<unknown>(TOGGLE_KEY, null))
}

export function saveSeasonalThemes(enabled: boolean): void {
    setSynced(TOGGLE_KEY, enabled ? 'on' : 'off')
}

export function subscribeSeasonalThemes(callback: () => void): () => void {
    return subscribeSynced(TOGGLE_KEY, callback)
}

export function parseSeasonParam(search: string): SeasonOverride | null {
    const value = new URLSearchParams(search).get('season')
    return isSeasonOverride(value) ? value : null
}

export function readSeasonOverride(): SeasonOverride | null {
    if (typeof window === 'undefined') return null
    try {
        const value = window.sessionStorage.getItem(OVERRIDE_KEY)
        return isSeasonOverride(value) ? value : null
    } catch {
        return null
    }
}

export function writeSeasonOverride(value: SeasonOverride | null): void {
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

export function writeSeasonCache(season: ActiveSeason | null): void {
    if (typeof window === 'undefined') return
    try {
        if (season) window.localStorage.setItem(CACHE_KEY, JSON.stringify(season))
        else window.localStorage.removeItem(CACHE_KEY)
    } catch {
        return
    }
}
