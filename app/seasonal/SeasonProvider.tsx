import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useTheme } from '@/app/theme/ThemeProvider'
import { SEASONAL_THEME_ID, resolveAppearance } from './appearance'
import type { EntryId, Hemisphere } from './seasons'
import { readEntryPreview, subscribeSeasonOverride, writeSeasonCache } from './preferences'

const RECHECK_MS = 60 * 60 * 1000
const HEMISPHERE: Hemisphere = 'north'

interface SeasonContextValue {
    seasonal: EntryId | null
    logo: EntryId | null
}

const SeasonContext = createContext<SeasonContextValue>({ seasonal: null, logo: null })

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
    const { seasonal, logo } = resolveAppearance({ now, themeId, preview, hemisphere: HEMISPHERE })
    const cache = resolveAppearance({ now, themeId: SEASONAL_THEME_ID, preview: null, hemisphere: HEMISPHERE })
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

    const value = useMemo(() => ({ seasonal, logo }), [seasonal, logo])
    return <SeasonContext.Provider value={value}>{children}</SeasonContext.Provider>
}

export function useSeasonalEntry(): EntryId | null {
    return useContext(SeasonContext).seasonal
}

export function useLogoEntry(): EntryId | null {
    return useContext(SeasonContext).logo
}
