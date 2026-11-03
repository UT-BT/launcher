import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createCompareClock, subscribeThrottled } from './compareClock'

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('a throttled clock listener', () => {
    it('hears the first change after a quiet spell at once', () => {
        const clock = createCompareClock()
        const heard: number[] = []
        subscribeThrottled(clock, 100, () => heard.push(clock.now()))

        clock.set(1.5)

        expect(heard).toEqual([1.5])
    })

    it('hears the changes inside one interval once, at its end, with the latest time', () => {
        const clock = createCompareClock()
        const heard: number[] = []
        subscribeThrottled(clock, 100, () => heard.push(clock.now()))

        clock.set(1)
        vi.advanceTimersByTime(16)
        clock.set(1.016)
        vi.advanceTimersByTime(16)
        clock.set(1.032)
        expect(heard).toEqual([1])

        vi.advanceTimersByTime(68)
        expect(heard).toEqual([1, 1.032])
    })

    it('hears nothing more once unsubscribed, not even a pending change', () => {
        const clock = createCompareClock()
        const heard: number[] = []
        const unsubscribe = subscribeThrottled(clock, 100, () => heard.push(clock.now()))

        clock.set(1)
        clock.set(2)
        unsubscribe()
        vi.advanceTimersByTime(200)
        clock.set(3)

        expect(heard).toEqual([1])
    })
})
