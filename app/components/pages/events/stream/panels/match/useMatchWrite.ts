import { useEffect, useRef, useState } from 'react'
import { useStreamTab } from '../../StreamTabContext'
import type { BroadcastTarget } from './scoreActions'

const CLOCK_TICK_MS = 30_000

export function useServerNow(clockOffsetMs: number): number {
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), CLOCK_TICK_MS)
        return () => clearInterval(timer)
    }, [])

    return now + clockOffsetMs
}

function errorText(error: unknown): string {
    return error instanceof Error && error.message ? error.message : 'Something went wrong.'
}

export function useMatchWrite() {
    const { eventSlug, accessToken, desk, deskLoading, deskError, clockOffsetMs, refresh } = useStreamTab()
    const writing = useRef(false)
    const [pending, setPending] = useState(false)
    const [writeError, setWriteError] = useState<string | null>(null)
    const match = desk?.match ?? null

    const run = async (write: (target: BroadcastTarget) => Promise<unknown>) => {
        if (writing.current || !match) return
        writing.current = true
        setPending(true)
        setWriteError(null)
        try {
            await write({ accessToken, slug: eventSlug, matchId: match.id })
        } catch (error) {
            setWriteError(errorText(error))
        } finally {
            await refresh()
            writing.current = false
            setPending(false)
        }
    }

    return {
        match,
        loading: !desk && (deskLoading || !deskError),
        loadError: !desk && !deskLoading && deskError ? errorText(deskError) : null,
        clockOffsetMs,
        pending,
        writeError,
        run,
    }
}
