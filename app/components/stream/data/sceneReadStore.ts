import { createPoller } from '@/app/utils/poller'
import { mergeStructurally } from '@/app/components/pages/events/pickban/mergePickBanState'
import { readConditional } from './conditionalRead'
import { createSnapshotStore } from './snapshotStore'
import { RECONNECTING_AFTER_FAILURES } from './streamHotStateStore'

export interface SceneReadSnapshot<T> {
    data: T | null
    loading: boolean
    error: unknown
    reconnecting: boolean
}

export interface SceneReadStore<T> {
    subscribe: (listener: () => void) => () => void
    getSnapshot: () => SceneReadSnapshot<T>
    start: () => void
    stop: () => void
    pollNow: () => Promise<void>
}

export interface SceneReadStoreOptions {
    path: string
    intervalMs: () => number
}

export function createSceneReadStore<T extends object>({ path, intervalMs }: SceneReadStoreOptions): SceneReadStore<T> {
    const store = createSnapshotStore<SceneReadSnapshot<T>>({ data: null, loading: true, error: null, reconnecting: false })
    let etag: string | null = null

    const poller = createPoller({
        intervalMs,
        alwaysPoll: true,
        poll: async signal => {
            const read = await readConditional(path, { etag, signal })
            if (signal.aborted) return
            if (read.kind === 'fresh') etag = read.etag
            const previous = store.getSnapshot().data
            store.publish({
                data: read.kind === 'fresh' ? mergeStructurally(previous, read.data as T) : previous,
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
