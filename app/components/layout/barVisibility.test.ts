import { describe, expect, it } from 'vitest'
import { barsAfterInput, barsAfterScroll, barsShownAt, type BarVisibility } from './barVisibility'

const MAX = 4000

function userScroll(tops: number[], from: BarVisibility = barsShownAt(0)) {
    let state = from
    let now = 1000
    for (const top of tops) {
        state = barsAfterInput(state, now)
        state = barsAfterScroll(state, { top, max: MAX, now: now + 16 })
        now += 32
    }
    return state
}

function codeScroll(tops: number[], from: BarVisibility, now = 1_000_000) {
    return tops.reduce((state, top) => barsAfterScroll(state, { top, max: MAX, now }), from)
}

const hidden = () => userScroll([200, 600])

describe('barsAfterScroll', () => {
    it('hides the bars once the user scrolls down past the threshold', () => {
        expect(userScroll([10, 40, 120]).visible).toBe(false)
    })

    it('ignores small jitters in either direction', () => {
        expect(userScroll([510, 504, 512, 506], barsShownAt(500)).visible).toBe(true)
        expect(userScroll([590, 596, 588], hidden()).visible).toBe(false)
    })

    it('measures a scroll down from the highest point reached while shown', () => {
        expect(userScroll([450, 400, 410], barsShownAt(500)).visible).toBe(true)
        expect(userScroll([450, 400, 430], barsShownAt(500)).visible).toBe(false)
    })

    it('brings the bars back once the user scrolls up past the threshold', () => {
        expect(userScroll([570], hidden()).visible).toBe(true)
    })

    it('measures a scroll up from the lowest point reached while hidden', () => {
        expect(userScroll([900, 1200, 1190], hidden()).visible).toBe(false)
        expect(userScroll([900, 1200, 1170], hidden()).visible).toBe(true)
    })

    it('shows the bars at the top of the page, even when code scrolled there', () => {
        expect(codeScroll([0], hidden()).visible).toBe(true)
        expect(userScroll([12], hidden()).visible).toBe(true)
    })

    it('shows the bars when an overscroll bounce pulls the page past its top', () => {
        expect(userScroll([-30], hidden()).visible).toBe(true)
    })

    it('keeps the bars hidden while an overscroll bounce settles back from past the bottom', () => {
        const atBottom = userScroll([MAX], hidden())
        expect(userScroll([MAX + 60, MAX + 20, MAX], atBottom).visible).toBe(false)
    })

    it('leaves the bars alone when code scrolls the page, such as a scroll restore', () => {
        expect(codeScroll([0, 800, 1500], barsShownAt(0)).visible).toBe(true)
        expect(codeScroll([300, 200], hidden()).visible).toBe(false)
    })

    it('measures the next user scroll from where code left the page', () => {
        const restored = codeScroll([1500], barsShownAt(0))
        expect(userScroll([1510], restored).visible).toBe(true)
        expect(userScroll([1540], restored).visible).toBe(false)
    })

    it('ignores a late scroll event that does not move the page', () => {
        const nudged = userScroll([510], barsShownAt(500))
        const late = codeScroll([510], nudged)
        expect(userScroll([520], late).visible).toBe(false)
    })

    it('counts a scroll as the user\'s only shortly after their input', () => {
        const touched = barsAfterInput(barsShownAt(0), 1000)
        expect(barsAfterScroll(touched, { top: 600, max: MAX, now: 1200 }).visible).toBe(false)
        expect(barsAfterScroll(touched, { top: 600, max: MAX, now: 1400 }).visible).toBe(true)
    })

    it('follows a fling that keeps scrolling after the finger lifts', () => {
        let state = barsAfterInput(barsShownAt(0), 0)
        for (let frame = 1; frame <= 120; frame += 1) {
            state = barsAfterScroll(state, { top: frame * 4, max: MAX, now: frame * 16 })
        }
        expect(state.visible).toBe(false)
        for (let frame = 121; frame <= 240; frame += 1) {
            state = barsAfterScroll(state, { top: 480 - (frame - 120) * 3, max: MAX, now: frame * 16 })
        }
        expect(state.visible).toBe(true)
    })
})

describe('barsShownAt', () => {
    it('shows the bars and measures from the given position', () => {
        const shown = barsShownAt(800)
        expect(shown.visible).toBe(true)
        expect(userScroll([812], shown).visible).toBe(true)
        expect(userScroll([830], shown).visible).toBe(false)
    })
})
