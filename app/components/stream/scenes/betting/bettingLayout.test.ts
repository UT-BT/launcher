import { describe, expect, it } from 'vitest'
import { bettingLayout, columnMajor } from './bettingLayout'

function shape(counts: number[]) {
    const layout = bettingLayout(counts)
    return {
        rowHeight: layout.rowHeight,
        columns: layout.groups.map(group => group.columns),
        shown: layout.groups.map(group => group.shown),
        more: layout.groups.map(group => group.more),
    }
}

describe('bettingLayout', () => {
    it.each([
        [[29, 2, 2], 44, [2, 1, 1]],
        [[21, 6, 4], 44, [2, 1, 1]],
        [[14, 11, 3], 44, [1, 1, 1]],
        [[33, 4, 5], 36, [2, 1, 1]],
        [[40, 3, 2], 33, [2, 1, 1]],
        [[25, 8], 44, [2, 1]],
        [[60, 20], 33, [3, 1]],
    ])('fits %j at %i px rows in %j columns with nobody folded', (counts, rowHeight, columns) => {
        expect(shape(counts)).toEqual({ rowHeight, columns, shown: counts, more: counts.map(() => 0) })
    })

    it('folds the 80-on-one-side two-way market past the 30 px floor', () => {
        expect(shape([80, 7])).toEqual({ rowHeight: 30, columns: [3, 1], shown: [65, 7], more: [15, 0] })
    })

    it('folds a three-way side that can only take two columns past the floor', () => {
        expect(shape([45, 5, 3])).toEqual({ rowHeight: 30, columns: [2, 1, 1], shown: [43, 5, 3], more: [2, 0, 0] })
    })

    it('keeps one column for an outcome nobody backed', () => {
        expect(shape([12, 0, 3])).toEqual({ rowHeight: 44, columns: [1, 1, 1], shown: [12, 0, 3], more: [0, 0, 0] })
    })

    it('gives every column the same width from the column and group count', () => {
        expect(bettingLayout([29, 2, 2]).columnWidth).toBe(428)
        expect(bettingLayout([12, 8]).columnWidth).toBe(880)
        expect(bettingLayout([14, 11, 3]).columnWidth).toBe(576)
        expect(bettingLayout([60, 20]).columnWidth).toBe(432)
    })

    it('zooms the avatar only in roomy rows of wide columns', () => {
        expect(bettingLayout([14, 11, 3]).avatarZoom).toBe(true)
        expect(bettingLayout([29, 2, 2]).avatarZoom).toBe(false)
        expect(bettingLayout([60, 20]).avatarZoom).toBe(false)
    })

    it('drops the multiplier at 33 px rows and below', () => {
        expect(bettingLayout([33, 4, 5]).density).toMatchObject({ primary: 21, secondary: 18, chip: 14, multiplier: true })
        expect(bettingLayout([40, 3, 2]).density).toMatchObject({ primary: 20, secondary: 18, chip: 14, multiplier: false })
        expect(bettingLayout([80, 7]).density).toMatchObject({ primary: 20, secondary: 17, chip: 14, multiplier: false })
    })

    it('shrinks the rows sooner in a shorter box', () => {
        const layout = bettingLayout([14, 11, 3], { width: 1792, height: 600 })
        expect([layout.rowHeight, layout.groups.map(group => group.columns)]).toEqual([40, [2, 1, 1]])
    })
})

describe('columnMajor', () => {
    it('fills columns top to bottom, as evenly as the slots allow', () => {
        expect(columnMajor([1, 2, 3, 4, 5], 2)).toEqual([[1, 2, 3], [4, 5]])
        expect(columnMajor([1, 2], 1)).toEqual([[1, 2]])
        expect(columnMajor([], 1)).toEqual([[]])
    })
})
