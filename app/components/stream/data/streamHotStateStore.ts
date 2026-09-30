import { createPoller } from '@/app/utils/poller'
import { addClockSample, clockSample, medianClockOffset } from '@/app/components/pages/events/pickban/clockOffset'
import { mergeStructurally } from '@/app/components/pages/events/pickban/mergePickBanState'
import { fetchStreamHotState, type StreamHotState } from './streamHotState'
import { createSnapshotStore } from './snapshotStore'

export const RECONNECTING_AFTER_FAILURES = 3

export interface StreamHotStateSnapshot {
    state: StreamHotState | null
    clockOffsetMs: number
    loading: boolean
    error: unknown
    reconnecting: boolean
}

export interface StreamHotStateStore {
    subscribe: (listener: () => void) => () => void
    getSnapshot: () => StreamHotStateSnapshot
    start: () => void
    stop: () => void
    pollNow: () => Promise<void>
}

export interface StreamHotStateStoreOptions {
    eventSlug: string
    streamerId: string
    intervalMs: () => number
    now?: () => number
}

export function createStreamHotStateStore({ eventSlug, streamerId, intervalMs, now = Date.now }: StreamHotStateStoreOptions): StreamHotStateStore {
    const store = createSnapshotStore<StreamHotStateSnapshot>({ state: null, clockOffsetMs: 0, loading: true, error: null, reconnecting: false })
    let etag: string | null = null
    let clockSamples: readonly number[] = []

    const poller = createPoller({
        intervalMs,
        alwaysPoll: true,
        poll: async signal => {
            const sentAt = now()
            const read = await fetchStreamHotState(eventSlug, streamerId, { etag, signal })
            if (signal.aborted) return
            clockSamples = addClockSample(clockSamples, clockSample(read.serverNow, sentAt, now()))
            if (read.kind === 'fresh') etag = read.etag
            const previous = store.getSnapshot().state
            store.publish({
                state: read.kind === 'fresh' ? mergeStructurally(previous, read.state) : previous,
                clockOffsetMs: medianClockOffset(clockSamples),
                loading: false,
                error: null,
                reconnecting: false,
            })
        },
        onSettled: ({ ok, consecutiveFailures, error }) => {
            if (ok) return
            store.publish({ loading: false, error, reconnecting: consecutiveFailures >= RECONNECTING_AFTER_FAILURES })
        },
    })

    return {
        subscribe: store.subscribe,
        getSnapshot: store.getSnapshot,
        start: poller.start,
        stop: poller.stop,
        pollNow: poller.pollNow,
    }
}
