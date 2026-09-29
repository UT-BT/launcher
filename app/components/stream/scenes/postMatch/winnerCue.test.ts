import { describe, expect, it } from 'vitest'
import { WINNER_CUE_START, winnerCueStep, type WinnerCueMemory, type WinnerCueSight } from './winnerCue'

function run(sights: WinnerCueSight[], memory: WinnerCueMemory = WINNER_CUE_START): boolean[] {
    const plays: boolean[] = []
    for (const sight of sights) {
        const step = winnerCueStep(memory, sight)
        memory = step.memory
        plays.push(step.play)
    }
    return plays
}

const live = (decided: boolean, active = true, matchId = 'match-1'): WinnerCueSight => ({ matchId, decided, active })

describe('winnerCueStep', () => {
    it('fires once when the winner first appears while the scene is running', () => {
        expect(run([live(false), live(false), live(true), live(true), live(true)])).toEqual([false, false, true, false, false])
    })

    it('never fires for a winner that was already there on load', () => {
        expect(run([live(true), live(true), live(false), live(true)])).toEqual([false, false, false, false])
    })

    it('does not fire again when a correction reopens and re-decides the match', () => {
        expect(run([live(false), live(true), live(false), live(true)])).toEqual([false, true, false, false])
    })

    it('waits until the source is on program when the winner lands while it is hidden', () => {
        expect(run([live(false, false), live(true, false), live(true, false), live(true, true), live(true, true)])).toEqual([
            false, false, false, true, false,
        ])
    })

    it('never fires on a source that stays hidden', () => {
        expect(run([live(false, false), live(true, false), live(true, false)])).toEqual([false, false, false])
    })

    it('starts over for another match, treating its first sight as the baseline', () => {
        expect(run([live(false), live(true), live(true, true, 'match-2'), live(false, true, 'match-3'), live(true, true, 'match-3')])).toEqual([
            false, true, false, false, true,
        ])
    })

    it('stays quiet when the same sight is replayed, as a StrictMode double effect does', () => {
        const first = winnerCueStep(WINNER_CUE_START, live(true))
        const again = winnerCueStep(first.memory, live(true))

        expect([first.play, again.play]).toEqual([false, false])
    })
})
