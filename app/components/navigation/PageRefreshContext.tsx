import { createContext, useContext, useRef, useState, useCallback, useEffect, type ReactNode } from 'react'

export interface PageRefreshState {
    onRefresh: () => void
    refreshing?: boolean
    disabled?: boolean
    tooltip?: string
}

interface PageRefreshDisplay {
    active: boolean
    refreshing: boolean
    disabled: boolean
    tooltip?: string
}

interface PageRefreshContextValue {
    display: PageRefreshDisplay
    register: (state: PageRefreshState | null) => void
    trigger: () => void
}

const PageRefreshContext = createContext<PageRefreshContextValue | null>(null)

const INACTIVE: PageRefreshDisplay = { active: false, refreshing: false, disabled: false, tooltip: undefined }

export function PageRefreshProvider({ children }: { children: ReactNode }) {
    const [display, setDisplay] = useState<PageRefreshDisplay>(INACTIVE)
    const handlerRef = useRef<(() => void) | null>(null)

    const register = useCallback((state: PageRefreshState | null) => {
        handlerRef.current = state?.onRefresh ?? null
        setDisplay(prev => {
            const next: PageRefreshDisplay = {
                active: !!state,
                refreshing: !!state?.refreshing,
                disabled: !!state?.disabled,
                tooltip: state?.tooltip,
            }
            if (
                prev.active === next.active
                && prev.refreshing === next.refreshing
                && prev.disabled === next.disabled
                && prev.tooltip === next.tooltip
            ) return prev
            return next
        })
    }, [])

    const trigger = useCallback(() => handlerRef.current?.(), [])

    return (
        <PageRefreshContext.Provider value={{ display, register, trigger }}>
            {children}
        </PageRefreshContext.Provider>
    )
}

export function usePageRefresh(): PageRefreshContextValue | null {
    return useContext(PageRefreshContext)
}

export function useRegisterPageRefresh(state: PageRefreshState | null) {
    const ctx = useContext(PageRefreshContext)
    const register = ctx?.register

    useEffect(() => {
        register?.(state)
    })

    useEffect(() => () => register?.(null), [register])
}
