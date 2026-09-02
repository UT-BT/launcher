import { describe, expect, it } from 'vitest'
import {
    formatCoins, formatCountdown, formatMultiplier, formatPercent, formatSigned, parseApiInstant,
} from './predictionsShared'

const NOW = Date.parse('2026-09-20T18:00:00Z')

describe('coin formatting', () => {
    it('groups thousands and rounds to whole coins', () => {
        expect(formatCoins(1000)).toBe('1,000')
        expect(formatCoins(1234.6)).toBe('1,235')
        expect(formatCoins(null)).toBe('0')
    })

    it('signs a profit but never a zero', () => {
        expect(formatSigned(250)).toBe('+250')
        expect(formatSigned(-250)).toBe('-250')
        expect(formatSigned(0)).toBe('0')
    })
})

describe('prices', () => {
    it('reads as a whole-number chance', () => {
        expect(formatPercent(0.5)).toBe('50%')
        expect(formatPercent(0.6832)).toBe('68%')
        expect(formatPercent(undefined)).toBe('0%')
    })

    it('turns a stake and payout into a return', () => {
        expect(formatMultiplier(100, 250)).toBe('2.50x')
        expect(formatMultiplier(0, 250)).toBe('—')
    })
})

describe('parseApiInstant', () => {
    it('reads the offset-aware form predictions send', () => {
        expect(parseApiInstant('2026-09-20T18:00:00+00:00')).toBe(NOW)
    })

    it('still treats the bracket payload’s offset-less form as UTC', () => {
        expect(parseApiInstant('2026-09-20 18:00:00')).toBe(NOW)
    })

    it('is null for a missing or unparseable value', () => {
        expect(parseApiInstant(null)).toBeNull()
        expect(parseApiInstant('not a date')).toBeNull()
    })
})

describe('formatCountdown', () => {
    it('counts down in the largest two units', () => {
        expect(formatCountdown('2026-09-20T18:00:45+00:00', NOW)).toBe('45s')
        expect(formatCountdown('2026-09-20T18:12:30+00:00', NOW)).toBe('12m 30s')
        expect(formatCountdown('2026-09-20T20:30:00+00:00', NOW)).toBe('2h 30m')
        expect(formatCountdown('2026-09-23T02:00:00+00:00', NOW)).toBe('2d 8h')
    })

    it('is null once the deadline has passed, so nothing renders a stale timer', () => {
        expect(formatCountdown('2026-09-20T17:59:59+00:00', NOW)).toBeNull()
        expect(formatCountdown(null, NOW)).toBeNull()
    })
})
