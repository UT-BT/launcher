import { describe, expect, it } from 'vitest'
import { STAGE_HEIGHT, STAGE_WIDTH, computeStageScale } from './stageScale'

describe('computeStageScale', () => {
    it('scales down to fit a narrower 1280x720 window', () => {
        expect(computeStageScale(1280, 720)).toBeCloseTo(1280 / STAGE_WIDTH)
    })

    it('scales up to fill a larger 2560x1440 window', () => {
        expect(computeStageScale(2560, 1440)).toBeCloseTo(2560 / STAGE_WIDTH)
    })

    it('is exactly 1 at the native 1920x1080 size', () => {
        expect(computeStageScale(STAGE_WIDTH, STAGE_HEIGHT)).toBe(1)
    })

    it('picks the smaller ratio so a non-16:9 window never crops the stage', () => {
        expect(computeStageScale(1920, 500)).toBeCloseTo(500 / STAGE_HEIGHT)
        expect(computeStageScale(500, 1080)).toBeCloseTo(500 / STAGE_WIDTH)
    })

    it('falls back to 1 for a zero or negative viewport', () => {
        expect(computeStageScale(0, 1080)).toBe(1)
        expect(computeStageScale(1920, 0)).toBe(1)
        expect(computeStageScale(-10, 1080)).toBe(1)
    })
})
