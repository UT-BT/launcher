import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OVERLAY_IDLE_MS } from '../model/overlayModel'
import type { PlaybackState } from '../playback/playbackController'
import { watchOverlayIdle, type PlayingSource } from './overlayIdle'

function fakeSource(playing = false) {
    let state = { playing } as PlaybackState
    const listeners = new Set<() => void>()
    const source: PlayingSource = {
        getState: () => state,
        subscribe: listener => {
            listeners.add(listener)
            return () => listeners.delete(listener)
        },
    }
    const set = (next: Partial<PlaybackState>) => {
        state = { ...state, ...next }
        listeners.forEach(listener => listener())
    }
    return { source, set, listeners }
}

function watch(playing = false) {
    const fake = fakeSource(playing)
    const shown: boolean[] = []
    const watcher = watchOverlayIdle(fake.source, value => shown.push(value))
    const last = () => shown.at(-1) ?? true
    return { ...fake, watcher, last }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('the overlay auto-hide', () => {
    it('hides the overlays after 2 s with no input during playback', () => {
        const { set, last } = watch()

        set({ playing: true })
        vi.advanceTimersByTime(OVERLAY_IDLE_MS - 1)
        expect(last()).toBe(true)
        vi.advanceTimersByTime(1)
        expect(last()).toBe(false)
    })

    it('brings them back on input and restarts the idle wait', () => {
        const { set, watcher, last } = watch()
        set({ playing: true })
        vi.advanceTimersByTime(OVERLAY_IDLE_MS)

        watcher.wake()
        expect(last()).toBe(true)
        vi.advanceTimersByTime(OVERLAY_IDLE_MS - 1)
        expect(last()).toBe(true)
        watcher.wake()
        vi.advanceTimersByTime(OVERLAY_IDLE_MS - 1)
        expect(last()).toBe(true)
        vi.advanceTimersByTime(1)
        expect(last()).toBe(false)
    })

    it('keeps them while paused, however long nothing happens', () => {
        const { last } = watch()

        vi.advanceTimersByTime(OVERLAY_IDLE_MS * 10)
        expect(last()).toBe(true)
    })

    it('shows them again on pause and keeps them there', () => {
        const { set, last } = watch()
        set({ playing: true })
        vi.advanceTimersByTime(OVERLAY_IDLE_MS)
        expect(last()).toBe(false)

        set({ playing: false })
        expect(last()).toBe(true)
        vi.advanceTimersByTime(OVERLAY_IDLE_MS * 10)
        expect(last()).toBe(true)
    })

    it('starts the idle wait when it begins on a playing clock', () => {
        const { last } = watch(true)

        vi.advanceTimersByTime(OVERLAY_IDLE_MS)
        expect(last()).toBe(false)
    })

    it('ignores state changes that leave playback as it was', () => {
        const { set, last } = watch()
        set({ playing: true })
        vi.advanceTimersByTime(OVERLAY_IDLE_MS - 1)

        set({ t: 1 })
        vi.advanceTimersByTime(1)
        expect(last()).toBe(false)
    })

    it('stops listening and waiting once disposed', () => {
        const { set, watcher, listeners, last } = watch()
        set({ playing: true })

        watcher.dispose()
        vi.advanceTimersByTime(OVERLAY_IDLE_MS)
        expect(last()).toBe(true)
        expect(listeners.size).toBe(0)
    })
})
