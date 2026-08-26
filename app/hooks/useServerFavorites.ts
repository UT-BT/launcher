import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import {
    addFavoriteServer,
    fetchUserFavoriteServers,
    removeFavoriteServer,
} from '@/app/utils/api'

/**
 * Single source of truth for server favorites in the launcher.
 *
 * Contract — every mutation goes through `toggle`, which writes optimistically
 * and serialises per server id, so a double-click resolves to one net state
 * instead of racing a POST against a DELETE. A failed write is undone by
 * reversing that one operation against the live order, never by restoring a
 * snapshot, so a concurrent toggle of another server survives.
 *
 * A failed read is surfaced as `favoritesLoadFailed` rather than swallowed —
 * "we could not load your favorites" and "you have none" must never look alike,
 * or the user unfavorites something that was fine.
 */

export interface ServerFavoritesSnapshot {
    favoriteServerIds: Set<string>
    loadFailed: boolean
}

export interface ServerFavoritesTransport {
    fetchFavorites: (accessToken: string, userId: string | number) => Promise<string[]>
    addFavorite: (accessToken: string, serverId: string) => Promise<void>
    removeFavorite: (accessToken: string, serverId: string) => Promise<void>
}

export interface ServerFavoritesStore {
    subscribe: (listener: () => void) => () => void
    getSnapshot: () => ServerFavoritesSnapshot
    load: (accessToken: string | undefined, userId: string | number | undefined) => Promise<void>
    toggle: (accessToken: string | undefined, serverId: string) => Promise<void>
}

const apiTransport: ServerFavoritesTransport = {
    fetchFavorites: fetchUserFavoriteServers,
    addFavorite: addFavoriteServer,
    removeFavorite: removeFavoriteServer,
}

export function createServerFavoritesStore(
    transport: ServerFavoritesTransport = apiTransport,
): ServerFavoritesStore {
    const listeners = new Set<() => void>()
    const inFlight = new Map<string, Promise<void>>()
    let order: string[] = []
    let loadFailed = false
    let snapshot: ServerFavoritesSnapshot = { favoriteServerIds: new Set(), loadFailed: false }
    let identity = 0

    const publish = () => {
        snapshot = { favoriteServerIds: new Set(order), loadFailed }
        for (const listener of listeners) listener()
    }

    const settle = (nextOrder: string[], failed: boolean) => {
        order = nextOrder.slice()
        loadFailed = failed
        publish()
    }

    const addAt = (serverId: string, index: number) => {
        if (order.includes(serverId)) return
        const next = order.slice()
        next.splice(Math.min(Math.max(index, 0), next.length), 0, serverId)
        order = next
        publish()
    }

    const removeId = (serverId: string) => {
        if (!order.includes(serverId)) return
        order = order.filter((id) => id !== serverId)
        publish()
    }

    const runToggle = (accessToken: string, serverId: string, startedFor: number): Promise<void> => {
        if (startedFor !== identity) return Promise.resolve()

        const wasFavorited = order.includes(serverId)
        const previousIndex = order.indexOf(serverId)

        if (wasFavorited) removeId(serverId)
        else addAt(serverId, order.length)

        const write = wasFavorited
            ? transport.removeFavorite(accessToken, serverId)
            : transport.addFavorite(accessToken, serverId)

        return Promise.resolve(write).catch((err) => {
            console.error('Server favorite toggle failed; rolling back', err)
            if (startedFor !== identity) return
            if (wasFavorited) addAt(serverId, previousIndex)
            else removeId(serverId)
        })
    }

    return {
        subscribe(listener) {
            listeners.add(listener)
            return () => { listeners.delete(listener) }
        },

        getSnapshot() {
            return snapshot
        },

        async load(accessToken, userId) {
            identity += 1
            const startedFor = identity

            if (!accessToken || !userId) {
                inFlight.clear()
                settle([], false)
                return
            }

            try {
                const serverIds = await transport.fetchFavorites(accessToken, userId)
                if (startedFor !== identity) return
                settle(serverIds, false)
            } catch (err) {
                console.error('Failed to load server favorites', err)
                if (startedFor !== identity) return
                settle([], true)
            }
        },

        toggle(accessToken, serverId) {
            if (!accessToken) return Promise.resolve()
            const startedFor = identity
            const settling = inFlight.get(serverId)
            const queued = settling
                ? settling.then(() => runToggle(accessToken, serverId, startedFor))
                : runToggle(accessToken, serverId, startedFor)
            inFlight.set(serverId, queued)
            void queued.then(() => {
                if (inFlight.get(serverId) === queued) inFlight.delete(serverId)
            })
            return queued
        },
    }
}

export interface UseServerFavoritesResult {
    favoriteServerIds: Set<string>
    favoritesLoadFailed: boolean
    toggle: (serverId: string) => Promise<void>
}

export function useServerFavorites(
    accessToken: string | undefined,
    userId: string | number | undefined,
): UseServerFavoritesResult {
    const storeRef = useRef<ServerFavoritesStore | null>(null)
    if (storeRef.current === null) storeRef.current = createServerFavoritesStore()
    const store = storeRef.current

    const { favoriteServerIds, loadFailed } = useSyncExternalStore(
        store.subscribe, store.getSnapshot, store.getSnapshot,
    )

    useEffect(() => {
        void store.load(accessToken, userId)
    }, [store, accessToken, userId])

    const toggle = useCallback(
        (serverId: string) => store.toggle(accessToken, serverId),
        [store, accessToken],
    )

    return { favoriteServerIds, favoritesLoadFailed: loadFailed, toggle }
}
