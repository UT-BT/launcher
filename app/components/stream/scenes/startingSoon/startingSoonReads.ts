import { streamMatchReadPath } from '../../data/streamHotState'
import type { StreamFeed } from '../../ticker/streamFeed'

export type BettingReadState = 'not_enabled' | 'no_market' | 'open' | 'closed' | 'resolved' | 'settled' | 'voided'

export interface BettingSidePrice {
    price: number
    odds: number
}

export interface StartingSoonBetting {
    state: BettingReadState
    market: { pool: number; predictions: number } | null
    sides: { a: BettingSidePrice; b: BettingSidePrice; draw: BettingSidePrice | null } | null
}

export type StartingSoonFeed = Pick<StreamFeed, 'results' | 'upcoming'>

export function bettingReadPath(eventSlug: string, matchId: string): string {
    return streamMatchReadPath(eventSlug, matchId, 'betting')
}
