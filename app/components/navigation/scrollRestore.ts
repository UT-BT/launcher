export interface RestorableScroller {
    readonly top: number
    scrollTo(top: number): void
    anchor(enabled: boolean): void
}

export type ReleaseRestoreHold = () => void

export interface ScrollRestore {
    visit(entryId: number): void
    leave(): void
    hold(): ReleaseRestoreHold
    contentChanged(): void
    scrolled(): void
    userScrolling(): void
}

const SAME_PX = 1

function near(a: number, b: number): boolean {
    return Math.abs(a - b) <= SAME_PX
}

export function createScrollRestore(scroller: () => RestorableScroller | null): ScrollRestore {
    const positions = new Map<number, number>()
    let current: number | null = null
    let target: number | null = null
    let reached: number | null = null
    let holds = 0

    const stop = () => {
        target = null
        reached = null
        scroller()?.anchor(true)
    }

    const record = () => {
        const element = scroller()
        if (element && current !== null && target === null) positions.set(current, element.top)
    }

    const apply = () => {
        const element = scroller()
        if (target === null || holds > 0 || !element) return
        element.scrollTo(target)
        if (!near(element.top, target)) return
        reached = target
        target = null
    }

    return {
        visit(entryId) {
            current = entryId
            stop()
            const element = scroller()
            element?.scrollTo(0)
            const saved = positions.get(entryId)
            if (!saved) return
            target = saved
            element?.anchor(false)
            apply()
        },
        leave: record,
        hold() {
            let held = true
            holds += 1
            if (reached !== null) {
                target = reached
                reached = null
            }
            return () => {
                if (!held) return
                held = false
                holds -= 1
                apply()
            }
        },
        contentChanged: apply,
        scrolled() {
            const element = scroller()
            if (element && reached !== null && !near(element.top, reached)) stop()
            record()
        },
        userScrolling: stop,
    }
}
