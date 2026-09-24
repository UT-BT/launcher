export interface PollerEnvironment {
    isVisible: () => boolean
    onVisibilityChange: (listener: () => void) => () => void
}

export interface PollOutcome {
    ok: boolean
    consecutiveFailures: number
    error?: unknown
}

export interface PollerOptions {
    poll: (signal: AbortSignal) => Promise<void>
    intervalMs: () => number
    alwaysPoll?: boolean
    environment?: PollerEnvironment
    onSettled?: (outcome: PollOutcome) => void
}

export interface Poller {
    start: () => void
    stop: () => void
    pollNow: () => Promise<void>
    reschedule: () => void
}

export const documentVisibility: PollerEnvironment = {
    isVisible: () => typeof document === 'undefined' || document.visibilityState !== 'hidden',
    onVisibilityChange: (listener) => {
        if (typeof document === 'undefined') return () => undefined
        document.addEventListener('visibilitychange', listener)
        return () => document.removeEventListener('visibilitychange', listener)
    },
}

export function createPoller({
    poll,
    intervalMs,
    alwaysPoll = false,
    environment = documentVisibility,
    onSettled,
}: PollerOptions): Poller {
    let running = false
    let timer: ReturnType<typeof setTimeout> | null = null
    let controller: AbortController | null = null
    let inFlight: Promise<void> | null = null
    let consecutiveFailures = 0
    let stopWatchingVisibility: (() => void) | null = null

    const shouldKeepPolling = () => running && (alwaysPoll || environment.isVisible())

    const clearTimer = () => {
        if (timer === null) return
        clearTimeout(timer)
        timer = null
    }

    const schedule = () => {
        clearTimer()
        if (inFlight || !shouldKeepPolling()) return
        timer = setTimeout(() => {
            timer = null
            void pollNow()
        }, intervalMs())
    }

    const attemptPoll = async (signal: AbortSignal) => {
        await poll(signal)
    }

    const pollNow = (): Promise<void> => {
        if (inFlight) return inFlight
        if (!running) return Promise.resolve()
        clearTimer()
        const attemptController = new AbortController()
        const attempt = attemptPoll(attemptController.signal)
            .then(
                () => {
                    if (attemptController.signal.aborted) return
                    consecutiveFailures = 0
                    onSettled?.({ ok: true, consecutiveFailures })
                },
                (error: unknown) => {
                    if (attemptController.signal.aborted) return
                    consecutiveFailures += 1
                    onSettled?.({ ok: false, consecutiveFailures, error })
                },
            )
            .finally(() => {
                if (inFlight !== attempt) return
                inFlight = null
                controller = null
                schedule()
            })
        controller = attemptController
        inFlight = attempt
        return attempt
    }

    const onVisibilityChange = () => {
        if (!running || alwaysPoll) return
        if (environment.isVisible()) void pollNow()
        else clearTimer()
    }

    return {
        start() {
            if (running) return
            running = true
            stopWatchingVisibility = environment.onVisibilityChange(onVisibilityChange)
            void pollNow()
        },

        stop() {
            running = false
            clearTimer()
            controller?.abort()
            controller = null
            inFlight = null
            stopWatchingVisibility?.()
            stopWatchingVisibility = null
        },

        pollNow,

        reschedule() {
            if (!inFlight) schedule()
        },
    }
}
