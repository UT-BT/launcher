import { describe, expect, it } from 'vitest'
import { isStreamPreview, streamSceneOptionsOf } from './streamSceneOptions'

describe('isStreamPreview', () => {
    it('is on for preview=1', () => {
        expect(isStreamPreview('?preview=1')).toBe(true)
        expect(isStreamPreview('?sound=0&preview=1&motion=0')).toBe(true)
    })

    it('is off without the param or for any other value', () => {
        for (const search of ['', '?preview=0', '?preview=true', '?preview=', '?preview']) {
            expect(isStreamPreview(search)).toBe(false)
        }
    })
})

describe('streamSceneOptionsOf', () => {
    it('plays sound at the default volume, animates and polls normally when no option is set', () => {
        expect(streamSceneOptionsOf('')).toEqual({
            sound: { muted: false, volume: 0.4 },
            animate: true,
            preview: false,
        })
    })

    it('reads sound=0, volume, motion=0 and preview=1 together', () => {
        expect(streamSceneOptionsOf('?sound=0&volume=70&motion=0&preview=1')).toEqual({
            sound: { muted: true, volume: 0.7 },
            animate: false,
            preview: true,
        })
    })

    it('parses volume the way the pick/ban stream view does', () => {
        expect(streamSceneOptionsOf('?volume=250').sound.volume).toBe(1)
        expect(streamSceneOptionsOf('?volume=-5').sound.volume).toBe(0)
        expect(streamSceneOptionsOf('?volume=loud').sound.volume).toBe(0.4)
    })

    it('only turns motion off for motion=0', () => {
        expect(streamSceneOptionsOf('?motion=1').animate).toBe(true)
        expect(streamSceneOptionsOf('?motion=off').animate).toBe(true)
    })
})
