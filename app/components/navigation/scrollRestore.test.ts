import { describe, expect, it } from 'vitest'
import { createScrollRestore } from './scrollRestore'

function fakeScroller(maxTop = 2000) {
    const scroller = {
        top: 0,
        maxTop,
        anchoring: true,
        scrollTo(top: number) {
            scroller.top = Math.max(0, Math.min(top, scroller.maxTop))
        },
        anchor(enabled: boolean) {
            scroller.anchoring = enabled
        },
    }
    return scroller
}

function userScrollsTo(scroller: ReturnType<typeof fakeScroller>, restore: ReturnType<typeof createScrollRestore>, top: number) {
    restore.userScrolling()
    scroller.scrollTo(top)
    restore.scrolled()
}

describe('createScrollRestore', () => {
    it('starts a new entry at the top, wherever the previous page was', () => {
        const scroller = fakeScroller()
        const restore = createScrollRestore(() => scroller)

        restore.visit(1)
        userScrollsTo(scroller, restore, 640)
        restore.visit(2)

        expect(scroller.top).toBe(0)
    })

    it('returns an entry to where it was left', () => {
        const scroller = fakeScroller()
        const restore = createScrollRestore(() => scroller)

        restore.visit(1)
        userScrollsTo(scroller, restore, 640)
        restore.visit(2)
        userScrollsTo(scroller, restore, 120)
        restore.visit(1)
        expect(scroller.top).toBe(640)

        restore.visit(2)
        expect(scroller.top).toBe(120)
    })

    it('keeps a returning page at the top while it holds the restore, then restores when it lets go', () => {
        const scroller = fakeScroller()
        const restore = createScrollRestore(() => scroller)

        restore.visit(1)
        userScrollsTo(scroller, restore, 640)
        restore.visit(2)
        userScrollsTo(scroller, restore, 300)
        const ready = restore.hold()
        restore.visit(1)
        expect(scroller.top).toBe(0)

        ready()
        expect(scroller.top).toBe(640)
    })

    it('restores only once every hold is released, and a second release of the same hold does nothing', () => {
        const scroller = fakeScroller()
        const restore = createScrollRestore(() => scroller)

        restore.visit(1)
        userScrollsTo(scroller, restore, 640)
        restore.visit(2)
        const first = restore.hold()
        const second = restore.hold()
        restore.visit(1)

        first()
        first()
        expect(scroller.top).toBe(0)

        second()
        expect(scroller.top).toBe(640)
    })

    it('keeps restoring as the page grows until the saved position fits', () => {
        const scroller = fakeScroller()
        const restore = createScrollRestore(() => scroller)

        restore.visit(1)
        userScrollsTo(scroller, restore, 640)
        restore.visit(2)
        scroller.maxTop = 200
        restore.visit(1)
        expect(scroller.top).toBe(200)

        scroller.maxTop = 500
        restore.contentChanged()
        expect(scroller.top).toBe(500)

        scroller.maxTop = 1500
        restore.contentChanged()
        expect(scroller.top).toBe(640)
    })

    it('keeps the saved position through the scroll events of an unfinished restore', () => {
        const scroller = fakeScroller()
        const restore = createScrollRestore(() => scroller)

        restore.visit(1)
        userScrollsTo(scroller, restore, 640)
        restore.visit(2)
        scroller.maxTop = 200
        restore.visit(1)
        restore.scrolled()
        restore.visit(2)

        scroller.maxTop = 1500
        restore.visit(1)
        expect(scroller.top).toBe(640)
    })

    it('stops restoring once the user scrolls, and remembers where the user went', () => {
        const scroller = fakeScroller()
        const restore = createScrollRestore(() => scroller)

        restore.visit(1)
        userScrollsTo(scroller, restore, 640)
        restore.visit(2)
        scroller.maxTop = 200
        restore.visit(1)
        userScrollsTo(scroller, restore, 80)

        scroller.maxTop = 1500
        restore.contentChanged()
        expect(scroller.top).toBe(80)

        restore.visit(2)
        restore.visit(1)
        expect(scroller.top).toBe(80)
    })

    it('keeps the position a page had when it was left, even when no scroll event reported it', () => {
        const scroller = fakeScroller()
        const restore = createScrollRestore(() => scroller)

        restore.visit(1)
        scroller.scrollTo(900)
        restore.leave()
        restore.visit(2)
        restore.leave()
        restore.visit(1)

        expect(scroller.top).toBe(900)
    })

    it('keeps the saved position when a page is left before its restore finished', () => {
        const scroller = fakeScroller()
        const restore = createScrollRestore(() => scroller)

        restore.visit(1)
        userScrollsTo(scroller, restore, 640)
        restore.leave()
        restore.visit(2)
        restore.leave()
        scroller.maxTop = 200
        restore.visit(1)
        restore.leave()
        restore.visit(2)

        scroller.maxTop = 1500
        restore.visit(1)
        expect(scroller.top).toBe(640)
    })

    it('keeps scroll anchoring off on a restored page until something else scrolls it', () => {
        const scroller = fakeScroller()
        const restore = createScrollRestore(() => scroller)

        restore.visit(1)
        userScrollsTo(scroller, restore, 640)
        restore.leave()
        restore.visit(2)
        expect(scroller.anchoring, 'a new page keeps scroll anchoring').toBe(true)
        restore.leave()
        restore.visit(1)
        expect(scroller.top).toBe(640)
        expect(scroller.anchoring, 'content loading in above cannot shift the restored page').toBe(false)

        restore.contentChanged()
        restore.scrolled()
        expect(scroller.top).toBe(640)
        expect(scroller.anchoring).toBe(false)

        scroller.scrollTo(0)
        scroller.maxTop = 2500
        restore.contentChanged()
        expect(scroller.top, 'a restore that reached its position never pulls the page back').toBe(0)

        restore.scrolled()
        expect(scroller.anchoring).toBe(true)
        restore.leave()
        restore.visit(2)
        restore.leave()
        restore.visit(1)
        expect(scroller.top).toBe(0)
    })

    it('keeps restoring through scroll events until the saved position is reached', () => {
        const scroller = fakeScroller()
        const restore = createScrollRestore(() => scroller)

        restore.visit(1)
        userScrollsTo(scroller, restore, 640)
        restore.leave()
        restore.visit(2)
        restore.leave()
        scroller.maxTop = 300
        restore.visit(1)
        expect(scroller.top).toBe(300)
        restore.scrolled()

        scroller.maxTop = 0
        scroller.scrollTo(scroller.top)
        scroller.maxTop = 1500
        restore.scrolled()
        restore.contentChanged()
        expect(scroller.top, 'a clamp whose scroll event arrives after the page grew back').toBe(640)
    })

    it('resumes a finished restore when the page starts loading again before anyone scrolled', () => {
        const scroller = fakeScroller()
        const restore = createScrollRestore(() => scroller)

        restore.visit(1)
        userScrollsTo(scroller, restore, 640)
        restore.leave()
        restore.visit(2)
        restore.leave()
        restore.visit(1)
        expect(scroller.top).toBe(640)

        const reloaded = restore.hold()
        scroller.maxTop = 0
        scroller.scrollTo(scroller.top)
        restore.scrolled()
        scroller.maxTop = 1500
        reloaded()
        expect(scroller.top).toBe(640)

        userScrollsTo(scroller, restore, 100)
        const refreshed = restore.hold()
        scroller.maxTop = 0
        scroller.scrollTo(scroller.top)
        restore.scrolled()
        scroller.maxTop = 1500
        refreshed()
        expect(scroller.top, 'once the user has scrolled, a reload does not bring the old position back').toBe(0)
    })
})
