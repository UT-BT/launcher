import { describe, expect, it } from 'vitest'
import {
    DRIFT_CATCH_UP_SECONDS,
    DRIFT_DEADBAND_SECONDS,
    DRIFT_RATE_MAX_NUDGE,
    FALLBACK_FPS,
    MAX_PLAYBACK_RATE,
    MIN_PLAYBACK_RATE,
    PLAYBACK_RATES,
    POSITION_RATE_MAX_FACTOR,
    POSITION_RATE_MIN_FACTOR,
    RESEEK_SECONDS,
    SKIP_SECONDS,
    START_ALIGN_FRAMES,
} from './playbackConstants'

describe('the playback thresholds and rates', () => {
    it('line videos up to one frame before starting and re-seek a playing video only above a quarter second', () => {
        expect(START_ALIGN_FRAMES).toBe(1)
        expect(RESEEK_SECONDS).toBe(0.25)
    })

    it('leave Race drift under 50 ms alone and pull larger drift back by at most 10 % of the rate', () => {
        expect(DRIFT_DEADBAND_SECONDS).toBe(0.05)
        expect(DRIFT_CATCH_UP_SECONDS).toBe(1)
        expect(DRIFT_RATE_MAX_NUDGE).toBe(0.1)
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
