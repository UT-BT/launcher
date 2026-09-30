import { describe, expect, it } from 'vitest'
import { STREAM_T0, streamMapScore, streamMatch, streamScore } from '../../data/streamFixtures'
import type { StreamMatch } from '../../data/streamHotState'
import type { BettingRead } from './bettingRead'
import { bettingBacker, bettingRead, bettingSide } from './bettingFixtures'
import { bettingView, coins, signedCoins, type BackerList, type BettingView } from './bettingView'

const MATCH = streamMatch()
const DECIDED: StreamMatch = streamMatch({
    score: streamScore([streamMapScore(0, [2, 0], 'b'), streamMapScore(1, [2, 1], 'b'), streamMapScore(2, [2, 0], 'b')], { winner: 'b', live_decided: true }),
})

function viewOf(read: BettingRead, match: StreamMatch = MATCH): BettingView {
    return bettingView(read, match, STREAM_T0)
}

function listsOf(view: BettingView): { a: BackerList; b: BackerList } {
    if (!('a' in view)) throw new Error(`no backer lists in ${view.kind}`)
    return { a: view.a, b: view.b }
}

function highlighted(view: BettingView): string[] {
    const { a, b } = listsOf(view)
    return [...a.rows, ...b.rows].filter(row => row.biggest).map(row => row.name)
}

describe('bettingView market states', () => {
    it('shows only the "not enabled" state, with no leaderboard, when the event has no predictions', () => {
        expect(viewOf(bettingRead('not_enabled'))).toEqual({ kind: 'not-enabled' })
    })

    it('shows the leaderboard and no market when predictions are on but the match has no market', () => {
        const view = viewOf(bettingRead('no_market'))
        expect(view.kind).toBe('no-market')
        expect('leaderboard' in view && view.leaderboard).toHaveLength(5)
    })

    it('shows totals, prices and odds only while the market is open', () => {
        const view = viewOf(bettingRead('open'))
        if (view.kind !== 'open') throw new Error(view.kind)
        expect(view.status).toEqual({ chip: 'Market open', tone: 'emerald', text: 'Crimson Cats vs Azure Owls' })
        expect(view.totals).toBe('14,750 coins · 164 predictions')
        expect(view.kicker).toBe('20:00 UTC · in 1h 20m')
        expect(view.odds).toEqual([
            { side: 'a', name: 'Crimson Cats', label: 'Favourite', percent: 58, odds: '1.72', share: 0.58 },
            { side: 'b', name: 'Azure Owls', label: 'Underdog', percent: 42, odds: '2.38', share: 0.42 },
        ])
        expect(view.pool).toBe(14_750)
        expect(view.predictions).toBe(164)
        expect(view.closes).toEqual({ value: 'Pick/ban start', sub: 'or 20:00 UTC at the latest' })
        expect(view).not.toHaveProperty('a')
        expect(view).not.toHaveProperty('b')
    })

    it('never shows a backer while the market is open, even if the read carried one', () => {
        const read = bettingRead('open')
        const leaked = { ...read.sides!, a: { ...read.sides!.a, count: 1, stake: 500, backers: [bettingBacker('ferrum', 500, 860, { biggest: true })] } }
        const view = viewOf({ ...read, sides: leaked })
        expect(JSON.stringify(view)).not.toContain('Ferrum')
    })

    it('labels both sides even when the prices are level', () => {
        const read = bettingRead('open')
        const view = viewOf({ ...read, sides: { a: bettingSide('Crimson Cats', 0.5), b: bettingSide('Azure Owls', 0.5), draw: null } })
        if (view.kind !== 'open') throw new Error(view.kind)
        expect(view.odds.map(side => side.label)).toEqual(['Even', 'Even'])
    })

    it('names the backers with stake, locked payout and multiplier once the market closes', () => {
        const view = viewOf(bettingRead('closed'))
        if (view.kind !== 'closed') throw new Error(view.kind)
        expect(view.status).toEqual({ chip: 'Market closed', tone: 'neutral', text: 'Crimson Cats vs Azure Owls · match underway' })
        expect(view.columns).toBe('locked')
        const { a, b } = listsOf(view)
        expect(a).toMatchObject({ side: 'a', name: 'Crimson Cats', odds: '1.72', backers: 66, staked: 6_420, verdict: null, more: { count: 61, stake: 3_270 } })
        expect(a.rows.map(row => row.name)).toEqual(['Nimbus', 'Quokka', 'Ferrum', 'Lumen', 'Pogo'])
        expect(a.rows[0]).toMatchObject({ userId: '310000000000000002', stake: 1_500, payout: 2_610, multiplier: '1.74x', profit: null, payoutChip: null })
        expect(b.rows[0]).toMatchObject({ name: 'Harbinger', biggest: true })
        expect(b.more).toEqual({ count: 93, stake: 3_280 })
    })

    it('reads "awaiting result" when the match is over but no official result exists', () => {
        const view = viewOf(bettingRead('closed'), DECIDED)
        expect(view.kind).toBe('awaiting')
        if (view.kind !== 'awaiting') return
        expect(view.status).toEqual({ chip: 'Awaiting result', tone: 'amber', text: 'Crimson Cats vs Azure Owls · waiting for the official result' })
        expect(view.columns).toBe('locked')
    })

    it('shows won/lost, profit and pending payouts inside the settlement hold', () => {
        const view = viewOf(bettingRead('resolved'))
        if (view.kind !== 'paying-out') throw new Error(view.kind)
        expect(view.status).toEqual({
            chip: 'Paying out',
            tone: 'sky',
            text: 'Crimson Cats won · payouts pending, the settlement hold ends 21:30 UTC · in 2h 50m',
        })
        expect(view.columns).toBe('result')
        const { a, b } = listsOf(view)
        expect([a.verdict, b.verdict]).toEqual(['won', 'lost'])
        expect(a.rows[0]).toMatchObject({ profit: 1_110, payoutChip: 'Pending' })
        expect(b.rows[0]).toMatchObject({ profit: -3_000, payoutChip: null })
    })

    it('drops the settlement hold time once settles_at has passed but payouts are still pending', () => {
        const read = bettingRead('resolved')
        const view = viewOf({ ...read, market: { ...read.market!, settles_at: '2020-01-01T00:00:00Z' } })
        if (view.kind !== 'paying-out') throw new Error(view.kind)
        expect(view.status.text).toBe('Crimson Cats won · payouts pending')
    })

    it('shows paid payouts once the market is settled', () => {
        const view = viewOf(bettingRead('settled'))
        if (view.kind !== 'settled') throw new Error(view.kind)
        expect(view.status).toEqual({ chip: 'Settled', tone: 'emerald', text: 'Crimson Cats won · all payouts paid' })
        const { a, b } = listsOf(view)
        expect(a.rows.every(row => row.payoutChip === 'Paid')).toBe(true)
        expect(b.rows.every(row => row.payoutChip === null)).toBe(true)
    })

    it('shows every stake refunded when the market is voided', () => {
        const view = viewOf(bettingRead('voided'))
        if (view.kind !== 'voided') throw new Error(view.kind)
        expect(view.status).toEqual({ chip: 'Voided', tone: 'neutral', text: 'The match was cancelled · all stakes refunded' })
        const { a, b } = listsOf(view)
        expect([a.verdict, b.verdict]).toEqual([null, null])
        expect(a.rows[0]).toMatchObject({ profit: 0, payoutChip: 'Refunded' })
    })

    it('shows the refund reason when an official result refunds everyone', () => {
        const read = bettingRead('settled')
        const refunded = { ...read.result!, outcome: 'draw' as const, refunded: true, reason: 'The match was a draw' }
        const view = viewOf({ ...read, result: refunded })
        if (view.kind !== 'settled') throw new Error(view.kind)
        expect(view.status.text).toBe('The match was a draw · all stakes refunded')
        expect([view.a.verdict, view.b.verdict]).toEqual([null, null])
    })
})

