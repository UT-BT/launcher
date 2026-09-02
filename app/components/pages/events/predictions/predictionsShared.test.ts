import { describe, expect, it } from 'vitest'
import {
    evenMarketPriceAfter, formatCoins, formatCountdown, formatMultiplier, formatPercent,
    formatSigned, liquidityForPriceAfter, parseApiInstant,
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

describe('liquidity preview', () => {
    it('matches the price the server reaches for the same trade', () => {
        // 250 coins at b = 1000 on a fresh market buys 449.833… shares, which the
        // server prices at 0.610599…. This preview must agree or the manage panel
        // is describing a market that does not exist.
        expect(evenMarketPriceAfter(250, 1000)).toBeCloseTo(0.6105996, 6)
    })

    it('moves less as liquidity rises', () => {
        expect(evenMarketPriceAfter(250, 400)).toBeGreaterThan(evenMarketPriceAfter(250, 1000))
        expect(evenMarketPriceAfter(250, 4000)).toBeLessThan(evenMarketPriceAfter(250, 1000))
    })

    it('leaves an even market even when nothing is staked', () => {
        expect(evenMarketPriceAfter(0, 1000)).toBe(0.5)
        expect(evenMarketPriceAfter(250, 0)).toBe(0.5)
    })

    it('round-trips against the preset solver', () => {
        for (const target of [0.56, 0.62, 0.72]) {
            const liquidity = liquidityForPriceAfter(250, target)

            expect(evenMarketPriceAfter(250, liquidity)).toBeCloseTo(target, 3)
        }
    })

    it('clamps a nonsensical target rather than dividing by zero', () => {
        expect(Number.isFinite(liquidityForPriceAfter(250, 0.5))).toBe(true)
        expect(Number.isFinite(liquidityForPriceAfter(250, 1))).toBe(true)
    })
})
