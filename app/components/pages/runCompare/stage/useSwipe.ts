import { useRef, type PointerEvent } from 'react'
import { swipeOf, type Swipe } from '../model/phoneStage'

export interface SwipeHandlers {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void
    onPointerUp: (event: PointerEvent<HTMLElement>) => void
    onPointerCancel: (event: PointerEvent<HTMLElement>) => void
}

export function useSwipe(onSwipe: (swipe: Swipe) => void): SwipeHandlers {
    const from = useRef<{ pointer: number; x: number; y: number } | null>(null)
    return {
        onPointerDown: event => {
            from.current = event.isPrimary ? { pointer: event.pointerId, x: event.clientX, y: event.clientY } : null
        },
        onPointerUp: event => {
            const start = from.current
            if (start?.pointer !== event.pointerId) return
            from.current = null
            const swipe = swipeOf(event.clientX - start.x, event.clientY - start.y)
            if (swipe) onSwipe(swipe)
        },
        onPointerCancel: event => {
            if (from.current?.pointer === event.pointerId) from.current = null
        },
    }
}
