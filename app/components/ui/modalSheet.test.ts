import { describe, expect, it } from 'vitest'
import { sheetBounds } from './modalSheet'

const PORTRAIT = { scale: 1, offsetLeft: 0, offsetTop: 0, pageLeft: 0, pageTop: 0, width: 390, height: 664 }

describe('sheetBounds', () => {
    it('fills the visible area of an unzoomed phone', () => {
        expect(sheetBounds(PORTRAIT)).toEqual({ top: 0, height: 664 })
    })

    it('shrinks above the keyboard and follows the visible area when the browser pans it', () => {
        expect(sheetBounds({ ...PORTRAIT, offsetTop: 212, pageTop: 212, height: 352 })).toEqual({ top: 212, height: 352 })
    })

    it('treats a scale within rounding of 1 as unzoomed', () => {
        expect(sheetBounds({ ...PORTRAIT, scale: 1.0004, height: 663.7 })).toEqual({ top: 0, height: 663.7 })
    })

    it('leaves a pinch-zoomed page to the layout viewport', () => {
        expect(sheetBounds({ ...PORTRAIT, scale: 2, offsetTop: 150, width: 195, height: 332 })).toBeNull()
    })
})
