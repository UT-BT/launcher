import type { RawActiveTitle } from '@/app/utils/api'
import type {
    BettingBacker,
    BettingLeaderboardRow,
    BettingMarket,
    BettingRead,
    BettingResult,
    BettingSide,
    BettingSides,
    BettingState,
} from './bettingRead'
import { STREAM_MATCH_ID, STREAM_T0, streamIso } from '../../data/streamFixtures'

const MINUTE = 60_000

const ORACLE: RawActiveTitle = { name: 'Oracle', rarity: 3, color_r: 52, color_g: 211, color_b: 153 }

const PLAYERS = {
    harbinger: ['310000000000000001', 'Harbinger'],
    nimbus: ['310000000000000002', 'Nimbus'],
    tessel: ['310000000000000003', 'Tessel'],
    quokka: ['310000000000000004', 'Quokka'],
    lumen: ['310000000000000005', 'Lumen'],
    ferrum: ['310000000000000006', 'Ferrum'],
    pogo: ['310000000000000007', 'Pogo'],
    moth: ['310000000000000008', 'Moth'],
    rook: ['310000000000000009', 'Rook'],
    wisp: ['310000000000000010', 'Wisp'],
    fennel: ['310000000000000011', 'Fennel'],
    sable: ['310000000000000012', 'Sable'],
} as const

export type BettingPlayer = keyof typeof PLAYERS

export function bettingBacker(player: BettingPlayer, stake: number, payout: number, overrides: Partial<BettingBacker> = {}): BettingBacker {
    const [userId, name] = PLAYERS[player]
    return {
        user_id: userId,
        display_name: name,
        avatar: `https://example.test/users/${userId}/avatar`,
        title: player === 'harbinger' ? ORACLE : null,
        stake,
        payout,
        multiplier: Math.round((payout / stake) * 100) / 100,
        biggest: false,
        outcome: null,
        profit: null,
        payout_state: null,
        ...overrides,
    }
}

const BACKERS_A: BettingBacker[] = [
    bettingBacker('nimbus', 1500, 2610),
    bettingBacker('quokka', 800, 1408),
    bettingBacker('ferrum', 500, 845),
    bettingBacker('lumen', 250, 440),
    bettingBacker('pogo', 100, 181),
    bettingBacker('fennel', 90, 160),
]

const BACKERS_B: BettingBacker[] = [
    bettingBacker('harbinger', 3000, 7350, { biggest: true }),
    bettingBacker('tessel', 1000, 2290),
    bettingBacker('moth', 600, 1452),
    bettingBacker('rook', 300, 693),
    bettingBacker('wisp', 150, 348),
    bettingBacker('sable', 120, 280),
]

export function bettingSide(name: string | null, price: number, overrides: Partial<BettingSide> = {}): BettingSide {
    return {
        team: name === null ? null : { id: `team-${name.toLowerCase().replace(/\s+/g, '-')}`, name },
        price,
        odds: Math.round((1 / price) * 100) / 100,
        count: null,
        stake: null,
        backers: [],
        ...overrides,
    }
}

function withOutcome(backers: BettingBacker[], outcome: BettingBacker['outcome'], payoutState: BettingBacker['payout_state']): BettingBacker[] {
    return backers.map(backer => ({
        ...backer,
        outcome,
        profit: outcome === 'won' ? backer.payout - backer.stake : outcome === 'lost' ? -backer.stake : 0,
        payout_state: outcome === 'lost' ? null : payoutState,
    }))
}

