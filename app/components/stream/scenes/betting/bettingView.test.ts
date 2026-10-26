import { describe, expect, it } from 'vitest'
import { STREAM_T0, streamMapScore, streamMatch, streamScore } from '../../data/streamFixtures'
import type { StreamMatch } from '../../data/streamHotState'
import type { BettingRead } from './bettingRead'
import { bettingBacker, bettingMarketRead, bettingRead, bettingSide } from './bettingFixtures'
import { bettingView, coins, signedCoins, type BackerRow, type BettingGroup, type BettingView } from './bettingView'

const MATCH = streamMatch()
const DECIDED: StreamMatch = streamMatch({
    score: streamScore([streamMapScore(0, [2, 0], 'b'), streamMapScore(1, [2, 1], 'b'), streamMapScore(2, [2, 0], 'b')], { winner: 'b', live_decided: true }),
})

type PositionsView = Extract<BettingView, { groups: BettingGroup[] }>

function viewOf(read: BettingRead, match: StreamMatch = MATCH): BettingView {
    return bettingView(read, match, STREAM_T0)
}

function positions(read: BettingRead, match: StreamMatch = MATCH): PositionsView {
    const view = viewOf(read, match)
    if (!('groups' in view)) throw new Error(`no positions in ${view.kind}`)
    return view
}

function group(view: PositionsView, side: BettingGroup['side']): BettingGroup {
    const found = view.groups.find(entry => entry.side === side)
    if (!found) throw new Error(`no ${side} group`)
    return found
}

function rowsOf(entry: BettingGroup): BackerRow[] {
    return entry.columns.flat().flatMap(slot => (slot.kind === 'backer' ? [slot.row] : []))
}

function notesOf(entry: BettingGroup): string[] {
    return entry.columns.flat().flatMap(slot => (slot.kind === 'note' ? [slot.text] : []))
}

function names(view: PositionsView): string[][][] {
    return view.groups.map(entry => entry.columns.map(column => column.map(slot => (slot.kind === 'backer' ? slot.row.name : slot.text))))
}

