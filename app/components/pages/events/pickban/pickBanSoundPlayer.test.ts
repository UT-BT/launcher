import { describe, expect, it } from 'vitest'
import { masterGainOf } from './pickBanSoundPlayer'

describe('masterGainOf', () => {
    it('is silent at 0 and full at 1', () => {
        expect(masterGainOf(0)).toBe(0)
        expect(masterGainOf(1)).toBe(1)
    })

    it('follows the square of the volume so the slider moves more evenly in loudness', () => {
        expect(masterGainOf(0.6)).toBeCloseTo(0.36, 10)
        expect(masterGainOf(0.5)).toBeCloseTo(0.25, 10)
    })

    it('clamps a volume outside 0 to 1', () => {
        expect(masterGainOf(-0.5)).toBe(0)
        expect(masterGainOf(3)).toBe(1)
    })

    it('is silent for a volume that is not a number', () => {
        expect(masterGainOf(Number.NaN)).toBe(0)
    })
})