export function bettingLeaderboard(after = false): BettingLeaderboardRow[] {
    const rows: [BettingPlayer, number, number, number][] = after
        ? [['harbinger', 15420, 31, 14], ['nimbus', 14015, 29, 11], ['tessel', 8310, 22, 14], ['quokka', 8248, 26, 16], ['lumen', 5405, 20, 11]]
        : [['harbinger', 18420, 31, 13], ['nimbus', 12905, 28, 11], ['tessel', 9310, 22, 13], ['quokka', 7640, 25, 16], ['lumen', 5215, 19, 11]]
    return rows.map(([player, profit, won, lost], index) => {
        const [userId, name] = PLAYERS[player]
        return {
            rank: index + 1,
            user_id: userId,
            display_name: name,
            avatar: `https://example.test/users/${userId}/avatar`,
            title: player === 'harbinger' ? ORACLE : null,
            net_worth: 10_000 + profit,
            profit,
            bets_placed: won + lost + 2,
            positions_won: won,
            positions_lost: lost,
            positions_refunded: 2,
        }
    })
}

const TIMES: Record<BettingState, Partial<BettingMarket>> = {
    not_enabled: {},
    no_market: {},
    open: {},
    closed: { closed_at: streamIso(STREAM_T0 - 30 * MINUTE) },
    resolved: { closed_at: streamIso(STREAM_T0 - 90 * MINUTE), resolved_at: streamIso(STREAM_T0 - 10 * MINUTE), settles_at: streamIso(STREAM_T0 + 170 * MINUTE) },
    settled: { closed_at: streamIso(STREAM_T0 - 300 * MINUTE), resolved_at: streamIso(STREAM_T0 - 240 * MINUTE), settles_at: streamIso(STREAM_T0 - 60 * MINUTE), settled_at: streamIso(STREAM_T0 - 58 * MINUTE) },
    voided: { closed_at: streamIso(STREAM_T0 - 30 * MINUTE), settled_at: streamIso(STREAM_T0 - 20 * MINUTE) },
}

function market(state: BettingState): BettingMarket | null {
    if (state === 'not_enabled' || state === 'no_market') return null
    return {
        status: state,
        draws_allowed: false,
        pool: 14_750,
        predictions: 164,
        closes_at: streamIso(STREAM_T0 + 80 * MINUTE),
        closed_at: null,
        resolved_at: null,
        settles_at: null,
        settled_at: null,
        ...TIMES[state],
    }
}

function sides(state: BettingState): BettingSides | null {
    if (state === 'not_enabled' || state === 'no_market') return null
    if (state === 'open') return { a: bettingSide('Crimson Cats', 0.58), b: bettingSide('Azure Owls', 0.42), draw: null }
    const decided = state === 'resolved' || state === 'settled'
    const payoutState = state === 'resolved' ? 'pending' : 'paid'
    const a = state === 'voided' ? withOutcome(BACKERS_A, 'refunded', 'paid') : decided ? withOutcome(BACKERS_A, 'won', payoutState) : BACKERS_A
    const b = state === 'voided' ? withOutcome(BACKERS_B, 'refunded', 'paid') : decided ? withOutcome(BACKERS_B, 'lost', null) : BACKERS_B
    return {
        a: bettingSide('Crimson Cats', 0.58, { count: 66, stake: 6_420, backers: a }),
        b: bettingSide('Azure Owls', 0.42, { count: 98, stake: 8_330, backers: b }),
        draw: null,
    }
}

function result(state: BettingState): BettingResult | null {
    if (state === 'not_enabled' || state === 'no_market') return null
    if (state === 'voided') return { status: 'voided', outcome: 'void', refunded: true, reason: 'The match was cancelled', payout_state: 'paid' }
    if (state === 'resolved' || state === 'settled') {
        return { status: 'official', outcome: 'a', refunded: false, reason: null, payout_state: state === 'resolved' ? 'pending' : 'paid' }
    }
    return { status: 'awaiting', outcome: null, refunded: false, reason: null, payout_state: null }
}

export function bettingRead(state: BettingState, overrides: Partial<BettingRead> = {}): BettingRead {
    return {
        server_now: streamIso(STREAM_T0),
        match_id: STREAM_MATCH_ID,
        state,
        market: market(state),
        positions_visible: state !== 'open' && market(state) !== null,
        sides: sides(state),
        result: result(state),
        leaderboard: state === 'not_enabled' ? [] : bettingLeaderboard(state === 'resolved' || state === 'settled'),
        ...overrides,
    }
}
