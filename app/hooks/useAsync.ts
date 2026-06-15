import { useCallback, useEffect, useRef, useState } from 'react'

export interface UseAsyncResult<T> {
    data: T | undefined
    loading: boolean
    error: string | null
    reload: () => void
}

export function useAsync<T>(
    fn: (signal: AbortSignal) => Promise<T>,
    deps: unknown[],
    opts?: { enabled?: boolean; errorMessage?: string },
): UseAsyncResult<T> {
    const enabled = opts?.enabled ?? true
    const errorMessage = opts?.errorMessage ?? 'Failed to load data.'
    const [data, setData] = useState<T | undefined>(undefined)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [reloadKey, setReloadKey] = useState(0)

    const fnRef = useRef(fn)
    fnRef.current = fn

    useEffect(() => {
        if (!enabled) return
        const controller = new AbortController()
        setLoading(true)
        setError(null)
        fnRef.current(controller.signal)
            .then((result) => {
                if (!controller.signal.aborted) setData(result)
            })
            .catch((err) => {
                if (controller.signal.aborted || (err as { name?: string })?.name === 'AbortError') return
                console.error('useAsync failed:', err)
                setError(errorMessage)
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        return () => controller.abort()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, reloadKey, ...deps])

    const reload = useCallback(() => setReloadKey((k) => k + 1), [])
    return { data, loading, error, reload }
}

export interface PaginatedResult<T> {
    items: T[]
    total: number
}

export interface UsePaginatedQueryResult<T> {
    page: number
    pageSize: number
    items: T[]
    total: number
    totalPages: number
    loading: boolean
    error: string | null
    setPage: (p: number) => void
    setPageSize: (n: number) => void
}

export function usePaginatedQuery<T>(opts: {
    fetchPage: (params: { limit: number; offset: number; signal: AbortSignal }) => Promise<PaginatedResult<T>>
    deps: unknown[]
    initialPageSize?: number
    enabled?: boolean
    errorMessage?: string
    // Optional controlled mode: pass these (e.g. from useNavState) so page/pageSize
    // survive Back/Forward. Omit for the default uncontrolled (internal state) behavior.
    page?: number
    pageSize?: number
    onPageChange?: (p: number) => void
    onPageSizeChange?: (n: number) => void
}): UsePaginatedQueryResult<T> {
    const { fetchPage, deps, initialPageSize = 10, enabled = true, errorMessage = 'Failed to load data.' } = opts
    const [pageInternal, setPageInternal] = useState(1)
    const [pageSizeInternal, setPageSizeInternal] = useState(initialPageSize)
    const page = opts.page ?? pageInternal
    const pageSize = opts.pageSize ?? pageSizeInternal
    const setPage = opts.onPageChange ?? setPageInternal
    const setPageSize = opts.onPageSizeChange ?? setPageSizeInternal
    const [items, setItems] = useState<T[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchPageRef = useRef(fetchPage)
    fetchPageRef.current = fetchPage

    // Reset to page 1 when the query deps change — but NOT on the first run, or a
    // restored (controlled) page would be clobbered to 1 on every remount.
    const firstResetRef = useRef(true)
    useEffect(() => {
        if (firstResetRef.current) { firstResetRef.current = false; return }
        setPage(1)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps)

    useEffect(() => {
        if (!enabled) return
        const controller = new AbortController()
        setLoading(true)
        setError(null)
        fetchPageRef.current({ limit: pageSize, offset: (page - 1) * pageSize, signal: controller.signal })
            .then((res) => {
                if (controller.signal.aborted) return
                setItems(res.items)
                setTotal(res.total)
            })
            .catch((err) => {
                if (controller.signal.aborted || (err as { name?: string })?.name === 'AbortError') return
                console.error('usePaginatedQuery failed:', err)
                setError(errorMessage)
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        return () => controller.abort()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, page, pageSize, ...deps])

    const totalPages = Math.max(1, Math.ceil(total / pageSize))
    return { page, pageSize, items, total, totalPages, loading, error, setPage, setPageSize }
}
