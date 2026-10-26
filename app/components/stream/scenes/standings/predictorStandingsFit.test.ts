import { describe, expect, it } from 'vitest'
import { STANDINGS_BOX, STANDINGS_HEAD_GAP, STANDINGS_HEAD_HEIGHT, standingsFit } from './predictorStandingsFit'

describe('standingsFit', () => {
    it('fits 52 predictors in 3 columns of 44 px rows, with no fold', () => {
        expect(standingsFit(52, STANDINGS_BOX)).toEqual({
            rowHeight: 44,
            columns: 3,
            perColumn: 18,
            shown: 52,
            more: 0,
            columnWidth: 1744 / 3,
        })
    })

    it('fits 120 predictors at the 30 px floor in 4 columns of 26, folding the last 17 into one slot', () => {
        expect(standingsFit(120, STANDINGS_BOX)).toEqual({
            rowHeight: 30,
            columns: 4,
            perColumn: 26,
            shown: 103,
            more: 17,
            columnWidth: 430,
        })
    })

    it.each([
        [1, 44, 3],
        [54, 44, 3],
        [55, 44, 4],
        [72, 44, 4],
        [73, 40, 4],
        [76, 40, 4],
        [77, 36, 4],
        [88, 36, 4],
        [89, 33, 4],
        [96, 33, 4],
        [97, 30, 4],
        [104, 30, 4],
    ])('fits %i predictors at %i px in %i columns without folding', (count, rowHeight, columns) => {
        const fit = standingsFit(count, STANDINGS_BOX)
        expect(fit).toMatchObject({ rowHeight, columns, shown: count, more: 0 })
        expect(fit.columns * fit.perColumn).toBeGreaterThanOrEqual(count)
    })

    it('folds only past the floor', () => {
        expect(standingsFit(105, STANDINGS_BOX)).toMatchObject({ rowHeight: 30, columns: 4, shown: 103, more: 2 })
    })

    it('keeps every row inside the box, heads included', () => {
        for (const count of [1, 52, 54, 72, 76, 88, 96, 104, 120, 400]) {
            const fit = standingsFit(count, STANDINGS_BOX)
            const slots = fit.shown + (fit.more > 0 ? 1 : 0)
            expect(Math.ceil(slots / fit.columns)).toBeLessThanOrEqual(fit.perColumn)
            expect(STANDINGS_HEAD_HEIGHT + STANDINGS_HEAD_GAP + fit.perColumn * fit.rowHeight).toBeLessThanOrEqual(STANDINGS_BOX.height)
        }
    })

    it('takes 3 columns for an empty board', () => {
        expect(standingsFit(0, STANDINGS_BOX)).toMatchObject({ rowHeight: 44, columns: 3, shown: 0, more: 0 })
    })
})
