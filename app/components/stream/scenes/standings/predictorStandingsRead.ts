import type { RawActiveTitle } from '@/app/utils/api'
import { streamApiPath, streamMatchReadPath } from '../../data/streamHotState'
import type { BettingMarketStatus } from '../betting/bettingRead'

export type PredictorFocusOutcome = 'a' | 'b' | 'draw' | 'void'

export interface PredictorFocusMarket {
    market_id: string
    status: BettingMarketStatus
    outcome: PredictorFocusOutcome | null
    movement: boolean
}

export interface PredictorStandingsRow {
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
    pending: boolean
    pending_count: number
    movement: number | null
    new: boolean
}

export interface PredictorStandings {
    server_now: string
    any_pending: boolean
    focus_market: PredictorFocusMarket | null
    total: number
    items: PredictorStandingsRow[]
}

export function predictorStandingsReadPath(eventSlug: string, matchId: string | null): string {
    return matchId === null
        ? streamApiPath(eventSlug, '/predictor-standings')
        : streamMatchReadPath(eventSlug, matchId, 'predictor-standings')
}
