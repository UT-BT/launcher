import { RefObject, useEffect } from 'react'
import { getDeviceEnvironment, subscribeDeviceEnvironment } from '@/app/device/useDeviceEnvironment'
import type { VisualViewportState } from '@/app/device/deviceEnvironment'

const UNZOOMED_TOLERANCE = 0.01
const TEXT_ENTRY = 'input:not([type=button], [type=checkbox], [type=color], [type=file], [type=image], [type=radio], [type=range], [type=reset], [type=submit]), select, textarea'

function unzoomed(viewport: VisualViewportState): boolean {
    return Math.abs(viewport.scale - 1) <= UNZOOMED_TOLERANCE
}

function editingText(): boolean {
    const focused = document.activeElement
    return focused instanceof HTMLElement && (focused.isContentEditable || focused.matches(TEXT_ENTRY))
}

function resetOffset(element: Element) {
    if (element.scrollTop !== 0 || element.scrollLeft !== 0) element.scrollTo({ top: 0, left: 0, behavior: 'instant' })
}

export function useViewportRecovery(scrollerRef: RefObject<HTMLElement | null>): void {
    useEffect(() => {
        const recover = () => {
            if (!unzoomed(getDeviceEnvironment().viewport) || editingText()) return
            if (window.scrollX !== 0 || window.scrollY !== 0) window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
            for (let node = scrollerRef.current?.parentElement; node; node = node.parentElement) resetOffset(node)
        }
        const recoverAncestor = (event: Event) => {
            const scroller = scrollerRef.current
            if (scroller && event.target instanceof Element && event.target !== scroller && event.target.contains(scroller)) recover()
        }
        let frame = 0
        const recoverAfterFocusMoves = () => {
            cancelAnimationFrame(frame)
            frame = requestAnimationFrame(recover)
        }
        const unsubscribe = subscribeDeviceEnvironment(recover)
        document.addEventListener('scroll', recoverAncestor, { capture: true, passive: true })
        document.addEventListener('focusout', recoverAfterFocusMoves)
        recover()
        return () => {
            cancelAnimationFrame(frame)
            document.removeEventListener('focusout', recoverAfterFocusMoves)
            document.removeEventListener('scroll', recoverAncestor, { capture: true })
            unsubscribe()
        }
    }, [scrollerRef])
}
