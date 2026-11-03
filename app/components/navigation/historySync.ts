export interface HistoryPort {
    readonly state: unknown
    pushState(data: unknown, unused: string, url?: string): void
    replaceState(data: unknown, unused: string, url?: string): void
    go(delta: number): void
}

export interface BlockedHistoryMove {
    message: string
    move: () => void
}

export interface HistoryHost {
    activeId: () => number | undefined
    leaveWarning: () => string | null
    onBlocked: (blocked: BlockedHistoryMove) => void
    show: (navId: number | undefined, position: number) => void
}

interface EntryState {
    navId?: number
    position?: number
    overlay?: number
    through?: boolean
}

interface Overlay {
    at: number | null
    close: () => void
}

function readEntryState(state: unknown): EntryState {
    if (!state || typeof state !== 'object') return {}
    const { navId, position, overlay, through } = state as Record<string, unknown>
    return {
        navId: typeof navId === 'number' ? navId : undefined,
        position: typeof position === 'number' ? position : undefined,
        overlay: typeof overlay === 'number' ? overlay : undefined,
        through: through === true,
    }
}

export function createHistorySync(history: HistoryPort, schedule: (task: () => void) => void) {
    let host: HistoryHost | null = null
    let booted = false
    let position = 0
    let base = 0
    let confirmedPosition: number | null = null
    let traversing = false
    let direction = 0
    const deferred: (() => void)[] = []
    const overlays: Overlay[] = []

    const current = () => readEntryState(history.state)

    const traverse = (delta: number) => {
        traversing = true
        history.go(delta)
    }

    const goConfirmed = (to: number) => {
        confirmedPosition = to
        history.go(to - position)
    }

    const markThrough = () => {
        const entry = current()
        if (entry.overlay && !entry.through) history.replaceState({ ...(history.state as object), through: true }, '')
    }

    const settle = () => {
        if (!host || traversing) return
        let top = base
        for (const overlay of overlays) if (overlay.at !== null) top = Math.max(top, overlay.at)
        for (const overlay of overlays) {
            if (overlay.at !== null) continue
            overlay.at = ++top
            if (top <= position) continue
            markThrough()
            position = top
            history.pushState({ navId: current().navId, position, overlay: position - base }, '')
        }
        if (position > top) traverse(top - position)
    }

    const pushPage = (navId: number, url: string) => {
        if (traversing) {
            deferred.push(() => pushPage(navId, url))
            return
        }
        confirmedPosition = null
        if (position > base) history.replaceState({ navId, position }, '', url)
        else history.pushState({ navId, position: ++position }, '', url)
        base = position
        for (const overlay of overlays) overlay.at = null
    }

    const onPopState = (state: unknown) => {
        traversing = false
        const target = readEntryState(state)
        const to = target.position
        if (host && to !== position) {
            const confirmed = to === confirmedPosition
            confirmedPosition = null
            if (to !== undefined && target.overlay && !overlays.some(overlay => overlay.at === to)) {
                direction = (direction || to - position) < 0 || !target.through ? -1 : 1
                if (confirmed) confirmedPosition = to + direction
                traverse(direction)
                return
            }

            const pageChange = deferred.length === 0 && target.navId !== host.activeId()
            if (to !== undefined && !confirmed && pageChange) {
                const message = host.leaveWarning()
                if (message) {
                    direction = 0
                    traverse(position - to)
                    host.onBlocked({ message, move: () => goConfirmed(to) })
                    return
                }
            }

            for (let i = overlays.length - 1; i >= 0; i--) {
                const overlay = overlays[i]
                if (to === undefined || overlay.at === null || overlay.at <= to) continue
                overlays.splice(i, 1)
                overlay.close()
            }
            position = to ?? position + 1
            base = position - (target.overlay ?? 0)
            if (pageChange) host.show(target.navId, position)
        }
        direction = 0
        for (const push of deferred.splice(0)) push()
        settle()
    }

    return {
        attach(next: HistoryHost, url: string) {
            if (!booted) {
                booted = true
                position = current().position ?? 0
                base = position
                history.replaceState({ navId: next.activeId(), position }, '', url)
            }
            host = next
            settle()
            return () => { host = null }
        },
        pushPage,
        settle,
        register(close: () => void) {
            const overlay: Overlay = { at: null, close }
            overlays.push(overlay)
            settle()
            return () => {
                const index = overlays.indexOf(overlay)
                if (index < 0) return
                overlays.splice(index, 1)
                schedule(settle)
            }
        },
        onPopState,
        back: () => goConfirmed(position - 1),
        forward: () => goConfirmed(position + 1),
    }
}
