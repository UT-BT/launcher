import { RefObject, useCallback, useEffect, useRef } from 'react'
import { useNavState } from './useNavState'

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
        if (Math.abs(scrollTopRef.current - top) > 24) setScrollTop(top)
    }, [ref, setScrollTop])
}
