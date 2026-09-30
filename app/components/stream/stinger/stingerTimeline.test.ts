import { describe, expect, it } from 'vitest'
import {
    STINGER_BEATS,
    STINGER_COVERED_FROM_MS,
    STINGER_COVERED_UNTIL_MS,
    STINGER_DURATION_MS,
    STINGER_FPS,
    STINGER_TRANSITION_MS,
    beatAnimation,
    beatEndMs,
    stingerFrameCount,
    stingerFrameTimeMs,
} from './stingerTimeline'

describe('stinger timeline', () => {
    it('lasts 1.2 s at 60 fps', () => {
        expect(STINGER_DURATION_MS).toBe(1200)
        expect(STINGER_FPS).toBe(60)
        expect(stingerFrameCount()).toBe(72)
    })

    it('places frames on the 60 fps grid', () => {
        expect(stingerFrameTimeMs(0)).toBe(0)
        expect(stingerFrameTimeMs(36)).toBe(600)
        expect(stingerFrameTimeMs(71)).toBeCloseTo(1183.33, 2)
    })

    it('cuts inside the window where the screen is fully covered', () => {
        expect(STINGER_COVERED_FROM_MS).toBeLessThan(STINGER_TRANSITION_MS)
        expect(STINGER_TRANSITION_MS).toBeLessThan(STINGER_COVERED_UNTIL_MS)
    })

    it('closes the wipe before the covered window and opens it after', () => {
        expect(beatEndMs(STINGER_BEATS.slabAIn)).toBeLessThanOrEqual(STINGER_COVERED_FROM_MS)
        expect(beatEndMs(STINGER_BEATS.slabBIn)).toBeLessThanOrEqual(STINGER_COVERED_FROM_MS)
        expect(STINGER_BEATS.slabsOut.delayMs).toBeGreaterThanOrEqual(STINGER_COVERED_UNTIL_MS)
    })

    it('shows the branding at the transition point', () => {
        expect(beatEndMs(STINGER_BEATS.plateIn)).toBeLessThanOrEqual(STINGER_TRANSITION_MS)
        expect(beatEndMs(STINGER_BEATS.logoIn)).toBeLessThanOrEqual(STINGER_TRANSITION_MS + 100)
        expect(STINGER_BEATS.brandOut.delayMs).toBeGreaterThan(STINGER_TRANSITION_MS)
    })

    it('is clear of the screen before its last frame', () => {
        for (const beat of Object.values(STINGER_BEATS)) {
            expect(beatEndMs(beat)).toBeLessThanOrEqual(stingerFrameTimeMs(stingerFrameCount() - 1))
        }
    })

    it('writes a beat as a CSS animation that holds both ends', () => {
        expect(beatAnimation('stinger-slab-a-in', { delayMs: 40, durationMs: 380, ease: [0.22, 1, 0.36, 1] }))
            .toBe('stinger-slab-a-in 380ms cubic-bezier(0.22, 1, 0.36, 1) 40ms 1 normal both')
    })
})
