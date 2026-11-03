export type ReleaseScrollLock = () => void

export interface ScrollLock {
    acquire(): ReleaseScrollLock
    count(): number
    subscribe(listener: () => void): () => void
}

export function createScrollLock(lockScroller: () => ReleaseScrollLock): ScrollLock {
    const listeners = new Set<() => void>()
    let holds = 0
    let unlockScroller: ReleaseScrollLock | null = null

    const notify = () => listeners.forEach(listener => listener())

    return {
        acquire() {
            let held = true
            holds += 1
            if (holds === 1) unlockScroller = lockScroller()
            notify()
            return () => {
                if (!held) return
                held = false
                holds -= 1
                if (holds === 0) {
                    unlockScroller?.()
                    unlockScroller = null
                }
                notify()
            }
        },
        count: () => holds,
        subscribe(listener) {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
        },
    }
}

export const SHELL_SCROLLER = 'main.shell-main'

function scrollbarWidth(element: HTMLElement): number {
    const style = getComputedStyle(element)
    return element.offsetWidth - element.clientWidth - parseFloat(style.borderLeftWidth) - parseFloat(style.borderRightWidth)
}

function lockShellScroller(): ReleaseScrollLock {
    const scroller = document.querySelector<HTMLElement>(SHELL_SCROLLER)
    if (!scroller) return () => {}
    const { overflow, scrollbarGutter } = scroller.style
    if (scrollbarWidth(scroller) > 0.5) scroller.style.scrollbarGutter = 'stable'
    scroller.style.overflow = 'hidden'
    return () => {
        scroller.style.overflow = overflow
        scroller.style.scrollbarGutter = scrollbarGutter
    }
}

const shellScrollLock = createScrollLock(lockShellScroller)

export const lockShellScroll = shellScrollLock.acquire
export const scrollLockCount = shellScrollLock.count
export const subscribeScrollLock = shellScrollLock.subscribe
