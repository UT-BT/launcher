import { describe, expect, it } from 'vitest'
import { streamSidesFixture } from '@/app/utils/fixtures/streamSidesFixtures'
import {
    PROJECTED_NOTE, pendingChipLabel, pendingChipTitle, showsProjectedNote,
} from './leaderboardView'

describe('leaderboard view helpers', () => {
    const board = streamSidesFixture('leaderboard')

    it('gives a Pending chip to exactly the pending rows', () => {
        expect(board.items.map(row => pendingChipLabel(row))).toEqual(
            board.items.map(row => (row.pending ? 'Pending' : null)),
        )
        expect(board.items.filter(row => pendingChipLabel(row) !== null)).toHaveLength(3)
    })

    it('says how many payouts a chip is waiting for', () => {
        expect(pendingChipTitle(board.items[0])).toBe('1 payout pending')
        expect(pendingChipTitle(board.items[2])).toBe('2 payouts pending')
        expect(pendingChipTitle(board.items[1])).toBeNull()
    })

    it('shows the note while the board is projected and something is pending', () => {
        expect(PROJECTED_NOTE).toBe('Projected — payouts pending')
        expect(showsProjectedNote(board)).toBe(true)
    })

    it('hides the note once nothing is pending', () => {
        const settled = { ...board, items: board.items.map(row => ({ ...row, pending: false, pending_count: 0 })) }
        expect(showsProjectedNote(settled)).toBe(false)
    })

    it('hides the note when the board is not projected', () => {
        expect(showsProjectedNote({ ...board, projected: false })).toBe(false)
        expect(showsProjectedNote({ items: board.items })).toBe(false)
    })
})
