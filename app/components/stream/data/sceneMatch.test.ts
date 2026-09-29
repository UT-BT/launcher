import { describe, expect, it } from 'vitest'
import { idleHotState, streamHotState, streamMatch } from './streamFixtures'
import { sceneMatchOf } from './sceneMatch'

describe('sceneMatchOf', () => {
    it('waits while the first read is in flight', () => {
        expect(sceneMatchOf({ state: null, loading: true }).phase).toBe('loading')
    })

    it('shows the resolved match for every reason but none', () => {
        for (const reason of ['current', 'live', 'holding-finished', 'next'] as const) {
            const state = streamHotState({ reason, match: streamMatch({ reason }) })
            expect(sceneMatchOf({ state, loading: false }), reason).toEqual({ phase: 'match', state, match: state.match })
        }
    })

    it('is idle when the resolver found nothing', () => {
        const state = idleHotState()
        expect(sceneMatchOf({ state, loading: false })).toEqual({ phase: 'idle', state, match: null })
    })

    it('is idle when the first read failed, so the page never looks broken', () => {
        expect(sceneMatchOf({ state: null, loading: false })).toEqual({ phase: 'idle', state: null, match: null })
    })
})
