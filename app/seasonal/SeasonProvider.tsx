import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react'
import { activeSeason, resolveSeason, type SeasonId } from './seasons'
import { loadSeasonalThemes, readSeasonOverride, subscribeSeasonalThemes, subscribeSeasonOverride, writeSeasonCache } from './preferences'

const RECHECK_MS = 60 * 60 * 1000

const SeasonContext = createContext<SeasonId | null>(null)

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
    const enabled = useSyncExternalStore(subscribeSeasonalThemes, loadSeasonalThemes, () => true)
    const override = useSyncExternalStore(subscribeSeasonOverride, readSeasonOverride, () => null)
    const dateSeason = activeSeason(now)
    const dateSeasonId = dateSeason?.id ?? null
    const dateSeasonUntil = dateSeason?.until ?? 0
    const season = resolveSeason({ dateSeason: dateSeasonId, enabled, override })

    useEffect(() => {
        writeSeasonCache(dateSeasonId ? { id: dateSeasonId, until: dateSeasonUntil } : null)
    }, [dateSeasonId, dateSeasonUntil])

    useEffect(() => {
        const root = document.documentElement
        if (season) root.setAttribute('data-season', season)
        else root.removeAttribute('data-season')
    }, [season])

    return <SeasonContext.Provider value={season}>{children}</SeasonContext.Provider>
}

export function useSeason(): SeasonId | null {
    return useContext(SeasonContext)
}
