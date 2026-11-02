import { describe, expect, it } from 'vitest'
import { createScrollLock } from './scrollLock'

function recordingTarget() {
    const events: string[] = []
    const lockScroller = () => {
        events.push('lock')
        return () => { events.push('unlock') }
    }
    return { events, lockScroller }
}

describe('createScrollLock', () => {
    it('locks the scroller on the first hold and frees it when that hold is released', () => {
        const { events, lockScroller } = recordingTarget()
        const lock = createScrollLock(lockScroller)

        const release = lock.acquire()
        expect(lock.count()).toBe(1)
        expect(events).toEqual(['lock'])

        release()
        expect(lock.count()).toBe(0)
        expect(events).toEqual(['lock', 'unlock'])
    })

    it('keeps one lock for stacked holds and frees it only when the last one is released', () => {
        const { events, lockScroller } = recordingTarget()
        const lock = createScrollLock(lockScroller)

        const releaseA = lock.acquire()
        const releaseB = lock.acquire()
        expect(lock.count()).toBe(2)

        releaseB()
        expect(lock.count()).toBe(1)
        expect(events).toEqual(['lock'])

        releaseA()
        expect(lock.count()).toBe(0)
        expect(events).toEqual(['lock', 'unlock'])
    })

    it('frees the scroller whatever order the holds are released in', () => {
        const { events, lockScroller } = recordingTarget()
        const lock = createScrollLock(lockScroller)

        const releaseA = lock.acquire()
        const releaseB = lock.acquire()
        releaseA()
        expect(events).toEqual(['lock'])
        releaseB()
        expect(events).toEqual(['lock', 'unlock'])
    })

    it('ignores a second release of the same hold', () => {
        const { events, lockScroller } = recordingTarget()
        const lock = createScrollLock(lockScroller)

        const releaseA = lock.acquire()
        const releaseB = lock.acquire()
        releaseB()
        releaseB()
        expect(lock.count()).toBe(1)
        expect(events).toEqual(['lock'])

        releaseA()
        releaseA()
        expect(lock.count()).toBe(0)
        expect(events).toEqual(['lock', 'unlock'])
    })

    it('locks again after being fully released', () => {
        const { events, lockScroller } = recordingTarget()
        const lock = createScrollLock(lockScroller)

        lock.acquire()()
        lock.acquire()
        expect(lock.count()).toBe(1)
        expect(events).toEqual(['lock', 'unlock', 'lock'])
    })

    it('tells subscribers each time the count changes, until they unsubscribe', () => {
        const lock = createScrollLock(() => () => {})
        const seen: number[] = []
        const unsubscribe = lock.subscribe(() => seen.push(lock.count()))

        const releaseA = lock.acquire()
        const releaseB = lock.acquire()
        releaseB()
        releaseB()
        unsubscribe()
        releaseA()

        expect(seen).toEqual([1, 2, 1])
    })
})
