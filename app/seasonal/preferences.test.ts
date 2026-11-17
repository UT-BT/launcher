import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    captureHemisphereOverride,
    loadHemisphereSetting,
    loadSeasonalEffects,
    parseHemisphereParam,
    parseHemisphereSetting,
    parseSeasonalEffects,
    parseSeasonParam,
    readEntryPreview,
    readHemisphereOverride,
    saveHemisphereSetting,
    saveSeasonalEffects,
    subscribeHemisphereOverride,
    subscribeHemisphereSetting,
    subscribeSeasonalEffects,
    writeHemisphereOverride,
    writeSeasonCache,
} from './preferences'
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

    it('syncs the hemisphere setting with the account and keeps its preview on this device', () => {
        expect(isSyncedKey('utbt:hemisphere:v1')).toBe(true)
        expect(isSyncedKey('utbt:hemisphereOverride:v1')).toBe(false)
    })

    it('syncs the seasonal effects switch with the account', () => {
        expect(isSyncedKey('utbt:seasonalEffects:v1')).toBe(true)
    })
})

describe('parseHemisphereSetting', () => {
    it('keeps north, south and auto', () => {
        expect(parseHemisphereSetting('north')).toBe('north')
        expect(parseHemisphereSetting('south')).toBe('south')
        expect(parseHemisphereSetting('auto')).toBe('auto')
    })

    it.each([null, undefined, '', 'North', 'equator', 1, { id: 'south' }])('defaults %j to auto', stored => {
        expect(parseHemisphereSetting(stored)).toBe('auto')
    })
})

describe('the hemisphere setting', () => {
    it('defaults to auto with nothing stored', () => {
        withStorage({}, {})
        expect(loadHemisphereSetting()).toBe('auto')
    })

    it('saves a JSON value under its synced key and notifies subscribers', () => {
        const { localStorage } = withStorage({}, {})
        const listener = vi.fn()
        const unsubscribe = subscribeHemisphereSetting(listener)
        saveHemisphereSetting('south')
        expect(localStorage.getItem('utbt:hemisphere:v1')).toBe('"south"')
        expect(loadHemisphereSetting()).toBe('south')
        expect(listener).toHaveBeenCalledTimes(1)
        saveHemisphereSetting('auto')
        expect(localStorage.getItem('utbt:hemisphere:v1')).toBe('"auto"')
        expect(loadHemisphereSetting()).toBe('auto')
        unsubscribe()
        saveHemisphereSetting('north')
        expect(listener).toHaveBeenCalledTimes(2)
    })
})

describe('parseHemisphereParam', () => {
    it('reads a hemisphere preview from the query string', () => {
        expect(parseHemisphereParam('?hemisphere=south')).toBe('south')
        expect(parseHemisphereParam('?season=christmas&hemisphere=north')).toBe('north')
    })

    it.each(['', '?hemisphere=auto', '?hemisphere=South', '?hemisphere='])('ignores %j', search => {
        expect(parseHemisphereParam(search)).toBeNull()
    })
})

describe('the hemisphere preview', () => {
    it('is captured into the session from the query string', () => {
        const { sessionStorage } = withStorage({}, {})
        captureHemisphereOverride('?hemisphere=south')
        expect(sessionStorage.getItem('utbt:hemisphereOverride:v1')).toBe('south')
        expect(readHemisphereOverride()).toBe('south')
    })

    it('keeps an earlier preview when the query string has none or an invalid one', () => {
        withStorage({ 'utbt:hemisphereOverride:v1': 'north' }, {})
        captureHemisphereOverride('?view=maps')
        captureHemisphereOverride('?hemisphere=auto')
        expect(readHemisphereOverride()).toBe('north')
    })

    it('ignores an invalid stored value', () => {
        withStorage({ 'utbt:hemisphereOverride:v1': '"south"' }, {})
        expect(readHemisphereOverride()).toBeNull()
    })

    it('notifies subscribers when written or cleared', () => {
        const { sessionStorage } = withStorage({}, {})
        const listener = vi.fn()
        const unsubscribe = subscribeHemisphereOverride(listener)
        writeHemisphereOverride('north')
        expect(sessionStorage.getItem('utbt:hemisphereOverride:v1')).toBe('north')
        writeHemisphereOverride(null)
        expect(readHemisphereOverride()).toBeNull()
        expect(listener).toHaveBeenCalledTimes(2)
        unsubscribe()
    })
})

describe('parseSeasonalEffects', () => {
    it('keeps an explicit on or off', () => {
        expect(parseSeasonalEffects(true)).toBe(true)
        expect(parseSeasonalEffects(false)).toBe(false)
    })

    it.each([null, undefined, '', 'false', 0, { on: false }])('defaults %j to on', stored => {
        expect(parseSeasonalEffects(stored)).toBe(true)
    })
})

describe('the seasonal effects switch', () => {
    it('defaults to on with nothing stored', () => {
        withStorage({}, {})
        expect(loadSeasonalEffects()).toBe(true)
    })

    it('reads a stored off', () => {
        withStorage({}, { 'utbt:seasonalEffects:v1': 'false' })
        expect(loadSeasonalEffects()).toBe(false)
    })

    it('saves a JSON value under its synced key and notifies subscribers', () => {
        const { localStorage } = withStorage({}, {})
        const listener = vi.fn()
        const unsubscribe = subscribeSeasonalEffects(listener)
        saveSeasonalEffects(false)
        expect(localStorage.getItem('utbt:seasonalEffects:v1')).toBe('false')
        expect(loadSeasonalEffects()).toBe(false)
        expect(listener).toHaveBeenCalledTimes(1)
        saveSeasonalEffects(true)
        expect(localStorage.getItem('utbt:seasonalEffects:v1')).toBe('true')
        expect(loadSeasonalEffects()).toBe(true)
        unsubscribe()
        saveSeasonalEffects(false)
        expect(listener).toHaveBeenCalledTimes(2)
    })
})
