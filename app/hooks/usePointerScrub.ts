import { useRef, type PointerEvent as ReactPointerEvent } from 'react'

interface ScrubCallbacks {
    onScrub: (t: number) => void
    onScrubStart?: () => void
    onScrubEnd?: () => void
}

export function usePointerScrub(duration: number, { onScrub, onScrubStart, onScrubEnd }: ScrubCallbacks) {
    const trackRef = useRef<HTMLDivElement>(null)
    const draggingRef = useRef(false)
    const dur = duration > 0 ? duration : 1

    const timeFromClientX = (clientX: number): number => {
        const el = trackRef.current
        if (!el) return 0
        const r = el.getBoundingClientRect()
        if (r.width <= 0) return 0
        return Math.min(1, Math.max(0, (clientX - r.left) / r.width)) * dur
    }

    const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
        draggingRef.current = true
        e.currentTarget.setPointerCapture(e.pointerId)
        onScrubStart?.()
        onScrub(timeFromClientX(e.clientX))
    }
    const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) return
        onScrub(timeFromClientX(e.clientX))
    }
    const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
        if (!draggingRef.current) return
        draggingRef.current = false
        try { e.currentTarget.releasePointerCapture(e.pointerId) } catch { /* ignore */ }
        onScrubEnd?.()
    }

    return { trackRef, dur, pointerHandlers: { onPointerDown, onPointerMove, onPointerUp } }
}