describe('bettingView market states', () => {
    it('shows only the "not enabled" state when the event has no predictions', () => {
        expect(viewOf(bettingRead('not_enabled'))).toEqual({ kind: 'not-enabled' })
    })

    it('shows no market when predictions are on but the match has no market', () => {
        expect(viewOf(bettingRead('no_market'))).toEqual({ kind: 'no-market' })
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
        expect(view.closes).toEqual({ value: 'Pick/ban start', sub: 'or 20:00 UTC at the latest' })
        expect(view).not.toHaveProperty('groups')
    })

    it('shows a dash for a side the API sends no odds for', () => {
        const read = bettingRead('open')
        const view = viewOf({ ...read, sides: { ...read.sides!, b: { ...read.sides!.b, odds: null } } })
        if (view.kind !== 'open') throw new Error(view.kind)
        expect(view.odds.map(side => side.odds)).toEqual(['1.72', '—'])
    })

    it('never shows a backer while the market is open, even if the read carried one', () => {
        const read = bettingRead('open')
        const leaked = { ...read.sides!, a: { ...read.sides!.a, count: 1, stake: 500, backers: [bettingBacker('ferrum', 500, 860, { biggest: true })] } }
        expect(JSON.stringify(viewOf({ ...read, sides: leaked }))).not.toContain('Ferrum')
    })

    it('labels both sides even when the prices are level', () => {
        const read = bettingRead('open')
        const view = viewOf({ ...read, sides: { a: bettingSide('Crimson Cats', 0.5), b: bettingSide('Azure Owls', 0.5), draw: null } })
        if (view.kind !== 'open') throw new Error(view.kind)
        expect(view.odds.map(side => side.label)).toEqual(['Even', 'Even'])
    })

    it('names every backer with stake, locked payout and multiplier once the market closes', () => {
        const view = positions(bettingRead('closed'))
        expect(view.kind).toBe('closed')
        expect(view.status).toEqual({ chip: 'Market closed', tone: 'neutral', text: 'Crimson Cats vs Azure Owls · match underway' })
        expect(view.columns).toBe('locked')
        const a = group(view, 'a')
        expect(a).toMatchObject({ name: 'Crimson Cats', meta: 'Odds 1.72 · 6 bettors · 3,240 staked', verdict: null })
        expect(rowsOf(a).map(row => row.name)).toEqual(['Nimbus', 'Quokka', 'Ferrum', 'Lumen', 'Pogo', 'Fennel'])
        expect(rowsOf(a)[0]).toEqual({
            userId: '310000000000000002',
            name: 'Nimbus',
            biggest: false,
            tone: null,
            stake: '1,500',
            payout: '2,610',
            multiplier: '1.74x',
            profit: null,
            payoutChip: null,
        })
        expect(notesOf(a)).toEqual([])
    })

    it('shows a dash for a backer the API sends no multiplier for', () => {
        const read = bettingRead('closed')
        const backers = read.sides!.a.backers.map((backer, index) => (index === 0 ? { ...backer, multiplier: null } : backer))
        const view = positions({ ...read, sides: { ...read.sides!, a: { ...read.sides!.a, backers } } })
        expect(rowsOf(group(view, 'a'))[0].multiplier).toBe('—')
    })

    it('reads "awaiting result" when the match is over but no official result exists', () => {
        const view = positions(bettingRead('closed'), DECIDED)
        expect(view.kind).toBe('awaiting')
        expect(view.status).toEqual({ chip: 'Awaiting result', tone: 'amber', text: 'Crimson Cats vs Azure Owls · waiting for the official result' })
        expect(view.columns).toBe('locked')
    })

    it('lights the winners and dims the losers with their lost stake inside the settlement hold', () => {
        const view = positions(bettingRead('resolved'))
        expect(view.kind).toBe('paying-out')
        expect(view.status).toEqual({
            chip: 'Paying out',
            tone: 'sky',
            text: 'Crimson Cats won · payouts pending, the settlement hold ends 21:30 UTC · in 2h 50m',
        })
        expect(view.columns).toBe('result')
        const [a, b] = [group(view, 'a'), group(view, 'b')]
        expect([a.verdict, b.verdict]).toEqual(['won', 'lost'])
        expect(rowsOf(a)[0]).toMatchObject({ tone: 'won', payout: '2,610', profit: 1_110, payoutChip: 'Pending' })
        expect(rowsOf(b)[0]).toMatchObject({ tone: 'lost', payout: '—', profit: -3_000, payoutChip: null })
    })

    it('drops the settlement hold time once settles_at has passed but payouts are still pending', () => {
        const read = bettingRead('resolved')
        const view = positions({ ...read, market: { ...read.market!, settles_at: '2020-01-01T00:00:00Z' } })
        expect(view.status.text).toBe('Crimson Cats won · payouts pending')
    })

    it('shows paid payouts once the market is settled', () => {
        const view = positions(bettingRead('settled'))
        expect(view.status).toEqual({ chip: 'Settled', tone: 'emerald', text: 'Crimson Cats won · all payouts paid' })
        expect(rowsOf(group(view, 'a')).every(row => row.payoutChip === 'Paid')).toBe(true)
        expect(rowsOf(group(view, 'b')).every(row => row.payoutChip === null)).toBe(true)
    })

    it('refunds every row when the market is voided, with nobody lit or dimmed', () => {
        const view = positions(bettingRead('voided'))
        expect(view.kind).toBe('voided')
        expect(view.status).toEqual({ chip: 'Voided', tone: 'neutral', text: 'The match was cancelled · all stakes refunded' })
        expect(view.groups.map(entry => entry.verdict)).toEqual([null, null])
        const rows = view.groups.flatMap(rowsOf)
        expect(rows.every(row => row.tone === null && row.profit === 0 && row.payoutChip === 'Refunded' && row.payout === row.stake)).toBe(true)
    })

    it('shows the refund reason when an official result refunds everyone', () => {
        const read = bettingRead('settled')
        const view = positions({ ...read, result: { ...read.result!, outcome: 'draw', refunded: true, reason: 'The match was a draw' } })
        expect(view.status.text).toBe('The match was a draw · all stakes refunded')
        expect(view.groups.map(entry => entry.verdict)).toEqual([null, null])
    })
})

