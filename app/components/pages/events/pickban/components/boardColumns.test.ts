import { describe, expect, it } from 'vitest'
import { balancedColumns, boardColumnVars } from './boardColumns'

describe('balancedColumns', () => {
    it('keeps one row when the pool fits under the cap', () => {
        expect(balancedColumns(5, 7)).toBe(5)
    })

    it('splits a pool over the cap into rows that differ by at most one tile', () => {
        expect(balancedColumns(13, 7)).toBe(7)
        expect(balancedColumns(13, 5)).toBe(5)
        expect(balancedColumns(8, 7)).toBe(4)
    })

    it('never uses more columns than the cap', () => {
        for (let count = 1; count <= 30; count += 1) {
            for (const cap of [3, 4, 5, 6, 7, 8]) expect(balancedColumns(count, cap)).toBeLessThanOrEqual(cap)
        }
    })

    it('gives an empty pool one column', () => {
        expect(balancedColumns(0, 5)).toBe(1)
    })
})

describe('boardColumnVars', () => {
    it('sets one column and row count per container breakpoint, widest last', () => {
        expect(boardColumnVars(13)).toEqual({
            '--cols-0': 3, '--rows-0': 5,
            '--cols-1': 4, '--rows-1': 4,
            '--cols-2': 5, '--rows-2': 3,
            '--cols-3': 5, '--rows-3': 3,
            '--cols-4': 7, '--rows-4': 2,
            '--cols-5': 7, '--rows-5': 2,
        })
    })
})
