import { describe, expect, it } from 'vitest'
import { guideStepFromHash, guideStepHash, toggleStep, withStepOpen } from './guideDeepLink'
import { guideStepIds } from './guideSteps'

describe('guide deep links', () => {
    it('round-trips every step id through its hash', () => {
        for (const id of guideStepIds()) expect(guideStepFromHash(guideStepHash(id))).toBe(id)
    })

    it('ignores unknown, empty and foreign hashes', () => {
        expect(guideStepFromHash('')).toBeNull()
        expect(guideStepFromHash('#')).toBeNull()
        expect(guideStepFromHash('#guide-nope')).toBeNull()
        expect(guideStepFromHash('#cams')).toBeNull()
    })

    it('toggles a step in and out of the open list', () => {
        expect(toggleStep([], 'kit')).toEqual(['kit'])
        expect(toggleStep(['kit', 'dock'], 'kit')).toEqual(['dock'])
    })

    it('opening a step that is already open changes nothing', () => {
        const open = ['kit']
        expect(withStepOpen(open, 'kit')).toBe(open)
        expect(withStepOpen(open, 'dock')).toEqual(['kit', 'dock'])
    })
})
