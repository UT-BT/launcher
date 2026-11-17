import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isSyncedKey } from '@/app/utils/userState'

function fakeStorage(entries: Record<string, string> = {}) {
    const values = new Map(Object.entries(entries))
    return {
        values,
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => { values.set(key, value) },
        removeItem: (key: string) => { values.delete(key) },
    }
}

async function freshModule(local: Record<string, string> = {}) {
    const localStorage = fakeStorage(local)
    vi.stubGlobal('window', { localStorage })
    vi.resetModules()
    return { localStorage, seen: await import('./celebrationSeen') }
}

beforeEach(() => {
    vi.unstubAllGlobals()
})

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('celebration seen state', () => {
    it('follows the account between devices', async () => {
        const { seen } = await freshModule()
        expect(isSyncedKey(seen.CELEBRATIONS_SEEN_KEY)).toBe(true)
    })

    it('has seen nothing on a fresh device', async () => {
        const { seen } = await freshModule()
        expect(seen.hasSeenCelebration('2v2-cup-2026')).toBe(false)
    })

    it('remembers a celebration once it has been shown', async () => {
        const { seen, localStorage } = await freshModule()
        seen.markCelebrationSeen('2v2-cup-2026')
        expect(seen.hasSeenCelebration('2v2-cup-2026')).toBe(true)
        expect(JSON.parse(localStorage.values.get(seen.CELEBRATIONS_SEEN_KEY)!)).toEqual(['2v2-cup-2026'])
    })

    it('keeps earlier celebrations when a new one is shown', async () => {
        const { seen, localStorage } = await freshModule({ 'utbt:celebrationsSeen:v1': JSON.stringify(['keyrun-2026']) })
        seen.markCelebrationSeen('2v2-cup-2026')
        seen.markCelebrationSeen('2v2-cup-2026')
        expect(JSON.parse(localStorage.values.get(seen.CELEBRATIONS_SEEN_KEY)!)).toEqual(['keyrun-2026', '2v2-cup-2026'])
        expect(seen.hasSeenCelebration('keyrun-2026')).toBe(true)
    })

    it('reads a damaged value as nothing seen', async () => {
        const { seen } = await freshModule({ 'utbt:celebrationsSeen:v1': JSON.stringify({ slug: 'x' }) })
        expect(seen.hasSeenCelebration('x')).toBe(false)
    })

    it('never celebrates for an automated browser', async () => {
        const { seen } = await freshModule()
        vi.stubGlobal('navigator', { webdriver: true })
        expect(seen.isAutomatedBrowser()).toBe(true)
        vi.stubGlobal('navigator', { webdriver: false })
        expect(seen.isAutomatedBrowser()).toBe(false)
    })
})
