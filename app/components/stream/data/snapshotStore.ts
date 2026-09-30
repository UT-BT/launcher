export interface SnapshotStore<S extends object> {
    subscribe: (listener: () => void) => () => void
    getSnapshot: () => S
    publish: (patch: Partial<S>) => void
}

export function createSnapshotStore<S extends object>(initial: S): SnapshotStore<S> {
    const listeners = new Set<() => void>()
    let snapshot = initial

    return {
        subscribe(listener) {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
        },
        getSnapshot: () => snapshot,
        publish(patch) {
            const next = { ...snapshot, ...patch }
            if ((Object.keys(next) as (keyof S)[]).every(key => Object.is(next[key], snapshot[key]))) return
            snapshot = next
            for (const listener of listeners) listener()
        },
    }
}