describe('bettingView never shows a winner without an official result', () => {
    it('keeps an open market free of any verdict even when the live score has a winner', () => {
        const view = viewOf(bettingRead('open'), DECIDED)
        expect(view.kind).toBe('open')
        expect(JSON.stringify(view)).not.toMatch(/won|lost/i)
    })

    it('holds back won/lost on a closed market even when the live score has a winner', () => {
        const view = viewOf(bettingRead('closed'), DECIDED)
        const { a, b } = listsOf(view)
        expect([a.verdict, b.verdict]).toEqual([null, null])
        expect([...a.rows, ...b.rows].every(row => row.profit === null && row.payoutChip === null)).toBe(true)
        expect(JSON.stringify(view)).not.toMatch(/Azure Owls won/)
    })

    it('treats a decided market with no official result as awaiting', () => {
        const read = bettingRead('resolved')
        const view = viewOf({ ...read, result: { status: 'awaiting', outcome: null, refunded: false, reason: null, payout_state: null } }, DECIDED)
        expect(view.kind).toBe('awaiting')
        const { a, b } = listsOf(view)
        expect([a.verdict, b.verdict]).toEqual([null, null])
        expect([...a.rows, ...b.rows].every(row => row.profit === null)).toBe(true)
    })
})

describe('bettingView biggest bet', () => {
    it('highlights exactly the one flagged backer in the whole market', () => {
        expect(highlighted(viewOf(bettingRead('closed')))).toEqual(['Harbinger'])
    })

    it('keeps the biggest bet on screen when it falls outside the rows shown', () => {
        const read = bettingRead('closed')
        const backers = read.sides!.a.backers.map(backer => ({ ...backer, biggest: backer.display_name === 'Fennel' }))
        const b = { ...read.sides!.b, backers: read.sides!.b.backers.map(backer => ({ ...backer, biggest: false })) }
        const view = viewOf({ ...read, sides: { ...read.sides!, a: { ...read.sides!.a, backers }, b } })
        const { a } = listsOf(view)
        expect(a.rows.map(row => row.name)).toEqual(['Nimbus', 'Quokka', 'Ferrum', 'Lumen', 'Fennel'])
        expect(a.more).toEqual({ count: 61, stake: 3_280 })
        expect(highlighted(view)).toEqual(['Fennel'])
    })

    it('highlights nobody when the read flags nobody', () => {
        const read = bettingRead('closed')
        const b = { ...read.sides!.b, backers: read.sides!.b.backers.map(backer => ({ ...backer, biggest: false })) }
        expect(highlighted(viewOf({ ...read, sides: { ...read.sides!, b } }))).toEqual([])
    })
})

