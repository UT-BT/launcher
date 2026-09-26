import { describe, expect, it } from 'vitest'
import { boardLayout } from './boardLayout'

describe('boardLayout', () => {
    it('lays a twelve-map pool out in two rows of six', () => {
        expect(boardLayout(12, 1792, 600, 20, 320)).toEqual({ columns: 6, rows: 2, tile: 282 })
    })

    it('never grows a tile past the cap, and keeps the fewest columns that reach it', () => {
        expect(boardLayout(5, 1792, 600, 20, 320)).toEqual({ columns: 5, rows: 1, tile: 320 })
    })

    it('adds a third row once two rows would shrink the tiles more', () => {
        const layout = boardLayout(21, 1792, 600, 20, 320)
        expect(layout.rows).toBe(3)
        expect(layout.columns * layout.rows).toBeGreaterThanOrEqual(21)
    })

    it('fits a single map', () => {
        expect(boardLayout(1, 1792, 600, 20, 320)).toEqual({ columns: 1, rows: 1, tile: 320 })
    })

    it('returns an empty layout for an empty pool', () => {
        expect(boardLayout(0, 1792, 600, 20, 320).tile).toBe(0)
    })
})
