import { describe, expect, it } from 'vitest'
import { isStreamMotionOff, parsePickBanMotion } from './pickBanMotionPreference'

describe('isStreamMotionOff', () => {
    it('is off when motion=0 is present', () => {
        expect(isStreamMotionOff('?motion=0')).toBe(true)
    })

    it('animates when the motion param is absent', () => {
        expect(isStreamMotionOff('')).toBe(false)
    })

    it('animates for any other motion value', () => {
        expect(isStreamMotionOff('?motion=1')).toBe(false)
        expect(isStreamMotionOff('?motion=off')).toBe(false)
    })

    it('reads motion alongside other query params', () => {
        expect(isStreamMotionOff('?sound=0&motion=0')).toBe(true)
    })
})

describe('parsePickBanMotion', () => {
    it('animates when nothing is stored', () => {
        expect(parsePickBanMotion(null)).toBe(true)
    })

    it('stays off only when the viewer turned it off', () => {
        expect(parsePickBanMotion('off')).toBe(false)
        expect(parsePickBanMotion('on')).toBe(true)
        expect(parsePickBanMotion('garbage')).toBe(true)
    })
})
