import { describe, expect, it } from 'vitest'
import { GUIDE_STEPS, guideStepIds } from './guideSteps'

describe('guide steps', () => {
    it('has unique ids', () => {
        const ids = guideStepIds()
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('covers the twelve steps in order', () => {
        expect(guideStepIds()).toEqual([
            'requirements', 'kit', 'import', 'encoder', 'stream-key', 'dock',
            'cams', 'scene-urls', 'running', 'servers', 'out-of-date', 'troubleshooting',
        ])
    })

    it('marks the cam steps as desktop only', () => {
        expect(GUIDE_STEPS.filter(step => step.desktopOnly).map(step => step.id)).toEqual(['cams', 'servers'])
    })

    it('names the exact cam window titles', () => {
        const cams = JSON.stringify(GUIDE_STEPS.find(step => step.id === 'cams'))
        for (const title of ['UTBT Cam A1', 'UTBT Cam A2', 'UTBT Cam B1', 'UTBT Cam B2']) expect(cams).toContain(title)
    })
})
