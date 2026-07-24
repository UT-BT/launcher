import { useCallback, useEffect, type RefObject } from 'react'
import { IS_WEB } from '@/app/platform'
import { pathToNav, viewToPath } from './routes'
import type { NavEntry, NavParams } from './NavigationContext'

interface UrlSyncArgs {
    stackRef: RefObject<{ entries: NavEntry[]; cursor: number }>
    setCursor: (index: number) => void
    pushExternal: (view: string, params: NavParams) => number
}

export function seedEntriesFromUrl(): NavEntry[] {
    const target = IS_WEB
        ? pathToNav(window.location.pathname, window.location.search)
        : { view: 'home', params: {} }
    return [{ id: 0, view: target.view, params: target.params, state: {} }]
}

export function pushUrlForEntry(entry: NavEntry): void {
    if (!IS_WEB) return
    window.history.pushState({ navId: entry.id }, '', viewToPath(entry.view, entry.params))
}

export function useUrlSync({ stackRef, setCursor, pushExternal }: UrlSyncArgs): { back: () => void; forward: () => void } | null {
    useEffect(() => {
        if (!IS_WEB) return

        const stack = stackRef.current
        const active = stack?.entries[stack.cursor]
        const activeId = active?.id ?? 0
        const canonical = active ? viewToPath(active.view, active.params) : '/'
        const current = window.location.pathname + window.location.search
        window.history.replaceState({ navId: activeId }, '', current === canonical ? current : canonical)

        const onPopState = (event: PopStateEvent) => {
            const navId = (event.state as { navId?: number } | null)?.navId
            const current = stackRef.current
            if (navId !== undefined && current) {
                const index = current.entries.findIndex(e => e.id === navId)
                if (index >= 0) {
                    setCursor(index)
                    return
                }
            }
            const target = pathToNav(window.location.pathname, window.location.search)
            const id = pushExternal(target.view, target.params)
            window.history.replaceState({ navId: id }, '', window.location.pathname + window.location.search)
        }

        window.addEventListener('popstate', onPopState)
        return () => window.removeEventListener('popstate', onPopState)
    }, [stackRef, setCursor, pushExternal])

    const back = useCallback(() => window.history.back(), [])
    const forward = useCallback(() => window.history.forward(), [])

    if (!IS_WEB) return null
    return { back, forward }
}
