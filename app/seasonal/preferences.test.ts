import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseSeasonParam, readEntryPreview, writeSeasonCache } from './preferences'
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

function withStorage(session: Record<string, string>, local: Record<string, string>) {
    const storages = { sessionStorage: fakeStorage(session), localStorage: fakeStorage(local) }
    vi.stubGlobal('window', storages)
    return storages
}

afterEach(() => {
    vi.unstubAllGlobals()
})

describe('parseSeasonParam', () => {
    it('reads a season preview from the query string', () => {
        expect(parseSeasonParam('?season=christmas')).toBe('christmas')
        expect(parseSeasonParam('?view=maps&season=none')).toBe('none')
    })

    it('ignores missing or unknown values', () => {
        expect(parseSeasonParam('')).toBeNull()
        expect(parseSeasonParam('?season=aurora')).toBeNull()
    })
})

describe('readEntryPreview', () => {
    it('takes the session preview first', () => {
        withStorage({ 'utbt:seasonOverride:v1': 'easter' }, { 'utbt:seasonPin:v1': 'none' })
        expect(readEntryPreview()).toBe('easter')
    })

    it('falls back to the pinned preview on this device', () => {
        withStorage({}, { 'utbt:seasonPin:v1': 'none' })
        expect(readEntryPreview()).toBe('none')
        withStorage({ 'utbt:seasonOverride:v1': 'aurora' }, { 'utbt:seasonPin:v1': 'halloween' })
        expect(readEntryPreview()).toBe('halloween')
    })

    it('is nothing without a valid preview', () => {
        withStorage({}, {})
        expect(readEntryPreview()).toBeNull()
        withStorage({}, { 'utbt:seasonPin:v1': '"none"' })
        expect(readEntryPreview()).toBeNull()
    })

    it('ignores the retired seasonal themes toggle', () => {
        withStorage({}, { 'utbt:seasonalThemes:v1': '"off"' })
        expect(readEntryPreview()).toBeNull()
    })
})

describe('writeSeasonCache', () => {
    it('stores the entry and its change time under the v2 key only', () => {
        const { localStorage } = withStorage({}, {})
        writeSeasonCache({ id: 'christmas', until: 1_798_675_200_000 })
        expect(JSON.parse(localStorage.getItem('utbt:season:v2')!)).toEqual({ id: 'christmas', until: 1_798_675_200_000 })
        writeSeasonCache({ id: null, until: 1_799_000_000_000 })
        expect(JSON.parse(localStorage.getItem('utbt:season:v2')!)).toEqual({ id: null, until: 1_799_000_000_000 })
        expect(localStorage.getItem('utbt:season:v1')).toBeNull()
    })
})

describe('seasonal storage keys', () => {
    it('no longer syncs the retired seasonal themes toggle', () => {
        expect(isSyncedKey('utbt:seasonalThemes:v1')).toBe(false)
    })

    it('keeps the season cache, the preview override and the pin on this device', () => {
        expect(isSyncedKey('utbt:season:v2')).toBe(false)
        expect(isSyncedKey('utbt:seasonOverride:v1')).toBe(false)
        expect(isSyncedKey('utbt:seasonPin:v1')).toBe(false)
    })
})
