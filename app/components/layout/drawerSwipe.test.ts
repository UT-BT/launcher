import { describe, expect, it } from 'vitest'
import { closesDrawer, drawerDragOffset, FLING_WINDOW_MS, releaseVelocity, swipeAxis } from './drawerSwipe'

describe('swipeAxis', () => {
    it('stays undecided inside the slop', () => {
        expect(swipeAxis(-6, 5)).toBe('undecided')
    })

    it('locks horizontal when the drag moves more sideways than up or down', () => {
        expect(swipeAxis(-14, 6)).toBe('horizontal')
        expect(swipeAxis(14, -6)).toBe('horizontal')
    })

    it('locks vertical when the drag moves more up or down, so the drawer list scrolls', () => {
        expect(swipeAxis(-8, 14)).toBe('vertical')
        expect(swipeAxis(10, 10)).toBe('vertical')
    })
})

describe('drawerDragOffset', () => {
    it('follows a drag to the left', () => {
        expect(drawerDragOffset(-120, 288)).toBe(-120)
    })

    it('never moves the drawer right of its open position', () => {
        expect(drawerDragOffset(40, 288)).toBe(0)
    })

    it('stops at the drawer width', () => {
        expect(drawerDragOffset(-500, 288)).toBe(-288)
    })
})

describe('closesDrawer', () => {
    it('closes once the drawer is dragged a third of its width', () => {
        expect(closesDrawer(-96, 288, 0)).toBe(true)
    })

    it('springs back from a short slow drag', () => {
        expect(closesDrawer(-60, 288, -0.1)).toBe(false)
    })

    it('closes on a quick fling to the left, however short', () => {
        expect(closesDrawer(-30, 288, -0.8)).toBe(true)
    })

    it('stays open when the drag ends moving back to the right', () => {
        expect(closesDrawer(-60, 288, 0.8)).toBe(false)
    })

    it('stays open when the drawer is back at its open position', () => {
        expect(closesDrawer(0, 288, -0.8)).toBe(false)
    })
})

describe('releaseVelocity', () => {
    it('keeps the speed of a finger lifted while still moving', () => {
        expect(releaseVelocity(-0.8, 16)).toBe(-0.8)
        expect(releaseVelocity(-0.8, FLING_WINDOW_MS)).toBe(-0.8)
    })

    it('drops to zero once the finger has held still before lifting', () => {
        expect(releaseVelocity(-0.8, FLING_WINDOW_MS + 1)).toBe(0)
        expect(closesDrawer(-30, 288, releaseVelocity(-0.8, 300))).toBe(false)
    })
})
