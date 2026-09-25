import { describe, expect, it, vi } from 'vitest'
import { isStreamMotionOff, loadPickBanMotion, parsePickBanMotion, savePickBanMotion, subscribePickBanMotion } from './pickBanMotionPreference'
import { isSyncedKey } from '@/app/utils/userState'

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
        expect(parsePickBanMotion(undefined)).toBe(true)
    })

    it('stays off only when the viewer turned it off', () => {
        expect(parsePickBanMotion('off')).toBe(false)
        expect(parsePickBanMotion('on')).toBe(true)
        expect(parsePickBanMotion('garbage')).toBe(true)
    })
})

describe('the synced Animations preference', () => {
    it('follows the signed-in account', () => {
        expect(isSyncedKey('utbt:pickBanMotion:v1')).toBe(true)
    })

    it('reads back what was saved and tells subscribers', () => {
        const listener = vi.fn()
        const unsubscribe = subscribePickBanMotion(listener)
        savePickBanMotion(false)
        expect(listener).toHaveBeenCalledTimes(1)
        expect(loadPickBanMotion()).toBe(false)
        unsubscribe()
        savePickBanMotion(true)
        expect(listener).toHaveBeenCalledTimes(1)
        expect(loadPickBanMotion()).toBe(true)
    })
})
