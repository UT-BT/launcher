import { useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { StreamDataContext, type StreamData } from './streamDataContext'
import type { SceneCadence } from './sceneCadence'
import { sceneMatchOf, type SceneMatch } from './sceneMatch'
import type { SceneReadSnapshot } from './sceneReadStore'
import type { StreamHotStateSnapshot } from './streamHotStateStore'

const IDLE_READ: SceneReadSnapshot<never> = { data: null, loading: false, error: null, reconnecting: false }
const NO_READ = {
    subscribe: () => () => undefined,
    getSnapshot: () => IDLE_READ,
    start: () => undefined,
    stop: () => undefined,
    pollNow: () => Promise.resolve(),
}

export function useStreamData(): StreamData {
    const data = useContext(StreamDataContext)
    if (!data) throw new Error('Stream scenes must render inside StreamDataProvider')
    return data
}

export function useStreamHotState(): StreamHotStateSnapshot {
    const { hotState } = useStreamData()
    return useSyncExternalStore(hotState.subscribe, hotState.getSnapshot, hotState.getSnapshot)
}

export function useSceneMatch(): SceneMatch {
    const { state, loading } = useStreamHotState()
    return useMemo(() => sceneMatchOf({ state, loading }), [state, loading])
}

export function useSceneCadence(): SceneCadence {
    const { cadence } = useStreamData()
    return useSyncExternalStore(cadence.subscribe, cadence.getCadence, cadence.getCadence)
}

export function useSceneRead<T extends object>(path: string | null): SceneReadSnapshot<T> {
    const { reads } = useStreamData()
    const store = useMemo(() => (path === null ? NO_READ : reads.storeFor<T>(path)), [path, reads])

    useEffect(() => (path === null ? undefined : reads.retain(path, store)), [path, store, reads])

    return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
}

export function useSceneNow(stepMs = 1_000): number {
    const { clockOffsetMs } = useStreamHotState()
    const [now, setNow] = useState(() => Date.now())

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), stepMs)
        return () => clearInterval(timer)
    }, [stepMs])

    return now + clockOffsetMs
}
