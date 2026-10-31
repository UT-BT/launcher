import { useCallback, useEffect, type RefObject } from 'react'
import { IS_WEB } from '@/app/platform'
import { pathToNav, viewToPath } from './routes'
import type { NavEntry, NavParams } from './NavigationContext'

interface HistoryEntryState {
    navId?: number
    position?: number
}

interface BlockedHistoryMove {
    message: string
    move: () => void
}

interface UrlSyncArgs {
    stackRef: RefObject<{ entries: NavEntry[]; cursor: number }>
    setCursor: (index: number) => void
    pushExternal: (view: string, params: NavParams) => number
    leaveWarning: () => string | null
    onBlocked: (blocked: BlockedHistoryMove) => void
}

let position = 0
let confirmedPosition: number | null = null

function readEntryState(state: unknown): HistoryEntryState {
    if (!state || typeof state !== 'object') return {}
    const entry = state as HistoryEntryState
    return {
        navId: typeof entry.navId === 'number' ? entry.navId : undefined,
        position: typeof entry.position === 'number' ? entry.position : undefined,
    }
}

function goConfirmed(to: number) {
    confirmedPosition = to
    window.history.go(to - position)
}

export function seedEntriesFromUrl(): NavEntry[] {
    const target = IS_WEB
        ? pathToNav(window.location.pathname, window.location.search)
        : { view: 'home', params: {} }
    return [{ id: 0, view: target.view, params: target.params, state: {} }]
}

export function pushUrlForEntry(entry: NavEntry): void {
    if (!IS_WEB) return
    position += 1
    confirmedPosition = null
    window.history.pushState({ navId: entry.id, position }, '', viewToPath(entry.view, entry.params))
}

export function useUrlSync({ stackRef, setCursor, pushExternal, leaveWarning, onBlocked }: UrlSyncArgs): { back: () => void; forward: () => void } | null {
    useEffect(() => {
        if (!IS_WEB) return

        const stack = stackRef.current
        const active = stack?.entries[stack.cursor]
        const activeId = active?.id ?? 0
        const canonical = active ? viewToPath(active.view, active.params) : '/'
        const current = window.location.pathname + window.location.search
        position = readEntryState(window.history.state).position ?? 0
        confirmedPosition = null
        window.history.replaceState({ navId: activeId, position }, '', current === canonical ? current : canonical)

        const onPopState = (event: PopStateEvent) => {
            const target = readEntryState(event.state)
            const to = target.position
            if (to === position) return

            const confirmed = to === confirmedPosition
            confirmedPosition = null
            if (to !== undefined && !confirmed) {
                const message = leaveWarning()
                if (message) {
                    window.history.go(position - to)
                    onBlocked({ message, move: () => goConfirmed(to) })
                    return
                }
            }

            position = to ?? position + 1
            const current = stackRef.current
            if (target.navId !== undefined && current) {
                const index = current.entries.findIndex(e => e.id === target.navId)
                if (index >= 0) {
                    setCursor(index)
                    return
                }
            }
            const external = pathToNav(window.location.pathname, window.location.search)
            const id = pushExternal(external.view, external.params)
            window.history.replaceState({ navId: id, position }, '', window.location.pathname + window.location.search)
        }

        window.addEventListener('popstate', onPopState)
        return () => window.removeEventListener('popstate', onPopState)
    }, [stackRef, setCursor, pushExternal, leaveWarning, onBlocked])

    const back = useCallback(() => goConfirmed(position - 1), [])
    const forward = useCallback(() => goConfirmed(position + 1), [])

    if (!IS_WEB) return null
    return { back, forward }
}
