import { RefObject, useCallback, useEffect, useRef } from 'react'
import { useNavState } from './useNavState'

/**
 * Restores and persists the scroll position of a detail-page scroll container
 * across Back/Forward, using the active navigation entry's state bag.
 *
 * Restore runs once after `loadingDone` flips true — detail data is async, so
 * restoring before the content has rendered would clamp scrollTop to a smaller
 * scrollHeight. Returns the onScroll handler to attach to the container.
 */
export function useNavScrollRestore(
    ref: RefObject<HTMLElement | null>,
    loadingDone: boolean,
    key = 'scrollTop',
): () => void {
    const [scrollTop, setScrollTop] = useNavState(key, 0)
    const scrollTopRef = useRef(scrollTop)
    scrollTopRef.current = scrollTop
    const restoredRef = useRef(false)

    useEffect(() => {
        if (restoredRef.current || !loadingDone || !ref.current) return
        ref.current.scrollTop = scrollTopRef.current
        restoredRef.current = true
    }, [loadingDone, ref])

    return useCallback(() => {
        if (!ref.current) return
        const top = ref.current.scrollTop
        // Skip sub-24px deltas to avoid thrashing the entry state on every frame.
        if (Math.abs(scrollTopRef.current - top) > 24) setScrollTop(top)
    }, [ref, setScrollTop])
}
