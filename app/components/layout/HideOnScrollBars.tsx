import { useLayoutEffect, type RefObject } from 'react'
import { scrollLockCount, subscribeScrollLock } from '@/app/components/ui/scrollLock'
import { barsAfterInput, barsAfterScroll, barsShownAt } from './barVisibility'

const USER_SCROLL_INPUTS = ['touchmove', 'wheel', 'keydown'] as const

interface HideOnScrollBarsProps {
    scrollerRef: RefObject<HTMLElement | null>
    entryId: number
    drawerOpen: boolean
    onHiddenChange: (hidden: boolean) => void
}

export function HideOnScrollBars({ scrollerRef, entryId, drawerOpen, onHiddenChange }: HideOnScrollBarsProps) {
    useLayoutEffect(() => {
        const scroller = scrollerRef.current
        if (!scroller) return
        let state = barsShownAt(scroller.scrollTop)
        const input = () => { state = barsAfterInput(state, performance.now()) }
        const scrolled = () => {
            state = barsAfterScroll(state, {
                top: scroller.scrollTop,
                max: scroller.scrollHeight - scroller.clientHeight,
                now: performance.now(),
            })
            onHiddenChange(!state.visible)
        }
        const unlocked = () => {
            if (scrollLockCount() > 0) return
            state = barsShownAt(scroller.scrollTop)
            onHiddenChange(false)
        }
        USER_SCROLL_INPUTS.forEach(type => scroller.addEventListener(type, input, { passive: true }))
        scroller.addEventListener('scroll', scrolled, { passive: true })
        const unsubscribe = subscribeScrollLock(unlocked)
        return () => {
            onHiddenChange(false)
            unsubscribe()
            scroller.removeEventListener('scroll', scrolled)
            USER_SCROLL_INPUTS.forEach(type => scroller.removeEventListener(type, input))
        }
    }, [scrollerRef, entryId, drawerOpen, onHiddenChange])

    return null
}
