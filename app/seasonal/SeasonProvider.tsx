import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useTheme } from '@/app/theme/ThemeProvider'
import { SEASONAL_THEME_ID, resolveAppearance } from './appearance'
import { detectHemisphere, deviceTimeZone, resolveHemisphere, type Hemisphere, type HemisphereSetting } from './hemisphere'
import type { EntryId } from './seasons'
import {
    loadHemisphereSetting,
    readEntryPreview,
    readHemisphereOverride,
    subscribeHemisphereOverride,
    subscribeHemisphereSetting,
    subscribeSeasonOverride,
    writeSeasonCache,
} from './preferences'

const RECHECK_MS = 60 * 60 * 1000

export interface HemisphereState {
    resolved: Hemisphere
    detected: Hemisphere
    setting: HemisphereSetting
}

interface SeasonContextValue {
    seasonal: EntryId | null
    logo: EntryId | null
    hemisphere: HemisphereState
}

const SeasonContext = createContext<SeasonContextValue>({
    seasonal: null,
    logo: null,
    hemisphere: { resolved: 'north', detected: 'north', setting: 'auto' },
})

function useNow(): Date {
    const [now, setNow] = useState(() => new Date())
    useEffect(() => {
        const tick = () => setNow(new Date())
        window.addEventListener('focus', tick)
        const interval = window.setInterval(tick, RECHECK_MS)
        return () => {
            window.removeEventListener('focus', tick)
            window.clearInterval(interval)
        }
    }, [])
    return now
}

export function SeasonProvider({ children }: { children: ReactNode }) {
    const now = useNow()
    const { themeId, setPreviewThemeId } = useTheme()
    const preview = useSyncExternalStore(subscribeSeasonOverride, readEntryPreview, () => null)
    const hemisphereSetting = useSyncExternalStore(subscribeHemisphereSetting, loadHemisphereSetting, () => 'auto' as const)
    const hemispherePreview = useSyncExternalStore(subscribeHemisphereOverride, readHemisphereOverride, () => null)
    const timeZone = deviceTimeZone()
    const { seasonal, logo } = resolveAppearance({ now, themeId, preview, timeZone, hemisphereSetting, hemispherePreview })
    const cache = resolveAppearance({ now, themeId: SEASONAL_THEME_ID, preview: null, timeZone, hemisphereSetting, hemispherePreview: null })
    const detected = detectHemisphere(timeZone)
    const resolved = resolveHemisphere({ timeZone, setting: hemisphereSetting, preview: hemispherePreview })
    const previewingEntry = preview !== null && preview !== 'none'

    useEffect(() => {
        writeSeasonCache({ id: cache.seasonal, until: cache.until })
    }, [cache.seasonal, cache.until])

    useEffect(() => {
        setPreviewThemeId(previewingEntry ? SEASONAL_THEME_ID : null)
    }, [previewingEntry, setPreviewThemeId])

    useEffect(() => {
        const root = document.documentElement
        if (seasonal) root.setAttribute('data-season', seasonal)
        else root.removeAttribute('data-season')
    }, [seasonal])

    const value = useMemo(
        () => ({ seasonal, logo, hemisphere: { resolved, detected, setting: hemisphereSetting } }),
        [seasonal, logo, resolved, detected, hemisphereSetting],
    )
    return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>
}

export function useSeasonalEntry(): EntryId | null {
    return useContext(SeasonContext).seasonal
}

export function useLogoEntry(): EntryId | null {
    return useContext(SeasonContext).logo
}

export function useHemisphere(): HemisphereState {
    return useContext(SeasonContext).hemisphere
}
