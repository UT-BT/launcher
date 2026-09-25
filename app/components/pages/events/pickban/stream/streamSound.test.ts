import { describe, expect, it } from 'vitest'
import { isStreamSoundMuted, streamSoundOf, streamSoundPack, streamSoundVolume } from './streamSound'

describe('isStreamSoundMuted', () => {
    it('is muted when sound=0 is present', () => {
        expect(isStreamSoundMuted('?sound=0')).toBe(true)
    })

    it('is not muted when the sound param is absent', () => {
        expect(isStreamSoundMuted('')).toBe(false)
    })

    it('is not muted for any other sound value', () => {
        expect(isStreamSoundMuted('?sound=1')).toBe(false)
        expect(isStreamSoundMuted('?sound=off')).toBe(false)
    })

    it('reads sound alongside other query params', () => {
        expect(isStreamSoundMuted('?foo=bar&sound=0&baz=1')).toBe(true)
    })
})

describe('streamSoundPack', () => {
    it('plays the cinematic pack when the sounds param is absent', () => {
        expect(streamSoundPack('')).toBe('cinematic')
    })

    it('reads each known pack', () => {
        expect(streamSoundPack('?sounds=cinematic')).toBe('cinematic')
        expect(streamSoundPack('?sounds=clean')).toBe('clean')
    })

    it('falls back to cinematic for an unknown pack', () => {
        expect(streamSoundPack('?sounds=retro')).toBe('cinematic')
        expect(streamSoundPack('?sounds=Clean')).toBe('cinematic')
        expect(streamSoundPack('?sounds=')).toBe('cinematic')
        expect(streamSoundPack('?sounds=toString')).toBe('cinematic')
    })

    it('does not read the sound param as a pack', () => {
        expect(streamSoundPack('?sound=clean')).toBe('cinematic')
    })
})

describe('streamSoundVolume', () => {
    it('plays at 60% when the volume param is absent', () => {
        expect(streamSoundVolume('')).toBe(0.6)
    })

    it('reads a percentage as a fraction', () => {
        expect(streamSoundVolume('?volume=0')).toBe(0)
        expect(streamSoundVolume('?volume=35')).toBe(0.35)
        expect(streamSoundVolume('?volume=100')).toBe(1)
        expect(streamSoundVolume('?volume=42.5')).toBeCloseTo(0.425, 10)
    })

    it('clamps a percentage outside 0 to 100', () => {
        expect(streamSoundVolume('?volume=250')).toBe(1)
        expect(streamSoundVolume('?volume=-20')).toBe(0)
    })

    it('falls back to 60% for a value that is not a number', () => {
        expect(streamSoundVolume('?volume=loud')).toBe(0.6)
        expect(streamSoundVolume('?volume=60%25')).toBe(0.6)
        expect(streamSoundVolume('?volume=')).toBe(0.6)
        expect(streamSoundVolume('?volume=%20')).toBe(0.6)
        expect(streamSoundVolume('?volume=Infinity')).toBe(0.6)
    })
})

describe('streamSoundOf', () => {
    it('plays the cinematic pack at 60% by default', () => {
        expect(streamSoundOf('')).toEqual({ muted: false, pack: 'cinematic', volume: 0.6 })
    })

    it('reads every sound param together', () => {
        expect(streamSoundOf('?motion=0&sounds=clean&volume=80')).toEqual({ muted: false, pack: 'clean', volume: 0.8 })
    })

    it('keeps the pack and volume when sound=0 mutes it', () => {
        expect(streamSoundOf('?sound=0&sounds=clean&volume=20')).toEqual({ muted: true, pack: 'clean', volume: 0.2 })
    })
})
