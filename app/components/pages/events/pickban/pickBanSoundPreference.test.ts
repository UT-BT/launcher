import { describe, expect, it } from 'vitest'
import { DEFAULT_SOUND_PREFERENCE, parsePickBanSoundPreference } from './pickBanSoundPreference'

describe('parsePickBanSoundPreference', () => {
    it('plays at 40% when nothing is stored', () => {
        expect(parsePickBanSoundPreference(null)).toEqual({ volume: 0.4 })
        expect(DEFAULT_SOUND_PREFERENCE).toEqual({ volume: 0.4 })
    })

    it('reads a stored volume', () => {
        expect(parsePickBanSoundPreference('{"volume":0.25}')).toEqual({ volume: 0.25 })
        expect(parsePickBanSoundPreference('{"volume":0}')).toEqual({ volume: 0 })
    })

    it('ignores a stored pack and keeps its volume', () => {
        expect(parsePickBanSoundPreference('{"pack":"clean","volume":0.25}')).toEqual({ volume: 0.25 })
        expect(parsePickBanSoundPreference('{"pack":"cinematic","volume":0.9}')).toEqual({ volume: 0.9 })
        expect(parsePickBanSoundPreference('{"pack":"retro","volume":1}')).toEqual({ volume: 1 })
        expect(parsePickBanSoundPreference('{"pack":"clean"}')).toEqual(DEFAULT_SOUND_PREFERENCE)
    })

    it('falls back to the default volume when the stored one is missing or not a number', () => {
        expect(parsePickBanSoundPreference('{}')).toEqual(DEFAULT_SOUND_PREFERENCE)
        expect(parsePickBanSoundPreference('{"volume":"loud"}')).toEqual(DEFAULT_SOUND_PREFERENCE)
        expect(parsePickBanSoundPreference('{"volume":null}')).toEqual(DEFAULT_SOUND_PREFERENCE)
    })

    it('clamps a stored volume into 0 to 1', () => {
        expect(parsePickBanSoundPreference('{"volume":4}')).toEqual({ volume: 1 })
        expect(parsePickBanSoundPreference('{"volume":-1}')).toEqual({ volume: 0 })
    })

    it('falls back to the defaults for a value that is not a stored preference', () => {
        expect(parsePickBanSoundPreference('garbage')).toEqual(DEFAULT_SOUND_PREFERENCE)
        expect(parsePickBanSoundPreference('')).toEqual(DEFAULT_SOUND_PREFERENCE)
        expect(parsePickBanSoundPreference('{"volume":')).toEqual(DEFAULT_SOUND_PREFERENCE)
        expect(parsePickBanSoundPreference('null')).toEqual(DEFAULT_SOUND_PREFERENCE)
        expect(parsePickBanSoundPreference('"clean"')).toEqual(DEFAULT_SOUND_PREFERENCE)
        expect(parsePickBanSoundPreference('0.4')).toEqual(DEFAULT_SOUND_PREFERENCE)
    })
})
