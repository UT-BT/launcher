import type { EventMatch, EventMatchStatus, MatchPickBanStatus, MyPickBanSession, PredictionMarket } from '@/app/utils/api'

export interface MatchLockSignal {
    status?: EventMatchStatus | null
    pick_ban_status?: MatchPickBanStatus | null
}

const BETTABLE_MATCH_STATUSES: readonly EventMatchStatus[] = ['pending', 'scheduled']

const LOCKING_PICK_BAN_STATUSES: readonly MatchPickBanStatus[] = ['running', 'paused', 'complete']

export function matchLocksBets(match: MatchLockSignal | null | undefined): boolean {
    if (!match) return false
    if (match.status && !BETTABLE_MATCH_STATUSES.includes(match.status)) return true

    return !!match.pick_ban_status && LOCKING_PICK_BAN_STATUSES.includes(match.pick_ban_status)
}

export function marketTakesPredictions(market: PredictionMarket, match?: MatchLockSignal | null): boolean {
    return market.status === 'open' && !matchLocksBets(market.match) && !matchLocksBets(match)
}

export function lockStartedMarkets(markets: PredictionMarket[], signals: ReadonlyMap<string, MatchLockSignal>): PredictionMarket[] {
    return markets.map(market => {
        if (market.status !== 'open') return market

        const signal = market.match_id ? signals.get(market.match_id) : undefined

        return marketTakesPredictions(market, signal) ? market : { ...market, status: 'closed' }
    })
}

export function matchLockSignals(
    matches: Iterable<Pick<EventMatch, 'id' | 'status' | 'pick_ban_status'>>,
    session: MyPickBanSession | null,
): Map<string, MatchLockSignal> {
    const signals = new Map<string, MatchLockSignal>()

    for (const match of matches) {
        signals.set(match.id, { status: match.status, pick_ban_status: match.pick_ban_status })
    }

    if (session) {
        signals.set(session.match_id, { ...signals.get(session.match_id), pick_ban_status: session.status })
    }

    return signals
}

export function newlyLockedMatchIds(
    previous: ReadonlyMap<string, MatchLockSignal>,
    next: ReadonlyMap<string, MatchLockSignal>,
): string[] {
    const locked: string[] = []

    for (const [matchId, signal] of next) {
        if (previous.has(matchId) && !matchLocksBets(previous.get(matchId)) && matchLocksBets(signal)) locked.push(matchId)
    }

    return locked
}
