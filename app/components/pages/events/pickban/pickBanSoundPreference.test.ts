import { describe, expect, it } from 'vitest'
import { DEFAULT_SOUND_PREFERENCE, parsePickBanSoundPreference, soundPackOf } from './pickBanSoundPreference'
import { SOUND_PACK_IDS, SOUND_PACKS, type PickBanSoundPack } from './pickBanSounds'

describe('soundPackOf', () => {
    it('accepts every pack there are files for', () => {
        expect([...SOUND_PACK_IDS].sort()).toEqual(Object.keys(SOUND_PACKS).sort())
        for (const pack of Object.keys(SOUND_PACKS) as PickBanSoundPack[]) {
            expect(soundPackOf(pack)).toBe(pack)
        }
    })

    it('falls back to cinematic for anything else', () => {
        expect(soundPackOf(null)).toBe('cinematic')
        expect(soundPackOf(undefined)).toBe('cinematic')
        expect(soundPackOf('retro')).toBe('cinematic')
        expect(soundPackOf('toString')).toBe('cinematic')
        expect(soundPackOf(1)).toBe('cinematic')
    })
})

describe('parsePickBanSoundPreference', () => {
    it('plays the cinematic pack at 60% when nothing is stored', () => {
        expect(parsePickBanSoundPreference(null)).toEqual({ pack: 'cinematic', volume: 0.6 })
        expect(DEFAULT_SOUND_PREFERENCE).toEqual({ pack: 'cinematic', volume: 0.6 })
    })

    it('reads a stored pack and volume', () => {
        expect(parsePickBanSoundPreference('{"pack":"clean","volume":0.25}')).toEqual({ pack: 'clean', volume: 0.25 })
        expect(parsePickBanSoundPreference('{"pack":"cinematic","volume":0}')).toEqual({ pack: 'cinematic', volume: 0 })
    })

    it('keeps the volume when the stored pack is unknown', () => {
        expect(parsePickBanSoundPreference('{"pack":"retro","volume":0.9}')).toEqual({ pack: 'cinematic', volume: 0.9 })
    })

    it('keeps the pack when the stored volume is missing or not a number', () => {
        expect(parsePickBanSoundPreference('{"pack":"clean"}')).toEqual({ pack: 'clean', volume: 0.6 })
        expect(parsePickBanSoundPreference('{"pack":"clean","volume":"loud"}')).toEqual({ pack: 'clean', volume: 0.6 })
        expect(parsePickBanSoundPreference('{"pack":"clean","volume":null}')).toEqual({ pack: 'clean', volume: 0.6 })
    })

    it('clamps a stored volume into 0 to 1', () => {
        expect(parsePickBanSoundPreference('{"pack":"clean","volume":4}')).toEqual({ pack: 'clean', volume: 1 })
        expect(parsePickBanSoundPreference('{"pack":"clean","volume":-1}')).toEqual({ pack: 'clean', volume: 0 })
    })

    it('falls back to the defaults for a value that is not a stored preference', () => {
        expect(parsePickBanSoundPreference('garbage')).toEqual(DEFAULT_SOUND_PREFERENCE)
        expect(parsePickBanSoundPreference('')).toEqual(DEFAULT_SOUND_PREFERENCE)
        expect(parsePickBanSoundPreference('null')).toEqual(DEFAULT_SOUND_PREFERENCE)
        expect(parsePickBanSoundPreference('"clean"')).toEqual(DEFAULT_SOUND_PREFERENCE)
        expect(parsePickBanSoundPreference('0.4')).toEqual(DEFAULT_SOUND_PREFERENCE)
    })
})
