import { describe, expect, it } from 'vitest'
import type { PredictionMarket } from '@/app/utils/api'
import {
    evenMarketPriceAfter, formatCoins, formatCountdown, formatMultiplier, formatOdds, formatPercent,
    formatSigned, liquidityForPriceAfter, openingPriceOf, outcomeLabel, parseApiInstant,
    priceDrift, priceOf, sideLabel, sidesOf,
} from './predictionsShared'

const NOW = Date.parse('2026-09-20T18:00:00Z')

function aMarket(overrides: Partial<PredictionMarket> = {}): PredictionMarket {
    return {
        id: 'market',
        match_id: 'match',
        stage_id: 'stage',
        status: 'open',
        outcome: null,
        draws_allowed: true,
        price_a: 0.64,
        price_b: 0.09,
        price_draw: 0.27,
        opening_price_a: 0.6,
        opening_price_b: 0.12,
        opening_price_draw: 0.28,
        pool_stake: 0,
        position_count: 0,
        liquidity_b: 1000,
        manual_override: null,
        closes_at: null,
        closed_at: null,
        resolved_at: null,
        settles_at: null,
        settled_at: null,
        team_a: { id: 'ta', name: 'Puzzle Masters' },
        team_b: { id: 'tb', name: 'Hare Force One' },
        your_position: null,
        ...overrides,
    } as PredictionMarket
}

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

    it('inverts a price into the decimal odds a player is offered', () => {
        expect(formatOdds(0.5)).toBe('2.00')
        expect(formatOdds(0.91)).toBe('1.10')
        expect(formatOdds(0.04)).toBe('25.00')
    })

    it('stays two decimals across the whole range the price floor allows', () => {
        expect(formatOdds(0.999)).toBe('1.00')
        expect(formatOdds(0.041)).toBe('24.39')
    })

    it('drops the decimals on a price the floor never promised to hold', () => {
        expect(formatOdds(0.005)).toBe('200')
        expect(formatOdds(0.0001)).toBe('999+')
    })

    it('has nothing to offer on a price of zero rather than dividing by it', () => {
        expect(formatOdds(0)).toBe('—')
        expect(formatOdds(null)).toBe('—')
        expect(formatOdds(undefined)).toBe('—')
    })

    it('agrees with the multiplier a locked position actually returns', () => {
        expect(formatOdds(100 / 250)).toBe('2.50')
        expect(formatMultiplier(100, 250)).toBe('2.50x')
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


describe('which outcomes a market offers', () => {
    it('gives a group match three and a knockout two', () => {
        expect(sidesOf(aMarket())).toEqual(['a', 'draw', 'b'])
        expect(sidesOf(aMarket({ draws_allowed: false }))).toEqual(['a', 'b'])
    })

    it('reads a price per outcome', () => {
        const market = aMarket()

        expect(priceOf(market, 'a')).toBe(0.64)
        expect(priceOf(market, 'draw')).toBe(0.27)
        expect(priceOf(market, 'b')).toBe(0.09)
    })

    it('treats a missing draw price as zero rather than as NaN', () => {
        expect(priceOf(aMarket({ draws_allowed: false, price_draw: null }), 'draw')).toBe(0)
    })

    it('names each outcome the way a card has to render it', () => {
        const market = aMarket()

        expect(sideLabel(market, 'a')).toBe('Puzzle Masters')
        expect(sideLabel(market, 'draw')).toBe('Draw')
        expect(sideLabel(market, 'b')).toBe('Hare Force One')
    })
})

describe('drift from the opening price', () => {
    it('reports the move in points of probability', () => {
        expect(priceDrift(aMarket(), 'a')).toBe(4)
        expect(priceDrift(aMarket(), 'b')).toBe(-3)
    })

    it('is null before the server has sent an opening price', () => {
        const market = aMarket({ opening_price_a: null })

        expect(openingPriceOf(market, 'a')).toBeNull()
        expect(priceDrift(market, 'a')).toBeNull()
    })
})

describe('what a settled market says happened', () => {
    it('pays the draw on a match that offered one', () => {
        const market = aMarket({ status: 'settled', outcome: 'draw' })

        expect(outcomeLabel(market)).toBe('Drawn — the draw paid out')
    })

    it('refunds a draw on a match that did not offer one', () => {
        const market = aMarket({ status: 'settled', outcome: 'draw', draws_allowed: false })

        expect(outcomeLabel(market)).toBe('Draw — everyone refunded')
    })

    it('names the winner otherwise', () => {
        expect(outcomeLabel(aMarket({ status: 'settled', outcome: 'a' }))).toBe('Puzzle Masters won')
        expect(outcomeLabel(aMarket({ status: 'voided', outcome: 'void' }))).toBe('Void — everyone refunded')
        expect(outcomeLabel(aMarket())).toBeNull()
    })
})
