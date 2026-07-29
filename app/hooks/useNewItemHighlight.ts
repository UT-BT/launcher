import { useEffect, useRef, useState, useCallback } from 'react'

export type HighlightView = 'maps' | 'world-records' | 'events' | 'news'

const FALLBACK_WINDOW_MS = 7 * 24 * 3600 * 1000
const HIGHLIGHT_DURATION_MS = 7000

function pendingKey(view: HighlightView): string {
    return `utbt:highlightSince:${view}`
}

export function writePendingHighlight(view: HighlightView, since: string | null): void {
    if (typeof window === 'undefined') return
    try {
        window.sessionStorage.setItem(pendingKey(view), JSON.stringify({ since }))
    } catch {
        return
    }
}

function consumePendingHighlight(view: HighlightView): string | null | undefined {
    if (typeof window === 'undefined') return undefined
    try {
        const raw = window.sessionStorage.getItem(pendingKey(view))
        if (raw == null) return undefined
        window.sessionStorage.removeItem(pendingKey(view))
        const parsed = JSON.parse(raw) as { since?: string | null }
        return parsed.since ?? null
    } catch {
        return undefined
    }
}

const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/

function parseTimestamp(value: string): number {
    if (NAIVE_DATETIME.test(value)) return Date.parse(`${value.replace(' ', 'T')}Z`)
    return Date.parse(value)
}

function sinceMs(since: string | null): number {
    const parsed = since ? parseTimestamp(since) : NaN
    return Number.isNaN(parsed) ? Date.now() - FALLBACK_WINDOW_MS : parsed
}

export function useNewItemHighlight(view: HighlightView, onActivate?: () => void, itemsReady = true) {
    const [since, setSince] = useState<number | null>(null)
    const scrolledRef = useRef(false)
    const onActivateRef = useRef(onActivate)
    onActivateRef.current = onActivate

    const activate = useCallback((sinceIso: string | null) => {
        scrolledRef.current = false
        setSince(sinceMs(sinceIso))
        onActivateRef.current?.()
    }, [])

    useEffect(() => {
        const pending = consumePendingHighlight(view)
        if (pending !== undefined) activate(pending)

        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { view?: string; since?: string | null } | undefined
            if (!detail || detail.view !== view) return
            activate(detail.since ?? null)
        }
        window.addEventListener('highlight-new', handler)
        return () => window.removeEventListener('highlight-new', handler)
    }, [view, activate])

    useEffect(() => {
        if (since == null || !itemsReady) return
        const t = setTimeout(() => setSince(null), HIGHLIGHT_DURATION_MS)
        return () => clearTimeout(t)
    }, [since, itemsReady])

    const isNew = useCallback((addedIso: string | null | undefined): boolean => {
        if (since == null || !addedIso) return false
        const t = parseTimestamp(addedIso)
        return !Number.isNaN(t) && t > since
    }, [since])

    const registerFirstNew = useCallback((el: HTMLElement | null) => {
        if (!el || scrolledRef.current) return
        scrolledRef.current = true
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, [])

    return { active: since != null, isNew, registerFirstNew }
}
