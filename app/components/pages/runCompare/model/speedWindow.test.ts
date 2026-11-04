import { describe, expect, it } from 'vitest'
import { MIN_ZOOM_MS, type SpeedZoom } from '@/app/components/pages/capDetail/runDelta/speedZoom'
import { canZoomIn, followSpanMs, followStep, resizedWindow, runMsOf, shiftedWindow, windowAround, zoomStep } from './speedWindow'

const PAIR = 'a|b'
const DURATION = 24000

function zoom(startMs: number, endMs: number): SpeedZoom {
    return { pair: PAIR, startMs, endMs, sector: null }
}

describe('the speed window', () => {
    it('follows with a sector-long window, kept between two and eight seconds, or the zoom it already has', () => {
        expect(followSpanMs(null, DURATION)).toBe(2400)
        expect(followSpanMs(null, 10000)).toBe(2000)
        expect(followSpanMs(null, 120000)).toBe(8000)
        expect(followSpanMs(null, 1500)).toBe(1500)
        expect(followSpanMs(zoom(1000, 4500), DURATION)).toBe(3500)
    })

    it('centres a window on a moment and keeps it inside the run', () => {
        expect(windowAround(PAIR, 10000, 4000, DURATION)).toEqual(zoom(8000, 12000))
        expect(windowAround(PAIR, 500, 4000, DURATION)).toEqual(zoom(0, 4000))
        expect(windowAround(PAIR, 23900, 4000, DURATION)).toEqual(zoom(20000, 24000))
    })

    it('zooms in around the playhead from the whole run, then halves or doubles around the window\'s middle', () => {
        const first = zoomStep(PAIR, null, 'in', 6000, DURATION)

        expect(first).toEqual(zoom(0, 12000))
        expect(zoomStep(PAIR, zoom(8000, 12000), 'in', 0, DURATION)).toEqual(zoom(9000, 11000))
        expect(zoomStep(PAIR, zoom(8000, 12000), 'out', 0, DURATION)).toEqual(zoom(6000, 14000))
        expect(zoomStep(PAIR, zoom(0, 12000), 'out', 0, DURATION)).toBeNull()
        expect(zoomStep(PAIR, zoom(9000, 10500), 'in', 0, DURATION)).toEqual(zoom(9250, 10250))
    })

    it('stops zooming in at the smallest window', () => {
        expect(canZoomIn(null, DURATION)).toBe(true)
        expect(canZoomIn(zoom(0, MIN_ZOOM_MS), DURATION)).toBe(false)
        expect(canZoomIn(null, MIN_ZOOM_MS)).toBe(false)
    })

    it('drags a window without changing its length, and resizes it from either edge', () => {
        expect(shiftedWindow(zoom(4000, 8000), 3000, DURATION)).toEqual(zoom(7000, 11000))
        expect(shiftedWindow(zoom(4000, 8000), -9000, DURATION)).toEqual(zoom(0, 4000))
        expect(resizedWindow(zoom(4000, 8000), 'start', 2000, DURATION)).toEqual(zoom(2000, 8000))
        expect(resizedWindow(zoom(4000, 8000), 'end', 30000, DURATION)).toEqual(zoom(4000, 24000))
        expect(resizedWindow(zoom(4000, 8000), 'start', 7900, DURATION)).toEqual(zoom(7000, 8000))
    })

    it('reads the playhead on the baseline\'s own clock, in steps', () => {
        const state = { playing: true, t: 3, end: 24, rate: 1, stalled: [], frozen: [], errored: [], runTimes: { b: 2.5 }, cue: null }

        expect(runMsOf(state, 'b')).toBe(2500)
        expect(runMsOf(state, 'c')).toBe(3000)
        expect(followStep(2524)).toBe(2500)
        expect(followStep(2526)).toBe(2550)
    })
})
