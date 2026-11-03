import { describe, expect, it } from 'vitest'
import { MAX_ZOOM, UNZOOMED, clampZoom, panZoom, pinchZoom, toggleZoom } from './screenshotZoom'

const FRAME = { width: 400, height: 300 }

describe('clampZoom', () => {
    it('keeps the unzoomed screenshot where it is', () => {
        expect(clampZoom({ scale: 1, x: 30, y: -20 }, FRAME)).toEqual(UNZOOMED)
    })

    it('never zooms out below the frame or in past the maximum', () => {
        expect(clampZoom({ scale: 0.5, x: 0, y: 0 }, FRAME).scale).toBe(1)
        expect(clampZoom({ scale: 10, x: 0, y: 0 }, FRAME).scale).toBe(MAX_ZOOM)
    })

    it('keeps the zoomed screenshot covering the frame', () => {
        expect(clampZoom({ scale: 2, x: 50, y: 40 }, FRAME)).toEqual({ scale: 2, x: 0, y: 0 })
        expect(clampZoom({ scale: 2, x: -900, y: -900 }, FRAME)).toEqual({ scale: 2, x: -400, y: -300 })
        expect(clampZoom({ scale: 2, x: -100, y: -50 }, FRAME)).toEqual({ scale: 2, x: -100, y: -50 })
    })
})

describe('pinchZoom', () => {
    it('scales by how far the fingers spread', () => {
        const zoomed = pinchZoom(
            UNZOOMED,
            [{ x: 150, y: 150 }, { x: 250, y: 150 }],
            [{ x: 100, y: 150 }, { x: 300, y: 150 }],
            FRAME,
        )
        expect(zoomed.scale).toBe(2)
    })

    it('keeps the point between the fingers under the fingers', () => {
        const zoomed = pinchZoom(
            UNZOOMED,
            [{ x: 90, y: 60 }, { x: 110, y: 60 }],
            [{ x: 80, y: 60 }, { x: 120, y: 60 }],
            FRAME,
        )
        expect(zoomed).toEqual({ scale: 2, x: -100, y: -60 })
    })

    it('follows the fingers when they move together', () => {
        const start = { scale: 2, x: -200, y: -150 }
        const moved = pinchZoom(
            start,
            [{ x: 100, y: 100 }, { x: 200, y: 100 }],
            [{ x: 130, y: 120 }, { x: 230, y: 120 }],
            FRAME,
        )
        expect(moved).toEqual({ scale: 2, x: -170, y: -130 })
    })

    it('stops at the frame when pinched closed', () => {
        const start = { scale: 2, x: -200, y: -150 }
        const closed = pinchZoom(
            start,
            [{ x: 100, y: 100 }, { x: 300, y: 100 }],
            [{ x: 180, y: 100 }, { x: 220, y: 100 }],
            FRAME,
        )
        expect(closed).toEqual(UNZOOMED)
    })

    it('ignores fingers that start on the same spot', () => {
        const start = { scale: 2, x: -200, y: -150 }
        expect(pinchZoom(start, [{ x: 10, y: 10 }, { x: 10, y: 10 }], [{ x: 0, y: 0 }, { x: 50, y: 50 }], FRAME)).toEqual(start)
    })
})

describe('panZoom', () => {
    it('moves a zoomed screenshot with the finger', () => {
        const start = { scale: 2, x: -200, y: -150 }
        expect(panZoom(start, { x: 100, y: 100 }, { x: 60, y: 130 }, FRAME)).toEqual({ scale: 2, x: -240, y: -120 })
    })

    it('does not move an unzoomed screenshot', () => {
        expect(panZoom(UNZOOMED, { x: 100, y: 100 }, { x: 160, y: 40 }, FRAME)).toEqual(UNZOOMED)
    })
})

describe('toggleZoom', () => {
    it('zooms in on the tapped point', () => {
        expect(toggleZoom(UNZOOMED, { x: 100, y: 60 }, FRAME)).toEqual({ scale: 2.5, x: -150, y: -90 })
    })

    it('zooms back out when already zoomed', () => {
        expect(toggleZoom({ scale: 1.2, x: -10, y: -10 }, { x: 100, y: 60 }, FRAME)).toEqual(UNZOOMED)
    })
})