describe('bettingView never shows a winner without an official result', () => {
    it('keeps an open market free of any verdict even when the live score has a winner', () => {
        const view = viewOf(bettingRead('open'), DECIDED)
        expect(view.kind).toBe('open')
        expect(JSON.stringify(view)).not.toMatch(/won|lost/i)
    })

    it('holds back won/lost on a closed market even when the live score has a winner', () => {
        const view = positions(bettingRead('closed'), DECIDED)
        expect(view.groups.map(entry => entry.verdict)).toEqual([null, null])
        expect(view.groups.flatMap(rowsOf).every(row => row.tone === null && row.profit === null && row.payoutChip === null)).toBe(true)
        expect(JSON.stringify(view)).not.toMatch(/Azure Owls won/)
    })

    it('treats a decided market with no official result as awaiting', () => {
        const read = bettingRead('resolved')
        const view = positions({ ...read, result: { status: 'awaiting', outcome: null, refunded: false, reason: null, payout_state: null } }, DECIDED)
        expect(view.kind).toBe('awaiting')
        expect(view.groups.flatMap(rowsOf).every(row => row.tone === null && row.profit === null)).toBe(true)
    })
})

describe('bettingView full-width groups', () => {
    it('names every bettor on every outcome, draw included, in the order served', () => {
        const read = bettingMarketRead('29/2/2', 'closed')
        const view = positions(read)
        expect(view.groups.map(entry => [entry.side, entry.name, entry.columns.length])).toEqual([['a', 'Crimson Cats', 2], ['draw', 'Draw', 1], ['b', 'Azure Owls', 1]])
        for (const side of ['a', 'draw', 'b'] as const) {
            expect(rowsOf(group(view, side)).map(row => row.userId)).toEqual(read.sides![side]!.backers.map(backer => backer.user_id))
        }
        expect(view.fit).toEqual({ rowHeight: 44, columnWidth: 428, avatarZoom: false, primary: 22, secondary: 19, chip: 15 })
        expect(group(view, 'draw').meta).toBe('Odds 14.29 · 2 bettors · 950 staked')
    })

    it('fills each group column by column, as evenly as the rows allow', () => {
        const view = positions(bettingMarketRead('29/2/2', 'closed'))
        expect(group(view, 'a').columns.map(column => column.length)).toEqual([15, 14])
    })

    it('drops the draw group on a two-way market', () => {
        expect(positions(bettingMarketRead('80/7', 'closed')).groups.map(entry => entry.side)).toEqual(['a', 'b'])
        expect(positions(bettingRead('closed')).groups.map(entry => entry.side)).toEqual(['a', 'b'])
    })

    it('folds the lowest potential payouts into "+N more" only past the floor', () => {
        const read = bettingMarketRead('80/7', 'closed')
        const view = positions(read)
        const a = group(view, 'a')
        expect(view.fit.rowHeight).toBe(30)
        expect(a.columns.map(column => column.length)).toEqual([22, 22, 22])
        expect(rowsOf(a)).toHaveLength(65)
        const hidden = read.sides!.a.backers.slice(65)
        expect(notesOf(a)).toEqual([`+ 15 more · ${coins(hidden.reduce((sum, backer) => sum + backer.stake, 0))} staked`])
        expect(notesOf(group(view, 'b'))).toEqual([])
        expect(view.cells.multiplier).toBeNull()
    })

    it('keeps the biggest bet on screen when the fold would cut it', () => {
        const read = bettingMarketRead('80/7', 'closed')
        const backers = read.sides!.a.backers.map((backer, index) => ({ ...backer, biggest: index === 79 }))
        const b = { ...read.sides!.b, backers: read.sides!.b.backers.map(backer => ({ ...backer, biggest: false })) }
        const view = positions({ ...read, sides: { ...read.sides!, a: { ...read.sides!.a, backers }, b } })
        const rows = rowsOf(group(view, 'a'))
        expect(rows).toHaveLength(65)
        expect(rows[64]).toMatchObject({ userId: backers[79].user_id, biggest: true })
        expect(rows.slice(0, 64).map(row => row.userId)).toEqual(backers.slice(0, 64).map(backer => backer.user_id))
    })

    it('marks exactly the flagged backer as the biggest bet and shows the legend', () => {
        const view = positions(bettingMarketRead('29/2/2', 'closed'))
        expect(view.groups.flatMap(rowsOf).filter(row => row.biggest)).toHaveLength(1)
        expect(view.legend).toBe(true)
    })

    it('hides the legend when nobody is flagged', () => {
        const read = bettingRead('closed')
        const b = { ...read.sides!.b, backers: read.sides!.b.backers.map(backer => ({ ...backer, biggest: false })) }
        expect(positions({ ...read, sides: { ...read.sides!, b } }).legend).toBe(false)
    })

    it('keeps a column for an outcome nobody backed', () => {
        const read = bettingMarketRead('29/2/2', 'closed')
        const view = positions({ ...read, sides: { ...read.sides!, draw: { ...read.sides!.draw!, count: 0, stake: 0, backers: [] } } })
        expect(group(view, 'draw').columns).toEqual([[{ kind: 'note', text: 'No bettors on this outcome' }]])
    })

    it.each(['21/6/4', '80/7'] as const)('keeps every row in place until the result, then moves only the losing groups (%s)', shape => {
        const order = [
            positions(bettingMarketRead(shape, 'closed')),
            positions(bettingMarketRead(shape, 'closed'), DECIDED),
            positions(bettingMarketRead(shape, 'resolved')),
            positions(bettingMarketRead(shape, 'settled')),
        ]
        expect(order.map(view => view.kind)).toEqual(['closed', 'awaiting', 'paying-out', 'settled'])
        expect(names(order[1])).toEqual(names(order[0]))
        for (const view of order.slice(1)) {
            expect(view.fit.rowHeight).toBe(order[0].fit.rowHeight)
            expect(names(view)[0]).toEqual(names(order[0])[0])
        }
    })

    function withRisingStakes(read: BettingRead): BettingRead {
        const backers = read.sides!.b.backers.map((backer, index) => ({ ...backer, stake: 100 * (index + 1) }))
        return { ...read, sides: { ...read.sides!, b: { ...read.sides!.b, backers } } }
    }

    it('lists a losing group by stake, biggest first, once the result is in', () => {
        const read = withRisingStakes(bettingMarketRead('21/6/4', 'settled'))
        const view = positions(read)
        expect(view.groups.map(entry => entry.verdict)).toEqual(['won', 'lost', 'lost'])
        expect(rowsOf(group(view, 'b')).map(row => row.userId)).toEqual([...read.sides!.b.backers].reverse().map(backer => backer.user_id))
        expect(rowsOf(group(view, 'a')).map(row => row.userId)).toEqual(read.sides!.a.backers.map(backer => backer.user_id))
    })

    it('keeps the served payout order before the result is official', () => {
        const read = withRisingStakes(bettingMarketRead('21/6/4', 'closed'))
        const view = positions(read, DECIDED)
        expect(rowsOf(group(view, 'b')).map(row => row.userId)).toEqual(read.sides!.b.backers.map(backer => backer.user_id))
    })

    it('lights the draw and dims both teams when the draw wins', () => {
        const view = positions(bettingMarketRead('14/11/3', 'settled', 'draw'))
        expect(view.status.text).toBe('Draw · all payouts paid')
        expect(view.groups.map(entry => entry.verdict)).toEqual(['lost', 'won', 'lost'])
        expect(rowsOf(group(view, 'draw')).every(row => row.tone === 'won' && row.payoutChip === 'Paid')).toBe(true)
        expect(view.fit).toMatchObject({ rowHeight: 44, columnWidth: 576, avatarZoom: true })
    })

    it('sizes each number column from the longest value in the whole scene', () => {
        const locked = positions(bettingRead('closed'))
        expect(locked.cells).toEqual({ stake: 48, payout: 55, multiplier: 48, profit: 0, chip: 0 })
        const result = positions(bettingRead('resolved'))
        expect(result.cells).toEqual({ stake: 48, payout: 48, multiplier: null, profit: 66, chip: 69 })
        expect(positions(bettingRead('voided')).cells).toMatchObject({ profit: 54, chip: 78 })
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
