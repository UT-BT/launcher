import { describe, expect, it } from 'vitest'
import { STREAM_SCENES, streamSceneObsName } from '@/app/components/stream/streamScenes'
import { countWord } from '@/app/utils/wording'
import { GUIDE_STEPS, guideStepIds } from './guideSteps'

describe('guide steps', () => {
    it('has unique ids', () => {
        const ids = guideStepIds()
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('covers the steps in order', () => {
        expect(guideStepIds()).toEqual([
            'requirements', 'kit', 'import', 'encoder', 'stream-key', 'dock',
            'cams', 'scene-urls', 'running', 'audio-levels', 'out-of-date', 'troubleshooting',
        ])
    })

    it('marks the cam steps as desktop only', () => {
        expect(GUIDE_STEPS.filter(step => step.desktopOnly).map(step => step.id)).toEqual(['cams'])
    })

    it('names the exact cam window titles', () => {
        const cams = JSON.stringify(GUIDE_STEPS.find(step => step.id === 'cams'))
        for (const title of ['UTBT Cam A1', 'UTBT Cam A2', 'UTBT Cam B1', 'UTBT Cam B2']) expect(cams).toContain(title)
    })

    it('has no servers step', () => {
        expect(guideStepIds()).not.toContain('servers')
        expect(JSON.stringify(GUIDE_STEPS)).not.toMatch(/!spec|!utbt_spec|Auto Spectate/)
    })

    it('teaches the audio levels with the kit presets', () => {
        const audio = JSON.stringify(GUIDE_STEPS.find(step => step.id === 'audio-levels'))
        for (const preset of ['−15 dB', '0 dB', '−6 dB', 'ducks', 'Limiters', 'Leave the filters alone', 'turn the cams down', 'turn Discord up', 'mic fader']) expect(audio).toContain(preset)
    })

    it('names every registered scene by its OBS name, in registry order, with their count', () => {
        const names = STREAM_SCENES.map(streamSceneObsName)
        const all = JSON.stringify(GUIDE_STEPS)
        expect(all).toContain(`scenes: ${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}.`)
        expect(all).toContain(`The collection has ${countWord(STREAM_SCENES.length)} scenes: `)
        expect(all).toContain(`each of your ${countWord(STREAM_SCENES.length)} scenes`)
    })

    it('calls the overlay scene Match, as the imported collection does', () => {
        expect(JSON.stringify(GUIDE_STEPS)).toContain('Betting, Match, Intermission')
    })

    it('names the current tabs', () => {
        const all = JSON.stringify(GUIDE_STEPS)
        expect(all).not.toMatch(/eleven|Show panel|Channel panel|Kit panel|Scenes panel|Cams panel|Match panel/)
        expect(all).toContain('120 fps')
    })
})
