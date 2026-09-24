import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPoller, type PollerEnvironment, type PollOutcome } from './poller'

function fakeVisibility(initiallyVisible = true) {
    let visible = initiallyVisible
    const listeners = new Set<() => void>()
    const environment: PollerEnvironment = {
        isVisible: () => visible,
        onVisibilityChange: (listener) => {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
        },
    }
    return {
        environment,
        listeners,
        set(next: boolean) {
            visible = next
            for (const listener of listeners) listener()
        },
    }
}

function deferred() {
    let resolve!: () => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
}

beforeEach(() => {
    vi.useFakeTimers()
})

afterEach(() => {
    vi.useRealTimers()
})

describe('createPoller', () => {
    it('polls at once, then again one interval after each attempt settles', async () => {
        const poll = vi.fn().mockResolvedValue(undefined)
        const poller = createPoller({ poll, intervalMs: () => 1_000, environment: fakeVisibility().environment })

        poller.start()
        await vi.advanceTimersByTimeAsync(0)
        expect(poll).toHaveBeenCalledTimes(1)

        await vi.advanceTimersByTimeAsync(999)
        expect(poll).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(1)
        expect(poll).toHaveBeenCalledTimes(2)
        await vi.advanceTimersByTimeAsync(3_000)
        expect(poll).toHaveBeenCalledTimes(5)
        poller.stop()
    })

    it('reads the interval again after every attempt', async () => {
        let interval = 1_000
        const poll = vi.fn().mockResolvedValue(undefined)
        const poller = createPoller({ poll, intervalMs: () => interval, environment: fakeVisibility().environment })

        poller.start()
        await vi.advanceTimersByTimeAsync(0)
        interval = 10_000
        await vi.advanceTimersByTimeAsync(1_000)
        expect(poll).toHaveBeenCalledTimes(2)
        await vi.advanceTimersByTimeAsync(9_999)
        expect(poll).toHaveBeenCalledTimes(2)
        await vi.advanceTimersByTimeAsync(1)
        expect(poll).toHaveBeenCalledTimes(3)
        poller.stop()
    })

    it('never overlaps two attempts', async () => {
        const slow = deferred()
        const poll = vi.fn().mockReturnValueOnce(slow.promise).mockResolvedValue(undefined)
        const poller = createPoller({ poll, intervalMs: () => 1_000, environment: fakeVisibility().environment })

        poller.start()
        await vi.advanceTimersByTimeAsync(5_000)
        const again = poller.pollNow()
        expect(poll).toHaveBeenCalledTimes(1)

        slow.resolve()
        await again
        await vi.advanceTimersByTimeAsync(1_000)
        expect(poll).toHaveBeenCalledTimes(2)
        poller.stop()
    })

    it('rests while the document is hidden and polls the moment it is visible again', async () => {
        const visibility = fakeVisibility()
        const poll = vi.fn().mockResolvedValue(undefined)
        const poller = createPoller({ poll, intervalMs: () => 1_000, environment: visibility.environment })

        poller.start()
        await vi.advanceTimersByTimeAsync(0)
        visibility.set(false)
        await vi.advanceTimersByTimeAsync(60_000)
        expect(poll).toHaveBeenCalledTimes(1)

        visibility.set(true)
        await vi.advanceTimersByTimeAsync(0)
        expect(poll).toHaveBeenCalledTimes(2)
        await vi.advanceTimersByTimeAsync(1_000)
        expect(poll).toHaveBeenCalledTimes(3)
        poller.stop()
    })

    it('still loads once when started in a hidden document, then waits for it to show', async () => {
        const visibility = fakeVisibility(false)
        const poll = vi.fn().mockResolvedValue(undefined)
        const poller = createPoller({ poll, intervalMs: () => 1_000, environment: visibility.environment })

        poller.start()
        await vi.advanceTimersByTimeAsync(30_000)

        expect(poll).toHaveBeenCalledTimes(1)
        poller.stop()
    })

    it('keeps polling a hidden document in always-poll mode', async () => {
        const visibility = fakeVisibility(false)
        const poll = vi.fn().mockResolvedValue(undefined)
        const poller = createPoller({ poll, intervalMs: () => 1_000, alwaysPoll: true, environment: visibility.environment })

        poller.start()
        await vi.advanceTimersByTimeAsync(3_000)

        expect(poll).toHaveBeenCalledTimes(4)
        poller.stop()
    })

    it('counts consecutive failures and resets the count on success', async () => {
        const outcomes: PollOutcome[] = []
        const poll = vi.fn()
            .mockRejectedValueOnce(new Error('offline'))
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValue(undefined)
        const poller = createPoller({
            poll,
            intervalMs: () => 1_000,
            environment: fakeVisibility().environment,
            onSettled: (outcome) => outcomes.push(outcome),
        })

        poller.start()
        await vi.advanceTimersByTimeAsync(2_000)

        expect(outcomes.map((o) => [o.ok, o.consecutiveFailures])).toEqual([[false, 1], [false, 2], [true, 0]])
        expect(outcomes[0].error).toEqual(new Error('offline'))
        poller.stop()
    })

    it('aborts the attempt in flight on stop and reports nothing after it', async () => {
        const hanging = deferred()
        const signals: AbortSignal[] = []
        const onSettled = vi.fn()
        const poll = vi.fn((signal: AbortSignal) => {
            signals.push(signal)
            return hanging.promise
        })
        const visibility = fakeVisibility()
        const poller = createPoller({ poll, intervalMs: () => 1_000, environment: visibility.environment, onSettled })

        poller.start()
        await vi.advanceTimersByTimeAsync(0)
        poller.stop()

        expect(signals[0].aborted).toBe(true)
        expect(visibility.listeners.size).toBe(0)
        hanging.reject(new DOMException('aborted', 'AbortError'))
        await vi.advanceTimersByTimeAsync(10_000)
        expect(poll).toHaveBeenCalledTimes(1)
        expect(onSettled).not.toHaveBeenCalled()
    })

    it('starts cleanly again right after a stop, while the aborted attempt is still settling', async () => {
        const hanging = deferred()
        const poll = vi.fn().mockReturnValueOnce(hanging.promise).mockResolvedValue(undefined)
        const poller = createPoller({ poll, intervalMs: () => 1_000, environment: fakeVisibility().environment })

        poller.start()
        poller.stop()
        poller.start()
        await vi.advanceTimersByTimeAsync(0)
        expect(poll).toHaveBeenCalledTimes(2)

        hanging.resolve()
        await vi.advanceTimersByTimeAsync(1_000)
        expect(poll).toHaveBeenCalledTimes(3)
        poller.stop()
    })
})
