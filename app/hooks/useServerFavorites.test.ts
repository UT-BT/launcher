import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    createServerFavoritesStore,
    type ServerFavoritesTransport,
} from './useServerFavorites'

const TOKEN = 'token'
const USER = '228152236587483136'
const A = 'aaaaaaaa-0000-4000-8000-000000000001'
const B = 'bbbbbbbb-0000-4000-8000-000000000002'

function deferred<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
}

function fakeTransport(overrides: Partial<ServerFavoritesTransport> = {}) {
    return {
        fetchFavorites: vi.fn().mockResolvedValue([]),
        addFavorite: vi.fn().mockResolvedValue(undefined),
        removeFavorite: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    } as ServerFavoritesTransport & { [K in keyof ServerFavoritesTransport]: ReturnType<typeof vi.fn> }
}

function ids(store: ReturnType<typeof createServerFavoritesStore>) {
    return [...store.getSnapshot().favoriteServerIds]
}

beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('loading favorites', () => {
    it('publishes what the API returned', async () => {
        const store = createServerFavoritesStore(fakeTransport({
            fetchFavorites: vi.fn().mockResolvedValue([A, B]),
        }))

        await store.load(TOKEN, USER)

        expect(ids(store)).toEqual([A, B])
        expect(store.getSnapshot().loadFailed).toBe(false)
    })

    it('reports a failed read instead of looking like an empty list', async () => {
        const store = createServerFavoritesStore(fakeTransport({
            fetchFavorites: vi.fn().mockRejectedValue(new Error('500')),
        }))

        await store.load(TOKEN, USER)

        expect(ids(store)).toEqual([])
        expect(store.getSnapshot().loadFailed).toBe(true)
    })

    it('clears favorites on sign-out without claiming the read failed', async () => {
        const store = createServerFavoritesStore(fakeTransport({
            fetchFavorites: vi.fn().mockResolvedValue([A, B]),
        }))
        await store.load(TOKEN, USER)

        await store.load(undefined, undefined)

        expect(ids(store)).toEqual([])
        expect(store.getSnapshot().loadFailed).toBe(false)
    })

    it('clears a stale load-failed flag once the user signs out', async () => {
        const store = createServerFavoritesStore(fakeTransport({
            fetchFavorites: vi.fn().mockRejectedValue(new Error('500')),
        }))
        await store.load(TOKEN, USER)

        await store.load(undefined, undefined)

        expect(store.getSnapshot().loadFailed).toBe(false)
    })

    it('ignores a slow read that resolves after the account changed', async () => {
        const slow = deferred<string[]>()
        const transport = fakeTransport({
            fetchFavorites: vi.fn()
                .mockReturnValueOnce(slow.promise)
                .mockResolvedValue([B]),
        })
        const store = createServerFavoritesStore(transport)

        const first = store.load(TOKEN, 'other-account')
        const second = store.load(TOKEN, USER)
        slow.resolve([A])
        await Promise.all([first, second])

        expect(ids(store)).toEqual([B])
    })

    it('notifies subscribers on every published change', async () => {
        const store = createServerFavoritesStore(fakeTransport({
            fetchFavorites: vi.fn().mockResolvedValue([A]),
        }))
        const listener = vi.fn()
        const unsubscribe = store.subscribe(listener)

        await store.load(TOKEN, USER)
        expect(listener).toHaveBeenCalled()

        unsubscribe()
        listener.mockClear()
        await store.load(TOKEN, USER)
        expect(listener).not.toHaveBeenCalled()
    })
})

