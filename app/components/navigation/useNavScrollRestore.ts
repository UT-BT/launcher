import { Component, RefObject, useLayoutEffect } from 'react'
import { createScrollRestore } from './scrollRestore'

const USER_SCROLL_EVENTS = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const

let shellScroller: HTMLElement | null = null

const shellScrollRestore = createScrollRestore(() => {
    const scroller = shellScroller
    if (!scroller) return null
    return {
        get top() { return scroller.scrollTop },
        scrollTo: top => scroller.scrollTo({ top, behavior: 'instant' }),
        anchor: enabled => { scroller.style.overflowAnchor = enabled ? '' : 'none' },
    }
})

export function useShellScroller(scrollerRef: RefObject<HTMLElement | null>, contentRef: RefObject<HTMLElement | null>): void {
    useLayoutEffect(() => {
        const scroller = scrollerRef.current
        const content = contentRef.current
        if (!scroller || !content) return
        shellScroller = scroller
        const scrolled = () => shellScrollRestore.scrolled()
        const userScrolling = () => shellScrollRestore.userScrolling()
        scroller.addEventListener('scroll', scrolled, { passive: true })
        USER_SCROLL_EVENTS.forEach(type => scroller.addEventListener(type, userScrolling, { passive: true }))
        const observer = new ResizeObserver(() => shellScrollRestore.contentChanged())
        observer.observe(content)
        return () => {
            observer.disconnect()
            USER_SCROLL_EVENTS.forEach(type => scroller.removeEventListener(type, userScrolling))
            scroller.removeEventListener('scroll', scrolled)
            if (shellScroller === scroller) shellScroller = null
        }
    }, [scrollerRef, contentRef])
}

interface ShellScrollRestoreProps {
    entryId: number
}

export class ShellScrollRestore extends Component<ShellScrollRestoreProps> {
    componentDidMount() {
        shellScrollRestore.visit(this.props.entryId)
    }

    getSnapshotBeforeUpdate(previous: ShellScrollRestoreProps) {
        if (previous.entryId !== this.props.entryId) shellScrollRestore.leave()
        return null
    }

    componentDidUpdate(previous: ShellScrollRestoreProps) {
        if (previous.entryId !== this.props.entryId) shellScrollRestore.visit(this.props.entryId)
    }

    render() {
        return null
    }
}

export function useNavScrollRestore(ready: boolean): void {
    useLayoutEffect(() => {
        if (ready) return
        return shellScrollRestore.hold()
    }, [ready])
}
