import { describe, expect, it, vi } from 'vitest'
import {
    DEFAULT_SOUND_PREFERENCE,
    loadPickBanSoundPreference,
    parsePickBanSoundPreference,
    savePickBanSoundPreference,
    subscribePickBanSoundPreference,
} from './pickBanSoundPreference'
import { isSyncedKey } from '@/app/utils/userState'

describe('parsePickBanSoundPreference', () => {
    it('starts off at 40% when nothing is stored', () => {
        expect(parsePickBanSoundPreference(null)).toEqual({ enabled: false, volume: 0.4 })
        expect(parsePickBanSoundPreference(undefined)).toEqual({ enabled: false, volume: 0.4 })
        expect(DEFAULT_SOUND_PREFERENCE).toEqual({ enabled: false, volume: 0.4 })
    })

    it('reads a stored preference', () => {
        expect(parsePickBanSoundPreference({ enabled: true, volume: 0.25 })).toEqual({ enabled: true, volume: 0.25 })
        expect(parsePickBanSoundPreference({ enabled: false, volume: 0 })).toEqual({ enabled: false, volume: 0 })
    })

    it('reads an older stored pack and volume as off at that volume', () => {
        expect(parsePickBanSoundPreference({ pack: 'clean', volume: 0.25 })).toEqual({ enabled: false, volume: 0.25 })
        expect(parsePickBanSoundPreference({ pack: 'cinematic', volume: 0.9 })).toEqual({ enabled: false, volume: 0.9 })
        expect(parsePickBanSoundPreference({ pack: 'clean' })).toEqual(DEFAULT_SOUND_PREFERENCE)
        expect(parsePickBanSoundPreference({ volume: 0.7 })).toEqual({ enabled: false, volume: 0.7 })
    })

    it('keeps sound off unless enabled is exactly true', () => {
        expect(parsePickBanSoundPreference({ enabled: 'true', volume: 0.5 })).toEqual({ enabled: false, volume: 0.5 })
        expect(parsePickBanSoundPreference({ enabled: 1, volume: 0.5 })).toEqual({ enabled: false, volume: 0.5 })
    })

    it('falls back to 40% when the stored volume is missing or not a number', () => {
        expect(parsePickBanSoundPreference({ enabled: true })).toEqual({ enabled: true, volume: 0.4 })
        expect(parsePickBanSoundPreference({ enabled: true, volume: 'loud' })).toEqual({ enabled: true, volume: 0.4 })
        expect(parsePickBanSoundPreference({ enabled: true, volume: null })).toEqual({ enabled: true, volume: 0.4 })
        expect(parsePickBanSoundPreference({ enabled: true, volume: Number.NaN })).toEqual({ enabled: true, volume: 0.4 })
    })

    it('clamps a stored volume into 0 to 1', () => {
        expect(parsePickBanSoundPreference({ enabled: true, volume: 4 })).toEqual({ enabled: true, volume: 1 })
        expect(parsePickBanSoundPreference({ enabled: true, volume: -1 })).toEqual({ enabled: true, volume: 0 })
    })

    it('falls back to the defaults for a value that is not a stored preference', () => {
        expect(parsePickBanSoundPreference('garbage')).toEqual(DEFAULT_SOUND_PREFERENCE)
        expect(parsePickBanSoundPreference('clean')).toEqual(DEFAULT_SOUND_PREFERENCE)
        expect(parsePickBanSoundPreference(0.4)).toEqual(DEFAULT_SOUND_PREFERENCE)
        expect(parsePickBanSoundPreference(true)).toEqual(DEFAULT_SOUND_PREFERENCE)
        expect(parsePickBanSoundPreference([])).toEqual(DEFAULT_SOUND_PREFERENCE)
    })
})

describe('the synced sound preference', () => {
    it('follows the signed-in account', () => {
        expect(isSyncedKey('utbt:pickBanSound:v1')).toBe(true)
    })

    it('reads back what was saved and tells subscribers', () => {
        const listener = vi.fn()
        const unsubscribe = subscribePickBanSoundPreference(listener)
        savePickBanSoundPreference({ enabled: true, volume: 0.65 })
        expect(listener).toHaveBeenCalledTimes(1)
        expect(loadPickBanSoundPreference()).toEqual({ enabled: true, volume: 0.65 })
        unsubscribe()
        savePickBanSoundPreference({ enabled: false, volume: 0.65 })
        expect(listener).toHaveBeenCalledTimes(1)
        expect(loadPickBanSoundPreference()).toEqual({ enabled: false, volume: 0.65 })
    })
})
