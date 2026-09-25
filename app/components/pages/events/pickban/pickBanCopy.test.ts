import { describe, expect, it } from 'vitest'
import { introCountdownWords, matchSubtitle } from './pickBanCopy'
import type { PickBanMatchHeading } from './pickBanView'

function heading(overrides: Partial<PickBanMatchHeading> = {}): PickBanMatchHeading {
    return { title: 'Nocturne vs Photon', stageName: 'Playoffs', roundLabel: 'Round 2', bestOf: 5, ...overrides }
}

describe('introCountdownWords', () => {
    it('counts the whole seconds left in words, rounding a part second up', () => {
        expect(introCountdownWords(5_000)).toBe('5 seconds until Picks & Bans start…')
        expect(introCountdownWords(4_001)).toBe('5 seconds until Picks & Bans start…')
        expect(introCountdownWords(2_000)).toBe('2 seconds until Picks & Bans start…')
    })

    it('says second, not seconds, for the last one', () => {
        expect(introCountdownWords(1_000)).toBe('1 second until Picks & Bans start…')
        expect(introCountdownWords(1)).toBe('1 second until Picks & Bans start…')
    })

    it('says picks and bans are starting once the countdown reaches zero', () => {
        expect(introCountdownWords(0)).toBe('Picks & Bans are starting…')
    })
})

describe('matchSubtitle', () => {
    it('joins the stage, round and best-of with a middle dot', () => {
        expect(matchSubtitle(heading())).toBe('Playoffs · Round 2 · Best of 5')
    })

    it('drops a missing round label instead of leaving an empty segment', () => {
        expect(matchSubtitle(heading({ roundLabel: null }))).toBe('Playoffs · Best of 5')
    })
})
