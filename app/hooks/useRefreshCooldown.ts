import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Throttles a refresh action. Returns a wrapper that swallows calls within the
 * cooldown window, plus the remaining cooldown in seconds so the UI can show a
 * tooltip / disabled state.
 */
export function useRefreshCooldown(cooldownMs = 3000) {
    const [lastRefreshAt, setLastRefreshAt] = useState(0)
    const [, setTick] = useState(0)
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        if (lastRefreshAt === 0) return
        const elapsed = Date.now() - lastRefreshAt
        if (elapsed >= cooldownMs) return

        intervalRef.current = setInterval(() => {
            setTick(t => t + 1)
            if (Date.now() - lastRefreshAt >= cooldownMs) {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current)
                    intervalRef.current = null
                }
            }
        }, 200)

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current)
                intervalRef.current = null
            }
        }
    }, [lastRefreshAt, cooldownMs])

    const elapsed = Date.now() - lastRefreshAt
    const remainingMs = lastRefreshAt === 0 ? 0 : Math.max(0, cooldownMs - elapsed)
    const canRefresh = remainingMs === 0
    const remainingSeconds = Math.ceil(remainingMs / 1000)

    const trigger = useCallback((cb: () => void | Promise<void>) => {
        if (Date.now() - lastRefreshAt < cooldownMs && lastRefreshAt !== 0) return false
        setLastRefreshAt(Date.now())
        void cb()
        return true
    }, [lastRefreshAt, cooldownMs])

    return { canRefresh, remainingMs, remainingSeconds, trigger }
}
