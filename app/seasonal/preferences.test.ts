import { describe, expect, it } from 'vitest'
import { parseSeasonalThemes, parseSeasonParam } from './preferences'
import { isSyncedKey } from '@/app/utils/userState'

describe('parseSeasonalThemes', () => {
    it('is on unless the viewer turned it off', () => {
        expect(parseSeasonalThemes(null)).toBe(true)
        expect(parseSeasonalThemes(undefined)).toBe(true)
        expect(parseSeasonalThemes('on')).toBe(true)
        expect(parseSeasonalThemes('garbage')).toBe(true)
        expect(parseSeasonalThemes('off')).toBe(false)
    })
})

describe('parseSeasonParam', () => {
    it('reads a season preview from the query string', () => {
        expect(parseSeasonParam('?season=christmas')).toBe('christmas')
        expect(parseSeasonParam('?view=maps&season=none')).toBe('none')
    })

    it('ignores missing or unknown values', () => {
        expect(parseSeasonParam('')).toBeNull()
        expect(parseSeasonParam('?season=summer')).toBeNull()
    })
})

describe('seasonal storage keys', () => {
    it('syncs the seasonal themes toggle with the account', () => {
        expect(isSyncedKey('utbt:seasonalThemes:v1')).toBe(true)
    })

    it('keeps the season cache and the preview override on this device', () => {
        expect(isSyncedKey('utbt:season:v1')).toBe(false)
        expect(isSyncedKey('utbt:seasonOverride:v1')).toBe(false)
    })
})
