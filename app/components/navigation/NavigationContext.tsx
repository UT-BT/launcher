import { createContext, useContext } from 'react'

export interface NavParams {
    mapName?: string
    playerId?: string | number
    capId?: string
    newsId?: number
    teamId?: string
    mapsNewOnly?: boolean
}

export interface NavEntry {
    id: number
    view: string
    params: NavParams
    state: Record<string, unknown>
}

export interface NavigationContextValue {
    entry: NavEntry
    currentView: string
    navigate: (view: string, params?: NavParams) => void
    back: () => void
    forward: () => void
    canBack: boolean
    canForward: boolean
    getEntryState: <T>(key: string, def: T) => T
    setEntryState: (key: string, value: unknown) => void
}

export const NavigationContext = createContext<NavigationContextValue | null>(null)

export function useNavigation(): NavigationContextValue {
    const ctx = useContext(NavigationContext)
    if (!ctx) throw new Error('useNavigation must be used within a NavigationContext.Provider')
    return ctx
}

export function paramsEqual(a: NavParams, b: NavParams): boolean {
    return a.mapName === b.mapName
        && String(a.playerId ?? '') === String(b.playerId ?? '')
        && a.capId === b.capId
        && a.newsId === b.newsId
        && a.teamId === b.teamId
        && !!a.mapsNewOnly === !!b.mapsNewOnly
}
