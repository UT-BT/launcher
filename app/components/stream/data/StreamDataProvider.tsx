import { useEffect, useState, type ReactNode } from 'react'
import type { StreamSceneOptions } from '../streamSceneOptions'
import { createSceneCadenceStore } from './sceneCadence'
import { createStreamHotStateStore } from './streamHotStateStore'
import { StreamDataContext, type StreamData } from './streamDataContext'

interface StreamDataProviderProps {
    eventSlug: string
    streamerId: string
    options: StreamSceneOptions
    children: ReactNode
}

function createStreamData(eventSlug: string, streamerId: string, options: StreamSceneOptions): StreamData {
    const cadence = createSceneCadenceStore({ host: window, preview: options.preview })
    const hotState = createStreamHotStateStore({ eventSlug, streamerId, intervalMs: () => cadence.getCadence().hotStateMs })
    return { eventSlug, streamerId, options, cadence, hotState }
}

export function StreamDataProvider({ eventSlug, streamerId, options, children }: StreamDataProviderProps) {
    const [data] = useState(() => createStreamData(eventSlug, streamerId, options))

    useEffect(() => {
        data.cadence.start()
        data.hotState.start()
        const stopRefetching = data.cadence.onActivate(() => void data.hotState.pollNow())
        return () => {
            stopRefetching()
            data.hotState.stop()
            data.cadence.stop()
        }
    }, [data])

    return <StreamDataContext.Provider value={data}>{children}</StreamDataContext.Provider>
}
