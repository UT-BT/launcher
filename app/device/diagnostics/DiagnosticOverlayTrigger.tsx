import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { isMobileDebugRequested, LONG_PRESS_MS, movedBeyondLongPressTolerance, type Point } from './diagnosticTrigger'

const DiagnosticOverlay = lazy(() => import('./DiagnosticOverlay').then(m => ({ default: m.DiagnosticOverlay })))

const REQUESTED_ON_LOAD = isMobileDebugRequested(window.location.search)
const TRIGGER_SELECTOR = '[data-diagnostic-trigger]'

function isOnTrigger(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest(TRIGGER_SELECTOR) !== null
}

function useTriggerLongPress(onLongPress: () => void) {
    useEffect(() => {
        let timer: number | null = null
        let start: Point | null = null
        let fired = false

        const cancel = () => {
            if (timer !== null) window.clearTimeout(timer)
            timer = null
            start = null
        }
        const handlePointerDown = (event: PointerEvent) => {
            cancel()
            fired = false
            if (!event.isPrimary || event.button !== 0 || !isOnTrigger(event.target)) return
            start = { x: event.clientX, y: event.clientY }
            timer = window.setTimeout(() => {
                cancel()
                fired = true
                onLongPress()
            }, LONG_PRESS_MS)
        }
        const handlePointerMove = (event: PointerEvent) => {
            if (start && movedBeyondLongPressTolerance(start, { x: event.clientX, y: event.clientY })) cancel()
        }
        const handleClick = (event: MouseEvent) => {
            if (!fired) return
            fired = false
            if (!isOnTrigger(event.target)) return
            event.preventDefault()
            event.stopPropagation()
        }
        const handleContextMenu = (event: MouseEvent) => {
            if ((start || fired) && isOnTrigger(event.target)) event.preventDefault()
        }

        document.addEventListener('pointerdown', handlePointerDown, true)
        document.addEventListener('pointermove', handlePointerMove, true)
        document.addEventListener('pointerup', cancel, true)
        document.addEventListener('pointercancel', cancel, true)
        document.addEventListener('click', handleClick, true)
        document.addEventListener('contextmenu', handleContextMenu, true)
        return () => {
            cancel()
            document.removeEventListener('pointerdown', handlePointerDown, true)
            document.removeEventListener('pointermove', handlePointerMove, true)
            document.removeEventListener('pointerup', cancel, true)
            document.removeEventListener('pointercancel', cancel, true)
            document.removeEventListener('click', handleClick, true)
            document.removeEventListener('contextmenu', handleContextMenu, true)
        }
    }, [onLongPress])
}

export function DiagnosticOverlayTrigger() {
    const [open, setOpen] = useState(REQUESTED_ON_LOAD)
    const toggle = useCallback(() => setOpen(current => !current), [])
    const close = useCallback(() => setOpen(false), [])
    useTriggerLongPress(toggle)

    if (!open) return null
    return (
        <Suspense fallback={null}>
            <DiagnosticOverlay onClose={close} />
        </Suspense>
    )
}
