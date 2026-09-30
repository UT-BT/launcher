import type { RawActiveTitle } from '@/app/utils/api'
import { streamMatchReadPath } from '../../data/streamHotState'

export type BettingState = 'not_enabled' | 'no_market' | 'open' | 'closed' | 'resolved' | 'settled' | 'voided'
export type BettingMarketStatus = 'open' | 'closed' | 'resolved' | 'settled' | 'voided'
export type BettingOutcome = 'won' | 'lost' | 'refunded'
export type BettingPayoutState = 'pending' | 'paid'
export type BettingResultOutcome = 'a' | 'b' | 'draw' | 'void'

export interface BettingMarket {
    status: BettingMarketStatus
    draws_allowed: boolean
    pool: number
    predictions: number
    closes_at: string | null
    closed_at: string | null
    resolved_at: string | null
    settles_at: string | null
    settled_at: string | null
}

export interface BettingBacker {
    user_id: string
    display_name: string | null
    avatar: string | null
    title: RawActiveTitle | null
    stake: number
    payout: number
    multiplier: number
    biggest: boolean
    outcome: BettingOutcome | null
    profit: number | null
    payout_state: BettingPayoutState | null
}

export interface BettingSide {
    team: { id: string; name: string } | null
    price: number
    odds: number
    count: number | null
    stake: number | null
    backers: BettingBacker[]
}

export interface BettingSides {
    a: BettingSide
    b: BettingSide
    draw: BettingSide | null
}

export interface BettingResult {
    status: 'awaiting' | 'official' | 'voided'
    outcome: BettingResultOutcome | null
    refunded: boolean
    reason: string | null
    payout_state: BettingPayoutState | null
}

export interface BettingLeaderboardRow {
    rank: number
    user_id: string
    display_name: string | null
    avatar: string | null
    title: RawActiveTitle | null
    net_worth: number
    profit: number
    bets_placed: number
    positions_won: number
    positions_lost: number
    positions_refunded: number
}

export interface BettingRead {
    server_now: string
    match_id: string
    state: BettingState
    market: BettingMarket | null
    positions_visible: boolean
    sides: BettingSides | null
    result: BettingResult | null
    leaderboard: BettingLeaderboardRow[]
}

export function bettingReadPath(eventSlug: string, matchId: string): string {
    return streamMatchReadPath(eventSlug, matchId, 'betting')
}
