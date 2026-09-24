import { describe, expect, it } from 'vitest'
import { matchSubtitle } from './pickBanCopy'
import type { PickBanMatchHeading } from './pickBanView'

function heading(overrides: Partial<PickBanMatchHeading> = {}): PickBanMatchHeading {
    return { title: 'Nocturne vs Photon', stageName: 'Playoffs', roundLabel: 'Round 2', bestOf: 5, ...overrides }
}

describe('matchSubtitle', () => {
    it('joins the stage, round and best-of with a middle dot', () => {
        expect(matchSubtitle(heading())).toBe('Playoffs · Round 2 · Best of 5')
    })

    it('drops a missing round label instead of leaving an empty segment', () => {
        expect(matchSubtitle(heading({ roundLabel: null }))).toBe('Playoffs · Best of 5')
    })
})