describe('toggling a favorite', () => {
    it('adds optimistically before the write lands', async () => {
        const pending = deferred<void>()
        const store = createServerFavoritesStore(fakeTransport({
            addFavorite: vi.fn().mockReturnValue(pending.promise),
        }))
        await store.load(TOKEN, USER)

        const toggled = store.toggle(TOKEN, A)
        expect(ids(store)).toEqual([A])

        pending.resolve()
        await toggled
        expect(ids(store)).toEqual([A])
    })

    it('removes optimistically before the write lands', async () => {
        const pending = deferred<void>()
        const store = createServerFavoritesStore(fakeTransport({
            fetchFavorites: vi.fn().mockResolvedValue([A, B]),
            removeFavorite: vi.fn().mockReturnValue(pending.promise),
        }))
        await store.load(TOKEN, USER)

        const toggled = store.toggle(TOKEN, A)
        expect(ids(store)).toEqual([B])

        pending.resolve()
        await toggled
        expect(ids(store)).toEqual([B])
    })

    it('does nothing at all without an access token', async () => {
        const transport = fakeTransport()
        const store = createServerFavoritesStore(transport)

        await store.toggle(undefined, A)

        expect(transport.addFavorite).not.toHaveBeenCalled()
        expect(ids(store)).toEqual([])
    })

    it('undoes a failed add', async () => {
        const store = createServerFavoritesStore(fakeTransport({
            addFavorite: vi.fn().mockRejectedValue(new Error('401')),
        }))
        await store.load(TOKEN, USER)

        await store.toggle(TOKEN, A)

        expect(ids(store)).toEqual([])
    })

    it('restores a failed remove in its original position', async () => {
        const store = createServerFavoritesStore(fakeTransport({
            fetchFavorites: vi.fn().mockResolvedValue([A, B]),
            removeFavorite: vi.fn().mockRejectedValue(new Error('500')),
        }))
        await store.load(TOKEN, USER)

        await store.toggle(TOKEN, A)

        expect(ids(store)).toEqual([A, B])
    })

    it('keeps a concurrent toggle of another server when a rollback fires', async () => {
        const failingAdd = deferred<void>()
        const store = createServerFavoritesStore(fakeTransport({
            addFavorite: vi.fn((_token: string, serverId: string) =>
                serverId === A ? failingAdd.promise : Promise.resolve()),
        }))
        await store.load(TOKEN, USER)

        const doomed = store.toggle(TOKEN, A)
        const survivor = store.toggle(TOKEN, B)
        await survivor
        failingAdd.reject(new Error('500'))
        await doomed

        expect(ids(store)).toEqual([B])
    })

    it('does not resurrect a favorite the user removed while an unrelated write was failing', async () => {
        const failingAdd = deferred<void>()
        const store = createServerFavoritesStore(fakeTransport({
            fetchFavorites: vi.fn().mockResolvedValue([B]),
            addFavorite: vi.fn().mockReturnValue(failingAdd.promise),
        }))
        await store.load(TOKEN, USER)

        const doomed = store.toggle(TOKEN, A)
        await store.toggle(TOKEN, B)
        failingAdd.reject(new Error('500'))
        await doomed

        expect(ids(store)).toEqual([])
    })
})

describe('interleaved toggles of one server', () => {
    it('serialises a double click into an add then a remove', async () => {
        const transport = fakeTransport()
        const store = createServerFavoritesStore(transport)
        await store.load(TOKEN, USER)

        await Promise.all([store.toggle(TOKEN, A), store.toggle(TOKEN, A)])

        expect(transport.addFavorite).toHaveBeenCalledTimes(1)
        expect(transport.removeFavorite).toHaveBeenCalledTimes(1)
        expect(ids(store)).toEqual([])
    })

    it('never lets the delete overtake the post', async () => {
        const calls: string[] = []
        const slowAdd = deferred<void>()
        const transport = fakeTransport({
            addFavorite: vi.fn(() => { calls.push('add'); return slowAdd.promise }),
            removeFavorite: vi.fn(() => { calls.push('remove'); return Promise.resolve() }),
        })
        const store = createServerFavoritesStore(transport)
        await store.load(TOKEN, USER)

        const first = store.toggle(TOKEN, A)
        const second = store.toggle(TOKEN, A)
        expect(calls).toEqual(['add'])

        slowAdd.resolve()
        await Promise.all([first, second])

        expect(calls).toEqual(['add', 'remove'])
        expect(ids(store)).toEqual([])
    })

    it('settles a triple click on the favorited state', async () => {
        const transport = fakeTransport()
        const store = createServerFavoritesStore(transport)
        await store.load(TOKEN, USER)

        await Promise.all([
            store.toggle(TOKEN, A),
            store.toggle(TOKEN, A),
            store.toggle(TOKEN, A),
        ])

        expect(ids(store)).toEqual([A])
        expect(transport.addFavorite).toHaveBeenCalledTimes(2)
        expect(transport.removeFavorite).toHaveBeenCalledTimes(1)
    })

    it('lets a failed first click leave the second click a clean state', async () => {
        const transport = fakeTransport({
            addFavorite: vi.fn()
                .mockRejectedValueOnce(new Error('500'))
                .mockResolvedValue(undefined),
        })
        const store = createServerFavoritesStore(transport)
        await store.load(TOKEN, USER)

        await store.toggle(TOKEN, A)
        expect(ids(store)).toEqual([])

        await store.toggle(TOKEN, A)
        expect(ids(store)).toEqual([A])
        expect(transport.removeFavorite).not.toHaveBeenCalled()
    })

    it('drops a queued toggle that was issued before the user signed out', async () => {
        const slowAdd = deferred<void>()
        const transport = fakeTransport({
            addFavorite: vi.fn().mockReturnValueOnce(slowAdd.promise).mockResolvedValue(undefined),
        })
        const store = createServerFavoritesStore(transport)
        await store.load(TOKEN, USER)

        const first = store.toggle(TOKEN, A)
        const queued = store.toggle(TOKEN, A)
        await store.load(undefined, undefined)
        slowAdd.resolve()
        await Promise.all([first, queued])

        expect(ids(store)).toEqual([])
        expect(transport.removeFavorite).not.toHaveBeenCalled()
    })
})
