import { describe, expect, it } from 'vitest'
import { isStreamSoundMuted, streamSoundOf, streamSoundVolume } from './streamSound'

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

describe('streamSoundVolume', () => {
    it('plays at 40% when the volume param is absent', () => {
        expect(streamSoundVolume('')).toBe(0.4)
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

    it('falls back to 40% for a value that is not a number', () => {
        expect(streamSoundVolume('?volume=loud')).toBe(0.4)
        expect(streamSoundVolume('?volume=60%25')).toBe(0.4)
        expect(streamSoundVolume('?volume=')).toBe(0.4)
        expect(streamSoundVolume('?volume=%20')).toBe(0.4)
        expect(streamSoundVolume('?volume=Infinity')).toBe(0.4)
    })
})

describe('streamSoundOf', () => {
    it('plays at 40% by default', () => {
        expect(streamSoundOf('')).toEqual({ muted: false, volume: 0.4 })
    })

    it('reads every sound param together', () => {
        expect(streamSoundOf('?motion=0&volume=80')).toEqual({ muted: false, volume: 0.8 })
    })

    it('keeps the volume when sound=0 mutes it', () => {
        expect(streamSoundOf('?sound=0&volume=20')).toEqual({ muted: true, volume: 0.2 })
    })

    it('ignores the retired sounds param', () => {
        expect(streamSoundOf('?sounds=clean')).toEqual({ muted: false, volume: 0.4 })
        expect(streamSoundOf('?sounds=cinematic&volume=30')).toEqual({ muted: false, volume: 0.3 })
    })
})
