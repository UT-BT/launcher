import { useCallback, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react'

export interface CompareClock {
    now: () => number
    set: (time: number) => void
    subscribe: (listener: () => void) => () => void
}

export function createCompareClock(): CompareClock {
    let time = 0
    const listeners = new Set<() => void>()
    return {
        now: () => time,
        set: next => {
            if (next === time) return
            time = next
            listeners.forEach(listener => listener())
        },
        subscribe: listener => {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
        },
    }
}

export function subscribeThrottled(clock: CompareClock, intervalMs: number, listener: () => void): () => void {
    let heardAt = -Infinity
    let timer: ReturnType<typeof setTimeout> | null = null
    const hear = () => {
        timer = null
        heardAt = Date.now()
        listener()
    }
    const unsubscribe = clock.subscribe(() => {
        if (timer != null) return
        const wait = heardAt + intervalMs - Date.now()
        if (wait <= 0) hear()
        else timer = setTimeout(hear, wait)
    })
    return () => {
        unsubscribe()
        if (timer != null) clearTimeout(timer)
    }
}

export function useClockFrame(clock: CompareClock, paint: (time: number) => void) {
    const paintRef = useRef(paint)
    useLayoutEffect(() => {
        paintRef.current = paint
        paint(clock.now())
    })
    useEffect(() => clock.subscribe(() => paintRef.current(clock.now())), [clock])
}

export function useClockValue<T>(
    clock: CompareClock,
    intervalMs: number,
    select: (time: number) => T,
    same: (a: T, b: T) => boolean,
): T {
    const latest = useRef<{ value: T } | null>(null)
    const subscribe = useCallback(
        (listener: () => void) => subscribeThrottled(clock, intervalMs, listener),
        [clock, intervalMs],
    )
    return useSyncExternalStore(subscribe, () => {
        const next = select(clock.now())
        if (latest.current && same(latest.current.value, next)) return latest.current.value
        latest.current = { value: next }
        return next
    })
}
