import { describe, expect, it } from 'vitest'
import {
    DRIFT_RESEEK_FRAMES,
    FALLBACK_FPS,
    MAX_PLAYBACK_RATE,
    MIN_PLAYBACK_RATE,
    PLAYBACK_RATES,
    POSITION_RATE_MAX_FACTOR,
    POSITION_RATE_MIN_FACTOR,
    POSITION_RESEEK_SECONDS,
    SKIP_SECONDS,
} from './playbackConstants'

describe('the playback thresholds and rates', () => {
    it('re-seek in Race above one frame and in Sync by position above a quarter second', () => {
        expect(DRIFT_RESEEK_FRAMES).toBe(1)
        expect(POSITION_RESEEK_SECONDS).toBe(0.25)
    })

    it('clamp the Sync by position rate to half and double the global rate', () => {
        expect([POSITION_RATE_MIN_FACTOR, POSITION_RATE_MAX_FACTOR]).toEqual([0.5, 2])
    })

    it('fall back to 30 fps, skip 5 s and offer rates from a quarter to double speed', () => {
        expect(FALLBACK_FPS).toBe(30)
        expect(SKIP_SECONDS).toBe(5)
        expect([MIN_PLAYBACK_RATE, MAX_PLAYBACK_RATE]).toEqual([0.25, 2])
        expect(PLAYBACK_RATES).toEqual([0.25, 0.5, 1, 1.5, 2])
    })
})
