import { useEffect, useRef } from 'react'
import { isTypingTarget } from '@/app/utils/typingTarget'
import { shortcutFor, type Shortcut } from './shortcuts'

export type ShortcutHandler = (shortcut: Shortcut) => boolean

function isSlider(target: EventTarget | null): boolean {
    return target instanceof HTMLInputElement && target.type === 'range'
}

function blockedBy(target: EventTarget | null, shortcut: Shortcut): boolean {
    if (isSlider(target)) return shortcut.kind === 'frame'
    return isTypingTarget(target)
}

function insideMenu(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest('[role="menu"], [role="listbox"]') !== null
}

export function useCompareShortcuts(handler: ShortcutHandler) {
    const latest = useRef(handler)

    useEffect(() => {
        latest.current = handler
    })

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.defaultPrevented || insideMenu(event.target)) return
            if (document.querySelector('[data-modal-backdrop]')) return
            const shortcut = shortcutFor(event)
            if (!shortcut || blockedBy(event.target, shortcut)) return
            if (latest.current(shortcut)) event.preventDefault()
        }
        window.addEventListener('keydown', onKeyDown)
        return () => window.removeEventListener('keydown', onKeyDown)
    }, [])
}
