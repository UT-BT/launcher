import type { SceneCadenceStore } from './sceneCadence'
import { createSceneReadStore, type SceneReadStore } from './sceneReadStore'

export interface SceneReadRegistry {
    storeFor: <T extends object>(path: string) => SceneReadStore<T>
    retain: (path: string, store: SceneReadStore<object>) => () => void
}

interface SharedRead {
    store: SceneReadStore<object>
    users: number
    stopRefetching: (() => void) | null
}

export function createSceneReadRegistry(cadence: SceneCadenceStore): SceneReadRegistry {
    const reads = new Map<string, SharedRead>()

    const readFor = (path: string): SharedRead => {
        const existing = reads.get(path)
        if (existing) return existing
        const created: SharedRead = {
            store: createSceneReadStore<object>({ path, intervalMs: () => cadence.getCadence().compositeMs }),
            users: 0,
            stopRefetching: null,
        }
        reads.set(path, created)
        return created
    }

    return {
        storeFor: <T extends object>(path: string) => readFor(path).store as SceneReadStore<T>,
        retain(path, store) {
            const current = reads.get(path)
            const read: SharedRead = current?.store === store ? current : { store, users: 0, stopRefetching: null }
            if (!current) reads.set(path, read)
            read.users += 1
            if (read.users === 1) {
                read.store.start()
                read.stopRefetching = cadence.onActivate(() => void read.store.pollNow())
            }
            return () => {
                read.users -= 1
                if (read.users > 0) return
                read.stopRefetching?.()
                read.stopRefetching = null
                read.store.stop()
                if (reads.get(path) === read) reads.delete(path)
            }
        },
    }
}
