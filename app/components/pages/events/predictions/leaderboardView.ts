import type { PredictionLeaderboard, PredictionLeaderboardRow } from '@/app/utils/api'

export const PROJECTED_NOTE = 'Projected — payouts pending'

export function showsProjectedNote(board: Pick<PredictionLeaderboard, 'projected' | 'items'>): boolean {
    return board.projected === true && board.items.some(row => row.pending)
}

export function pendingChipLabel(row: Pick<PredictionLeaderboardRow, 'pending'>): string | null {
    return row.pending ? 'Pending' : null
}

export function pendingChipTitle(row: Pick<PredictionLeaderboardRow, 'pending' | 'pending_count'>): string | null {
    if (!row.pending) return null
    return row.pending_count === 1 ? '1 payout pending' : `${row.pending_count} payouts pending`
}
