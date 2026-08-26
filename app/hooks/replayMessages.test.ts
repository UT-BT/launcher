import { describe, expect, it } from 'vitest'
import {
    REPLAY_CONVERTING_MESSAGE,
    REPLAY_ERROR_MESSAGE,
    REPLAY_UNAVAILABLE_MESSAGE,
    replayErrorMessage,
} from './replayMessages'

describe('replay failure messages', () => {
    it('only claims a run is still processing when the pipeline says so', () => {
        expect(replayErrorMessage('converting')).toBe(REPLAY_CONVERTING_MESSAGE)
        expect(replayErrorMessage('unavailable')).not.toBe(REPLAY_CONVERTING_MESSAGE)
        expect(replayErrorMessage('error')).not.toBe(REPLAY_CONVERTING_MESSAGE)
    })

    it('tells the truth about a run that has no demo at all', () => {
        expect(replayErrorMessage('unavailable')).toBe(REPLAY_UNAVAILABLE_MESSAGE)
    })

    it('separates a transport failure from a missing replay', () => {
        expect(replayErrorMessage('error')).toBe(REPLAY_ERROR_MESSAGE)
        expect(REPLAY_ERROR_MESSAGE).not.toBe(REPLAY_UNAVAILABLE_MESSAGE)
    })

    it('never mentions the conversion pipeline outside the converting case', () => {
        for (const state of ['unavailable', 'error'] as const) {
            expect(replayErrorMessage(state).toLowerCase()).not.toContain('processed')
            expect(replayErrorMessage(state).toLowerCase()).not.toContain('converting')
        }
    })
})
