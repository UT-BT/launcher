import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ fetchUserState: vi.fn(), mergeUserState: vi.fn() }))

vi.mock('@/app/utils/api', () => api)

function fakeStorage() {
    const values = new Map<string, string>()
    return {
        get length() { return values.size },
        key: (index: number) => [...values.keys()][index] ?? null,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value) },
        removeItem: (key: string) => { values.delete(key) },
    }
}

async function freshStore() {
    vi.stubGlobal('window', { localStorage: fakeStorage(), addEventListener: () => undefined })
    vi.stubGlobal('document', { visibilityState: 'visible' })
    vi.resetModules()
    return import('./userState')
}

beforeEach(() => {
    api.fetchUserState.mockReset()
    api.mergeUserState.mockReset().mockResolvedValue(undefined)
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('userStateSettled', () => {
    it('is already settled when nobody has signed in', async () => {
        const store = await freshStore()
        await expect(store.userStateSettled()).resolves.toBeUndefined()
    })

    it('waits for the account copy, so a synced value is readable once it settles', async () => {
        let release: (doc: { state: Record<string, unknown> }) => void = () => undefined
        api.fetchUserState.mockReturnValue(new Promise(resolve => { release = resolve }))
        const store = await freshStore()

        void store.initUserStateSync('token', '42')
        let settled = false
        void store.userStateSettled().then(() => { settled = true })
        await Promise.resolve()
        expect(settled).toBe(false)
        expect(store.getSynced('utbt:celebrationsSeen:v1', [])).toEqual([])

        release({ state: { 'utbt:celebrationsSeen:v1': ['2v2-cup-2026'] } })
        await store.userStateSettled()
        expect(settled).toBe(true)
        expect(store.getSynced('utbt:celebrationsSeen:v1', [])).toEqual(['2v2-cup-2026'])
    })

    it('settles even when the account copy cannot be fetched', async () => {
        api.fetchUserState.mockRejectedValue(new Error('offline'))
        const store = await freshStore()

        void store.initUserStateSync('token', '42')
        await expect(store.userStateSettled()).resolves.toBeUndefined()
    })
})
