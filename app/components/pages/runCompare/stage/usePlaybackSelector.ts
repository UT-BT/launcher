import { useCallback, useRef, useSyncExternalStore } from 'react'
import type { PlaybackController, PlaybackState } from '../playback/playbackController'

const IDLE: PlaybackState = { playing: false, t: 0, end: 0, rate: 1, stalled: [], frozen: [], errored: [], runTimes: {} }

const noSubscription = () => () => undefined

export function usePlaybackSelector<T>(
    controller: PlaybackController | null,
    select: (state: PlaybackState) => T,
    equal: (a: T, b: T) => boolean = Object.is,
): T {
    const cache = useRef<{ state: PlaybackState; select: (state: PlaybackState) => T; value: T } | null>(null)
    const subscribe = useCallback(
        (listener: () => void) => (controller ? controller.subscribe(listener) : noSubscription()),
        [controller],
    )
    const snapshot = () => {
        const state = controller?.getState() ?? IDLE
        const cached = cache.current
        if (cached?.state === state && cached.select === select) return cached.value
        const selected = select(state)
        const value = cached && equal(cached.value, selected) ? cached.value : selected
        cache.current = { state, select, value }
        return value
    }
    return useSyncExternalStore(subscribe, snapshot)
}
