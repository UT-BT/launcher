import { describe, expect, it } from 'vitest'
import { streamHotState, streamMatch } from '../../data/streamFixtures'
import { CASTER_CUTOUT, casterView } from './casterView'

const desk = (webcam_enabled: boolean) => ({ brb_message: null, webcam_enabled })

describe('casterView', () => {
    it('pins the cutout to the rectangle the kit uses', () => {
        expect(CASTER_CUTOUT).toEqual({ x: 96, y: 184, width: 1152, height: 648 })
    })

    it('shows the webcam frame when the toggle is on', () => {
        expect(casterView(streamHotState({ desk: desk(true) })).webcam).toBe(true)
    })

    it('hides the webcam frame when the toggle is off', () => {
        expect(casterView(streamHotState({ desk: desk(false) })).webcam).toBe(false)
    })

    it('has no webcam without a state', () => {
        expect(casterView(null).webcam).toBe(false)
    })

    it('lists casters picked from users and typed as free text', () => {
        const match = streamMatch({
            casters: [
                { id: '1000200030004000', display_name: 'Ada', avatar: null },
                { id: null, display_name: 'Guest Caster', avatar: null },
            ],
        })
        expect(casterView(streamHotState({ match })).casters).toEqual([
            { key: '1000200030004000', userId: '1000200030004000', name: 'Ada' },
            { key: 'text-1', userId: null, name: 'Guest Caster' },
        ])
    })

    it('drops casters without a name', () => {
        const match = streamMatch({
            casters: [
                { id: null, display_name: '  ', avatar: null },
                { id: null, display_name: null, avatar: null },
                { id: '1000200030004000', display_name: null, avatar: null },
            ],
        })
        expect(casterView(streamHotState({ match })).casters).toEqual([])
    })

    it('has no casters and no score without a match', () => {
        const view = casterView(streamHotState({ reason: 'none', match: null }))
        expect(view.casters).toEqual([])
        expect(view.score).toBeNull()
    })

    it('carries the series score of the match', () => {
        expect(casterView(streamHotState()).score?.a.name).toBe('Crimson Cats')
    })
})
