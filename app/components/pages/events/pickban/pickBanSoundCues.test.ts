import { describe, expect, it } from 'vitest'
import type { PickBanState } from '@/app/utils/api'
import { cuesToPlay } from './pickBanSoundCues'
import {
    ELIGIBLE_MAPS,
    locked,
    lockedInTurn,
    paused,
    resumed,
    started,
    undone,
    unlockAt,
} from './pickBanFixtures'

const [ALPHA, BRAVO, CHARLIE, DELTA, ECHO, FOXTROT] = ELIGIBLE_MAPS

function cuesAt(state: PickBanState, now: number, played: ReadonlySet<string> = new Set()) {
    return cuesToPlay(state, { clockOffsetMs: 0, now }, played)
}

function primedPlayed(state: PickBanState, now: number): ReadonlySet<string> {
    return cuesAt(state, now).played
}

function ms(value: string | null): number {
    return Date.parse(value ?? '')
}

describe('cuesToPlay', () => {
    it('fires nothing before any step has revealed', () => {
        const state = started()
        const result = cuesAt(state, unlockAt(state) - 1)
        expect(result.cues).toEqual([])
    })

    it('fires a ban cue exactly at a lettered ban’s reveal_at, not before', () => {
        const state = locked(started(), ALPHA, unlockAt(started()) + 2_000)
        const revealAt = ms(state.plan[0].reveal_at)

        const before = cuesAt(state, revealAt - 1)
        expect(before.cues).toEqual([])

        const at = cuesAt(state, revealAt, before.played)
        expect(at.cues).toEqual([{ key: `0:${state.plan[0].reveal_at}`, kind: 'ban' }])
    })

    it('fires a lock-in cue for a pick and a decider cue for the automatic decider', () => {
        const complete = lockedInTurn(started(), [ALPHA, BRAVO, CHARLIE, DELTA, ECHO, FOXTROT])
        const result = cuesAt(complete, unlockAt(complete) + 1)
        const kindOf = (index: number) => result.cues.find((cue) => cue.key.startsWith(`${index}:`))?.kind

        expect(kindOf(2)).toBe('lock_in')
        expect(kindOf(6)).toBe('decider')
    })

    it('never replays a cue on a refresh, remount or 304 that keeps the same reveal_at', () => {
        const state = locked(started(), ALPHA, unlockAt(started()) + 2_000)
        const revealAt = ms(state.plan[0].reveal_at)

        const played = primedPlayed(state, revealAt - 500)
        const first = cuesAt(state, revealAt + 10, played)
        expect(first.cues).toHaveLength(1)

        const second = cuesAt(state, revealAt + 5_000, first.played)
        expect(second.cues).toEqual([])

        const third = cuesAt(state, revealAt + 5_000, second.played)
        expect(third.cues).toEqual([])
    })

    it('marks steps already revealed at load as played, without sounding', () => {
        const state = lockedInTurn(started(), [ALPHA, BRAVO])
        const loadTime = unlockAt(state) + 1

        const primed = primedPlayed(state, loadTime)
        const next = cuesAt(state, loadTime + 1, primed)

        expect(next.cues).toEqual([])
    })

    it('plays again for a new lock at the same plan index after an undo', () => {
        const firstLock = locked(started(), ALPHA, unlockAt(started()) + 2_000)
        const firstRevealAt = ms(firstLock.plan[0].reveal_at)
        const played = cuesAt(firstLock, firstRevealAt + 10).played

        const afterUndo = undone(firstLock, firstRevealAt + 5_000)
        const stillPlayed = cuesAt(afterUndo, firstRevealAt + 5_100, played)
        expect(stillPlayed.cues).toEqual([])

        const relocked = locked(afterUndo, BRAVO, firstRevealAt + 6_000)
        const secondRevealAt = ms(relocked.plan[0].reveal_at)
        const before = cuesAt(relocked, secondRevealAt - 1, stillPlayed.played)
        expect(before.cues).toEqual([])

        const after = cuesAt(relocked, secondRevealAt + 1, before.played)
        expect(after.cues).toEqual([{ key: `0:${relocked.plan[0].reveal_at}`, kind: 'ban' }])
    })

    it('never sounds an undone step, even once its old reveal_at has since passed', () => {
        const firstLock = locked(started(), ALPHA, unlockAt(started()) + 2_000)
        const firstRevealAt = ms(firstLock.plan[0].reveal_at)
        const afterUndo = undone(firstLock, firstRevealAt + 1_000)

        const result = cuesAt(afterUndo, firstRevealAt + 10_000)
        expect(result.cues).toEqual([])
    })

    it('waits for the decider’s own delayed reveal, not the preceding ban’s', () => {
        const beforeDecider = lockedInTurn(started(), [ALPHA, BRAVO, CHARLIE, DELTA, ECHO, FOXTROT])
        const lastBan = beforeDecider.plan[5]
        const deciderStep = beforeDecider.plan[6]
        const lastBanRevealAt = ms(lastBan.reveal_at)
        const deciderRevealAt = ms(deciderStep.reveal_at)
        expect(deciderRevealAt).toBeGreaterThan(lastBanRevealAt)

        const played = primedPlayed(beforeDecider, lastBanRevealAt - 500)
        const atBanReveal = cuesAt(beforeDecider, lastBanRevealAt + 10, played)
        expect(atBanReveal.cues.map((cue) => cue.kind)).toEqual(['ban'])

        const beforeDeciderReveal = cuesAt(beforeDecider, deciderRevealAt - 1, atBanReveal.played)
        expect(beforeDeciderReveal.cues).toEqual([])

        const atDeciderReveal = cuesAt(beforeDecider, deciderRevealAt + 1, beforeDeciderReveal.played)
        expect(atDeciderReveal.cues).toEqual([{ key: `6:${deciderStep.reveal_at}`, kind: 'decider' }])
    })

    it('freezes the reveal gate while paused, and honours the shifted reveal_at after resume', () => {
        const state = locked(started(), ALPHA, unlockAt(started()) + 2_000)
        const revealAt = ms(state.plan[0].reveal_at)
        const pausedState = paused(state, revealAt - 200)

        const stillFrozen = cuesAt(pausedState, revealAt + 60_000)
        expect(stillFrozen.cues).toEqual([])

        const resumedState = resumed(pausedState, revealAt + 60_000)
        const shiftedRevealAt = ms(resumedState.plan[0].reveal_at)
        expect(shiftedRevealAt).toBeGreaterThan(revealAt)

        const beforeShifted = cuesAt(resumedState, shiftedRevealAt - 1, stillFrozen.played)
        expect(beforeShifted.cues).toEqual([])

        const afterShifted = cuesAt(resumedState, shiftedRevealAt + 1, beforeShifted.played)
        expect(afterShifted.cues).toHaveLength(1)
    })
})
