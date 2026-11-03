import { useEffect, useRef, type RefObject } from 'react'
import { capabilities, IS_WEB } from '@/app/platform'
import { pathToNav, viewToPath } from './routes'
import { createHistorySync, type BlockedHistoryMove } from './historySync'
import type { NavEntry, NavParams } from './NavigationContext'

interface UrlSyncArgs {
    stackRef: RefObject<{ entries: NavEntry[]; cursor: number }>
    setCursor: (index: number) => void
    pushExternal: (view: string, params: NavParams) => number
    leaveWarning: () => string | null
    onBlocked: (blocked: BlockedHistoryMove) => void
}

const sync = IS_WEB ? createHistorySync(window.history, task => { setTimeout(task) }) : null
const browserNav = sync && { back: sync.back, forward: sync.forward }

export function seedEntriesFromUrl(): NavEntry[] {
    const target = IS_WEB
        ? pathToNav(window.location.pathname, window.location.search)
        : { view: 'home', params: {} }
    return [{ id: 0, view: target.view, params: target.params, state: {} }]
}

export function pushUrlForEntry(entry: NavEntry): void {
    sync?.pushPage(entry.id, viewToPath(entry.view, entry.params))
}

export function registerOverlay(close: () => void): (() => void) | undefined {
    return capabilities.overlayHistory ? sync?.register(close) : undefined
}

export function useOverlayHistory(open: boolean, close: () => void): void {
    const closeRef = useRef(close)
    useEffect(() => { closeRef.current = close })
    useEffect(() => open ? registerOverlay(() => closeRef.current()) : undefined, [open])
}

export function useUrlSync({ stackRef, setCursor, pushExternal, leaveWarning, onBlocked }: UrlSyncArgs): { back: () => void; forward: () => void } | null {
    useEffect(() => {
        if (!sync) return

        const active = () => stackRef.current?.entries[stackRef.current.cursor]
        const seeded = active()
        const detach = sync.attach({
            activeId: () => active()?.id,
            leaveWarning,
            onBlocked,
            show: (navId, position) => {
                const index = stackRef.current?.entries.findIndex(e => e.id === navId) ?? -1
                if (index >= 0) {
                    setCursor(index)
                    return
                }
                const external = pathToNav(window.location.pathname, window.location.search)
                const id = pushExternal(external.view, external.params)
                window.history.replaceState({ navId: id, position }, '', window.location.pathname + window.location.search)
            },
        }, seeded ? viewToPath(seeded.view, seeded.params) : '/')

        const onPopState = (event: PopStateEvent) => sync.onPopState(event.state)
        window.addEventListener('popstate', onPopState)
        return () => {
            window.removeEventListener('popstate', onPopState)
            detach()
        }
    }, [stackRef, setCursor, pushExternal, leaveWarning, onBlocked])

    const activeId = stackRef.current?.entries[stackRef.current.cursor]?.id
    useEffect(() => { sync?.settle() }, [activeId])

    return browserNav
}
