import { describe, expect, it } from 'vitest'
import { IDLE_PULL, PULL_TRIGGER_PX, pullArmed, pullBlocker, pullMoved, pullOffset, pullTriggers, type PullGesture, type PullPathStep, type PullStart } from './pullGesture'

const TOUCH_AT_TOP: PullStart = { pointerType: 'touch', primary: true, scrollTop: 0, scrollLocks: 0 }

interface StepParts {
    touchAction: string
    overflowX: string
    overflowY: string
    scrollWidth: number
    clientWidth: number
    scrollHeight: number
    clientHeight: number
    scrollTop: number
    rangeInput: boolean
}

function step(overrides: Partial<StepParts> = {}): PullPathStep {
    const parts: StepParts = {
        touchAction: 'auto',
        overflowX: 'visible',
        overflowY: 'visible',
        scrollWidth: 300,
        clientWidth: 300,
        scrollHeight: 40,
        clientHeight: 40,
        scrollTop: 0,
        rangeInput: false,
        ...overrides,
    }
    return {
        box: { scrollWidth: parts.scrollWidth, clientWidth: parts.clientWidth, scrollHeight: parts.scrollHeight, clientHeight: parts.clientHeight, scrollTop: parts.scrollTop },
        style: { touchAction: parts.touchAction, overflowX: parts.overflowX, overflowY: parts.overflowY },
        rangeInput: parts.rangeInput,
    }
}

describe('pullBlocker', () => {
    it('lets a touch start a pull at the top of the shell scroller with nothing in the way', () => {
        expect(pullBlocker(TOUCH_AT_TOP, [step(), step()])).toBeNull()
    })

    it('ignores a mouse, a pen and a second finger', () => {
        expect(pullBlocker({ ...TOUCH_AT_TOP, pointerType: 'mouse' }, [])).toBe('not-touch')
        expect(pullBlocker({ ...TOUCH_AT_TOP, pointerType: 'pen' }, [])).toBe('not-touch')
        expect(pullBlocker({ ...TOUCH_AT_TOP, primary: false }, [])).toBe('not-touch')
    })

    it('stays off once the shell scroller has left its top', () => {
        expect(pullBlocker({ ...TOUCH_AT_TOP, scrollTop: 1 }, [])).toBe('scrolled')
        expect(pullBlocker({ ...TOUCH_AT_TOP, scrollTop: 640 }, [])).toBe('scrolled')
        expect(pullBlocker({ ...TOUCH_AT_TOP, scrollTop: 0.4 }, [])).toBeNull()
    })

    it('stays off while an overlay holds the scroll lock', () => {
        expect(pullBlocker({ ...TOUCH_AT_TOP, scrollLocks: 1 }, [])).toBe('overlay')
        expect(pullBlocker({ ...TOUCH_AT_TOP, scrollLocks: 2 }, [])).toBe('overlay')
    })

    it('stays off when the drag starts inside a box that scrolls sideways', () => {
        const strip = step({ overflowX: 'auto', scrollWidth: 900, clientWidth: 360 })
        expect(pullBlocker(TOUCH_AT_TOP, [step(), strip, step()])).toBe('horizontal-scroller')
        expect(pullBlocker(TOUCH_AT_TOP, [step({ overflowX: 'scroll', scrollWidth: 361, clientWidth: 359 })])).toBe('horizontal-scroller')
    })

    it('starts inside a sideways box that has nothing to scroll or clips its overflow', () => {
        expect(pullBlocker(TOUCH_AT_TOP, [step({ overflowX: 'auto', scrollWidth: 360, clientWidth: 360 })])).toBeNull()
        expect(pullBlocker(TOUCH_AT_TOP, [step({ overflowX: 'hidden', scrollWidth: 900, clientWidth: 360 })])).toBeNull()
    })

    it('stays off when the drag starts on a control that takes its own touch drags, such as a scrubber or a slider', () => {
        expect(pullBlocker(TOUCH_AT_TOP, [step({ touchAction: 'none' }), step()])).toBe('touch-control')
        expect(pullBlocker(TOUCH_AT_TOP, [step(), step({ touchAction: 'pan-x' })])).toBe('touch-control')
        expect(pullBlocker(TOUCH_AT_TOP, [step({ touchAction: 'pinch-zoom' })])).toBe('touch-control')
        expect(pullBlocker(TOUCH_AT_TOP, [step({ rangeInput: true })])).toBe('touch-control')
    })

    it('starts on elements that leave vertical panning to the browser', () => {
        for (const touchAction of ['auto', 'manipulation', 'pan-y', 'pan-x pan-y', 'pan-up', 'pan-x pan-up pinch-zoom']) {
            expect(pullBlocker(TOUCH_AT_TOP, [step({ touchAction })]), touchAction).toBeNull()
        }
    })

    it('stays off when the drag starts inside an inner list that is scrolled down, so the drag scrolls that list back up', () => {
        const list = { overflowY: 'auto', scrollHeight: 800, clientHeight: 300 }
        expect(pullBlocker(TOUCH_AT_TOP, [step(), step({ ...list, scrollTop: 120 })])).toBe('inner-scroller')
        expect(pullBlocker(TOUCH_AT_TOP, [step(), step({ ...list, scrollTop: 0 })])).toBeNull()
    })
})

