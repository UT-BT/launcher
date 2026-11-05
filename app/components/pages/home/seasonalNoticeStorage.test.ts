import { describe, expect, it, vi } from 'vitest'
import {
    SEASONAL_NOTICE_STORAGE_KEY,
    dismissSeasonalNotice,
    isSeasonalNoticeDismissed,
    seasonalNoticeVisible,
    subscribeSeasonalNotice,
} from './seasonalNoticeStorage'
import { THEMES } from '@/app/theme/themes'

function memoryStorage(initial: Record<string, string> = {}) {
    const values = new Map(Object.entries(initial))
    return {
        values,
        get: () => ({
            getItem: (key: string) => values.get(key) ?? null,
            setItem: (key: string, value: string) => { values.set(key, value) },
        }),
    }
}

const blocked = () => ({
    getItem: () => { throw new Error('blocked') },
    setItem: () => { throw new Error('quota') },
})

describe('seasonalNoticeVisible', () => {
    const marked = [{ id: 'classic' }, { id: 'seasonal', new: true }]

    it('shows on another theme while Seasonal carries the new marker and nothing was dismissed', () => {
        expect(seasonalNoticeVisible({ themes: marked, themeId: 'classic', dismissed: false })).toBe(true)
        expect(seasonalNoticeVisible({ themes: THEMES, themeId: 'red', dismissed: false })).toBe(true)
    })

    it('never shows while Seasonal is the saved theme', () => {
        expect(seasonalNoticeVisible({ themes: marked, themeId: 'seasonal', dismissed: false })).toBe(false)
    })

    it('stays hidden once dismissed', () => {
        expect(seasonalNoticeVisible({ themes: marked, themeId: 'classic', dismissed: true })).toBe(false)
    })

    it('retires with the new marker', () => {
        expect(seasonalNoticeVisible({ themes: [{ id: 'classic' }, { id: 'seasonal' }], themeId: 'classic', dismissed: false })).toBe(false)
        expect(seasonalNoticeVisible({ themes: [{ id: 'classic' }, { id: 'red', new: true }], themeId: 'classic', dismissed: false })).toBe(false)
    })
})

describe('seasonal notice storage', () => {
    it('uses the versioned device-local key', () => {
        expect(SEASONAL_NOTICE_STORAGE_KEY).toBe('utbt:seasonalNotice:v1')
    })

    it('is not dismissed while nothing is stored', () => {
        expect(isSeasonalNoticeDismissed(memoryStorage().get)).toBe(false)
    })

    it('stores the ISO time of the dismissal as JSON', () => {
        const storage = memoryStorage()
        dismissSeasonalNotice(new Date('2026-11-05T10:00:00Z'), storage.get)
        expect(storage.values.get('utbt:seasonalNotice:v1')).toBe('"2026-11-05T10:00:00.000Z"')
        expect(isSeasonalNoticeDismissed(storage.get)).toBe(true)
    })

    it('ignores a wrongly shaped value', () => {
        expect(isSeasonalNoticeDismissed(memoryStorage({ 'utbt:seasonalNotice:v1': 'yes' }).get)).toBe(false)
        expect(isSeasonalNoticeDismissed(memoryStorage({ 'utbt:seasonalNotice:v1': '42' }).get)).toBe(false)
    })

    it('treats blocked storage as not dismissed and never throws', () => {
        expect(isSeasonalNoticeDismissed(blocked)).toBe(false)
        expect(() => dismissSeasonalNotice(new Date(), blocked)).not.toThrow()
    })

    it('tells subscribers about a dismissal until they unsubscribe', () => {
        const listener = vi.fn()
        const unsubscribe = subscribeSeasonalNotice(listener)
        dismissSeasonalNotice(new Date(), memoryStorage().get)
        expect(listener).toHaveBeenCalledTimes(1)
        unsubscribe()
        dismissSeasonalNotice(new Date(), memoryStorage().get)
        expect(listener).toHaveBeenCalledTimes(1)
    })
})
