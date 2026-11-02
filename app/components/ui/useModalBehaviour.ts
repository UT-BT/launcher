import { useEffect, useLayoutEffect, type RefObject } from 'react'
import { focusFirst, isTopMostModal, openerOf, returnFocus, trapTab } from './modalFocus'
import { lockShellScroll } from './scrollLock'

export function useModalBehaviour(panelRef: RefObject<HTMLElement | null>, isOpen: boolean, onEscape?: () => void, lockScroll = true) {
    useLayoutEffect(() => {
        if (!isOpen || !lockScroll) return
        return lockShellScroll()
    }, [isOpen, lockScroll])

    useEffect(() => {
        if (!isOpen || !onEscape) return

        const handleKeyDown = (e: KeyboardEvent) => {
            const panel = panelRef.current
            if (e.key === 'Escape' && panel && isTopMostModal(panel)) {
                e.preventDefault()
                e.stopImmediatePropagation()
                onEscape()
            }
        }

        document.addEventListener('keydown', handleKeyDown, true)
        return () => document.removeEventListener('keydown', handleKeyDown, true)
    }, [isOpen, onEscape, panelRef])

    useEffect(() => {
        const panel = panelRef.current
        if (!isOpen || !panel) return

        const opener = openerOf(panel)
        focusFirst(panel)

        const handleTabKey = (e: KeyboardEvent) => {
            if (e.key === 'Tab' && !e.defaultPrevented && isTopMostModal(panel)) trapTab(e, panel)
        }

        document.addEventListener('keydown', handleTabKey)
        return () => {
            document.removeEventListener('keydown', handleTabKey)
            returnFocus(opener, panel)
        }
    }, [isOpen, panelRef])
}