function dragged(moves: Array<[number, number]>, pointerId = 1): PullGesture {
    return moves.reduce((gesture, [x, y]) => pullMoved(gesture, pointerId, { x, y }), pullArmed(1, { x: 100, y: 200 }))
}

describe('the pull gesture', () => {
    it('becomes a pull when the finger first moves down, and follows the finger from where it landed', () => {
        expect(dragged([[100, 203]])).toMatchObject({ phase: 'pulling', distance: 3 })
        expect(dragged([[100, 203], [104, 260]])).toMatchObject({ phase: 'pulling', distance: 60 })
    })

    it('waits for a move that goes somewhere before it decides', () => {
        expect(dragged([[100, 200]])).toMatchObject({ phase: 'armed' })
        expect(dragged([[100, 200], [101, 204]])).toMatchObject({ phase: 'pulling', distance: 4 })
    })

    it('lets the browser have a drag that first moves up or sideways', () => {
        expect(dragged([[100, 197]])).toBe(IDLE_PULL)
        expect(dragged([[106, 203]])).toBe(IDLE_PULL)
        expect(dragged([[100, 197], [100, 300]])).toBe(IDLE_PULL)
    })

    it('shrinks back to nothing when the finger returns above where it landed, without letting go of the pull', () => {
        expect(dragged([[100, 260], [100, 150]])).toMatchObject({ phase: 'pulling', distance: 0 })
        expect(dragged([[100, 260], [100, 150], [100, 230]])).toMatchObject({ phase: 'pulling', distance: 30 })
    })

    it('follows only the finger that started it', () => {
        const pulling = dragged([[100, 240]])
        expect(pullMoved(pulling, 2, { x: 100, y: 400 })).toBe(pulling)
    })

    it('refreshes on release at about 70 px of pull and not before', () => {
        expect(PULL_TRIGGER_PX).toBe(70)
        expect(pullTriggers(dragged([[100, 269]]))).toBe(false)
        expect(pullTriggers(dragged([[100, 270]]))).toBe(true)
        expect(pullTriggers(dragged([[100, 420]]))).toBe(true)
        expect(pullTriggers(dragged([[100, 300], [100, 240]]))).toBe(false)
    })

    it('never refreshes from a drag that was not a pull', () => {
        expect(pullTriggers(IDLE_PULL)).toBe(false)
        expect(pullTriggers(dragged([[100, 200]]))).toBe(false)
        expect(pullTriggers(dragged([[100, 190], [100, 400]]))).toBe(false)
    })
})

describe('pullOffset', () => {
    it('moves the indicator slower than the finger and stops it at twice the trigger distance', () => {
        expect(pullOffset(0)).toBe(0)
        expect(pullOffset(35)).toBe(21)
        expect(pullOffset(70)).toBe(42)
        expect(pullOffset(140)).toBe(84)
        expect(pullOffset(400)).toBe(84)
    })
})