describe('bettingView draws', () => {
    function withDraw(read: BettingRead): BettingRead {
        const draw = bettingSide(null, 0.12, {
            count: 4,
            stake: 700,
            backers: [bettingBacker('fennel', 400, 3_300), bettingBacker('sable', 300, 2_480)],
        })
        return { ...read, market: { ...read.market!, draws_allowed: true }, sides: { ...read.sides!, draw } }
    }

    it('adds the draw price between the two teams while open', () => {
        const view = viewOf(withDraw(bettingRead('open')))
        if (view.kind !== 'open') throw new Error(view.kind)
        expect(view.odds.map(side => [side.side, side.name, side.percent])).toEqual([['a', 'Crimson Cats', 58], ['draw', 'Draw', 12], ['b', 'Azure Owls', 42]])
    })

    it('shows four backers per team and a draw line once closed', () => {
        const view = viewOf(withDraw(bettingRead('closed')))
        if (view.kind !== 'closed') throw new Error(view.kind)
        expect(view.a.rows).toHaveLength(4)
        expect(view.a.more).toEqual({ count: 62, stake: 3_370 })
        expect(view.draw).toMatchObject({ odds: '8.33', backers: 4, staked: 700, verdict: null, biggest: null })
    })

    it('names a biggest bet placed on the draw', () => {
        const read = withDraw(bettingRead('closed'))
        const draw = { ...read.sides!.draw!, backers: read.sides!.draw!.backers.map((backer, index) => ({ ...backer, biggest: index === 0 })) }
        const b = { ...read.sides!.b, backers: read.sides!.b.backers.map(backer => ({ ...backer, biggest: false })) }
        const view = viewOf({ ...read, sides: { ...read.sides!, b, draw } })
        if (view.kind !== 'closed') throw new Error(view.kind)
        expect(view.draw?.biggest).toMatchObject({ name: 'Fennel', stake: 400 })
    })

    it('marks the draw as won and both teams as lost on an official draw', () => {
        const read = withDraw(bettingRead('settled'))
        const view = viewOf({ ...read, result: { ...read.result!, outcome: 'draw' } })
        if (view.kind !== 'settled') throw new Error(view.kind)
        expect(view.status.text).toBe('Draw · all payouts paid')
        expect([view.a.verdict, view.draw?.verdict, view.b.verdict]).toEqual(['lost', 'won', 'lost'])
    })
})

describe('bettingView leaderboard', () => {
    it('lists the top five with cup-wide profit and correct calls', () => {
        const view = viewOf(bettingRead('closed'))
        if (!('leaderboard' in view)) throw new Error(view.kind)
        expect(view.leaderboard).toHaveLength(5)
        expect(view.leaderboard[0]).toEqual({
            rank: 1,
            userId: '310000000000000001',
            name: 'Harbinger',
            title: { name: 'Oracle', rarity: 3, color_r: 52, color_g: 211, color_b: 153 },
            profit: 18_420,
            correct: '31 / 44',
        })
    })

    it('keeps at most five rows', () => {
        const read = bettingRead('closed')
        const view = viewOf({ ...read, leaderboard: [...read.leaderboard, { ...read.leaderboard[4], rank: 6 }] })
        if (!('leaderboard' in view)) throw new Error(view.kind)
        expect(view.leaderboard.map(row => row.rank)).toEqual([1, 2, 3, 4, 5])
    })
})

describe('coin text', () => {
    it('groups thousands and signs profits with a true minus', () => {
        expect(coins(14_750)).toBe('14,750')
        expect(signedCoins(1_110)).toBe('+1,110')
        expect(signedCoins(-3_000)).toBe('−3,000')
        expect(signedCoins(0)).toBe('0')
    })
})
