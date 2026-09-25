import { describe, expect, it } from 'vitest'
import type { EventMatchStatus, MatchPickBanStatus, PredictionMarket } from '@/app/utils/api'
import {
    lockStartedMarkets, marketTakesPredictions, matchLockSignals, matchLocksBets, newlyLockedMatchIds,
    type MatchLockSignal,
} from './marketLock'

function aMarket(overrides: Partial<PredictionMarket> = {}): PredictionMarket {
    return {
        id: 'market',
        match_id: 'm1',
        stage_id: 'stage',
        status: 'open',
        outcome: null,
        draws_allowed: false,
        price_a: 0.5,
        price_b: 0.5,
        price_draw: null,
        pool_stake: 0,
        position_count: 0,
        liquidity_b: 1000,
        manual_override: null,
        closes_at: null,
        closed_at: null,
        resolved_at: null,
        settles_at: null,
        settled_at: null,
        your_position: null,
        match: {
            id: 'm1', round_no: 1, round_label: null, ordinal: 0, status: 'scheduled',
            scheduled_at: '2026-09-26T20:00:00+00:00', best_of: 3, score_a: null, score_b: null,
        },
        ...overrides,
    }
}

function withMatchStatus(status: EventMatchStatus): PredictionMarket {
    const market = aMarket()
    return { ...market, match: { ...market.match!, status } }
}

describe('matchLocksBets', () => {
    it.each<EventMatchStatus>(['pending', 'scheduled'])('keeps bets open on a %s match with no pick/ban started', (status) => {
        expect(matchLocksBets({ status, pick_ban_status: 'none' })).toBe(false)
        expect(matchLocksBets({ status, pick_ban_status: 'lobby' })).toBe(false)
    })

    it.each<EventMatchStatus>(['live', 'complete', 'forfeit', 'bye', 'cancelled'])('locks bets on a %s match', (status) => {
        expect(matchLocksBets({ status })).toBe(true)
    })

    it.each<MatchPickBanStatus>(['running', 'paused', 'complete'])('locks bets once the pick/ban is %s, even on a scheduled match', (status) => {
        expect(matchLocksBets({ status: 'scheduled', pick_ban_status: status })).toBe(true)
    })

    it('knows nothing, so locks nothing, without a match', () => {
        expect(matchLocksBets(null)).toBe(false)
        expect(matchLocksBets(undefined)).toBe(false)
        expect(matchLocksBets({})).toBe(false)
    })
})

describe('marketTakesPredictions', () => {
    it('takes predictions on an open market for a scheduled match', () => {
        expect(marketTakesPredictions(aMarket())).toBe(true)
    })

    it('refuses on a market the server has already closed', () => {
        expect(marketTakesPredictions(aMarket({ status: 'closed' }))).toBe(false)
        expect(marketTakesPredictions(aMarket({ status: 'settled' }))).toBe(false)
    })

    it('refuses on a stale open market whose own match payload is already live', () => {
        expect(marketTakesPredictions(withMatchStatus('live'))).toBe(false)
    })

    it('refuses when another read shows the pick/ban has started', () => {
        expect(marketTakesPredictions(aMarket(), { status: 'scheduled', pick_ban_status: 'running' })).toBe(false)
    })

    it('still takes predictions when a lobby is only open', () => {
        expect(marketTakesPredictions(aMarket(), { status: 'scheduled', pick_ban_status: 'lobby' })).toBe(true)
    })

    it('reads a market with no match payload by its own status alone', () => {
        expect(marketTakesPredictions(aMarket({ match: undefined }))).toBe(true)
    })
})

describe('lockStartedMarkets', () => {
    it('shows a started match market as closed and leaves the rest untouched', () => {
        const started = aMarket({ id: 'started', match_id: 'm1' })
        const waiting = aMarket({ id: 'waiting', match_id: 'm2' })
        const signals = new Map<string, MatchLockSignal>([
            ['m1', { status: 'live', pick_ban_status: 'running' }],
            ['m2', { status: 'scheduled', pick_ban_status: 'none' }],
        ])

        const [lockedStarted, lockedWaiting] = lockStartedMarkets([started, waiting], signals)

        expect(lockedStarted.status).toBe('closed')
        expect(lockedWaiting).toBe(waiting)
    })

    it('closes a stale open market from its own match payload with no other signal', () => {
        const [market] = lockStartedMarkets([withMatchStatus('live')], new Map())
        expect(market.status).toBe('closed')
    })

    it('never reopens or rewrites a market that is not open', () => {
        const settled = aMarket({ status: 'settled' })
        const [market] = lockStartedMarkets([settled], new Map([['m1', { status: 'scheduled' }]]))
        expect(market).toBe(settled)
    })
})

describe('matchLockSignals', () => {
    it('lets a later read of a match replace an earlier one', () => {
        const signals = matchLockSignals([
            { id: 'm1', status: 'scheduled', pick_ban_status: 'none' },
            { id: 'm1', status: 'live', pick_ban_status: 'running' },
        ], null)

        expect(signals.get('m1')).toEqual({ status: 'live', pick_ban_status: 'running' })
    })

    it('overlays the viewer own open session on its match', () => {
        const signals = matchLockSignals([
            { id: 'm1', status: 'scheduled', pick_ban_status: 'lobby' },
        ], { match_id: 'm1', status: 'running' })

        expect(signals.get('m1')).toEqual({ status: 'scheduled', pick_ban_status: 'running' })
    })

    it('knows a session match no other read has seen', () => {
        const signals = matchLockSignals([], { match_id: 'm9', status: 'paused' })
        expect(signals.get('m9')).toEqual({ pick_ban_status: 'paused' })
    })
})

describe('newlyLockedMatchIds', () => {
    it('notices a match whose pick/ban has just started', () => {
        const previous = new Map<string, MatchLockSignal>([['m1', { status: 'scheduled', pick_ban_status: 'lobby' }]])
        const next = new Map<string, MatchLockSignal>([['m1', { status: 'live', pick_ban_status: 'running' }]])

        expect(newlyLockedMatchIds(previous, next)).toEqual(['m1'])
    })

    it('ignores a match that was already locked', () => {
        const previous = new Map<string, MatchLockSignal>([['m1', { status: 'live', pick_ban_status: 'running' }]])
        const next = new Map<string, MatchLockSignal>([['m1', { status: 'live', pick_ban_status: 'complete' }]])

        expect(newlyLockedMatchIds(previous, next)).toEqual([])
    })

    it('ignores a match seen for the first time, so the first load triggers nothing', () => {
        const next = new Map<string, MatchLockSignal>([['m1', { status: 'live', pick_ban_status: 'running' }]])

        expect(newlyLockedMatchIds(new Map(), next)).toEqual([])
    })

    it('ignores a match whose pick/ban was restarted back to the lobby', () => {
        const previous = new Map<string, MatchLockSignal>([['m1', { status: 'live', pick_ban_status: 'running' }]])
        const next = new Map<string, MatchLockSignal>([['m1', { status: 'scheduled', pick_ban_status: 'lobby' }]])

        expect(newlyLockedMatchIds(previous, next)).toEqual([])
    })
})
