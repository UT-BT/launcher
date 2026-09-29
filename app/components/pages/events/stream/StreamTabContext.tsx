import { createContext, useContext, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { createStreamDeskStore, type StreamDesk } from './streamDesk'

export interface StreamTabIdentity {
    eventSlug: string
    streamerId: string
    isManager: boolean
    accessToken: string
}

export interface StreamTabContextValue extends StreamTabIdentity {
    desk: StreamDesk | null
    deskLoading: boolean
    deskError: unknown
    clockOffsetMs: number
    refresh: () => Promise<void>
}

const StreamTabContext = createContext<StreamTabContextValue | null>(null)

function useStreamDesk({ eventSlug, streamerId, accessToken }: StreamTabIdentity) {
    const tokenRef = useRef(accessToken)
    tokenRef.current = accessToken

    const store = useMemo(
        () => createStreamDeskStore({ slug: eventSlug, streamerId, accessToken: () => tokenRef.current }),
        [eventSlug, streamerId],
    )

    useEffect(() => {
        store.start()
        return () => store.stop()
    }, [store])

    const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
    return { snapshot, refresh: store.refresh }
}

export function StreamTabProvider({ identity, children }: { identity: StreamTabIdentity; children: ReactNode }) {
    const { snapshot, refresh } = useStreamDesk(identity)

    const value = useMemo<StreamTabContextValue>(() => ({
        ...identity,
        desk: snapshot.desk,
        deskLoading: snapshot.loading,
        deskError: snapshot.error,
        clockOffsetMs: snapshot.clockOffsetMs,
        refresh,
    }), [identity, snapshot, refresh])

    return <StreamTabContext.Provider value={value}>{children}</StreamTabContext.Provider>
}

export function useStreamTab(): StreamTabContextValue {
    const value = useContext(StreamTabContext)
    if (!value) throw new Error('useStreamTab must be used inside the Stream tab')
    return value
}
