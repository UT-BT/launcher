import { useEffect, useRef, useState } from 'react'

/**
 * Viewport-derived auto page size, recomputed only *after* the user stops
 * resizing (trailing debounce).
 *
 * Why: the `resize` event fires continuously while a window edge is dragged.
 * Recomputing the page size on every event means it steps through many
 * intermediate values, and on server-paginated pages each distinct value is
 * part of the request cache key — so a single drag can fire a request per few
 * pixels and hammer the backend. Debouncing collapses a whole drag into one
 * update. We also bail out when the recomputed value is unchanged, so a resize
 * that doesn't cross a row boundary triggers no state update (and no refetch).
 *
 * @param compute  Returns the desired page size for the current viewport.
 *                 Usually a stable module-level function per page.
 * @param delay    Quiet period after the last resize event, in ms.
 */
export function useAutoPageSize(compute: () => number, delay = 300): number {
    const computeRef = useRef(compute)
    computeRef.current = compute

    const [pageSize, setPageSize] = useState(() => compute())

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | null = null
        const onResize = () => {
            if (timer) clearTimeout(timer)
            timer = setTimeout(() => {
                const next = computeRef.current()
                setPageSize(prev => (prev === next ? prev : next))
            }, delay)
        }
        window.addEventListener('resize', onResize)
        return () => {
            if (timer) clearTimeout(timer)
            window.removeEventListener('resize', onResize)
        }
    }, [delay])

    return pageSize
}
