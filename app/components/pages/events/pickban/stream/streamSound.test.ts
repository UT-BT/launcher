import { describe, expect, it } from 'vitest'
import { isStreamSoundMuted } from './streamSound'

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
