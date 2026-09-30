import { describe, expect, it } from 'vitest'
import {
    STREAM_SCENES,
    isStreamSceneId,
    isTransparentStreamScene,
    parseStreamScenePath,
    streamScenePath,
    streamSceneUrl,
    type StreamSceneId,
} from './streamScenes'

const SCENE_IDS: StreamSceneId[] = [
    'starting-soon',
    'preview',
    'pick-ban',
    'betting',
    'overlay',
    'intermission',
    'next-map',
    'post-match',
    'standings',
    'brb',
    'ending',
    'caster',
]

describe('STREAM_SCENES', () => {
    it('lists the twelve scene ids in order, each with a display label', () => {
        expect(STREAM_SCENES.map(scene => scene.id)).toEqual(SCENE_IDS)
        for (const scene of STREAM_SCENES) {
            expect(scene.label.trim().length).toBeGreaterThan(0)
        }
    })

    it('gives every scene a distinct label', () => {
        const labels = STREAM_SCENES.map(scene => scene.label)
        expect(new Set(labels).size).toBe(labels.length)
    })
})

describe('isStreamSceneId', () => {
    it.each(SCENE_IDS)('accepts %s', id => {
        expect(isStreamSceneId(id)).toBe(true)
    })

    it('rejects anything else', () => {
        for (const value of ['', 'Overlay', 'pickban', 'stream', 'toString', 'constructor']) {
            expect(isStreamSceneId(value)).toBe(false)
        }
    })
})

describe('isTransparentStreamScene', () => {
    it('is on for the overlay and the caster cam, whose pages show OBS sources underneath', () => {
        expect(SCENE_IDS.filter(isTransparentStreamScene)).toEqual(['overlay', 'caster'])
    })

    it('is off for an unknown scene', () => {
        expect(isTransparentStreamScene('scoreboard')).toBe(false)
    })
})

describe('parseStreamScenePath', () => {
    it.each(SCENE_IDS)('accepts the %s scene', id => {
        expect(parseStreamScenePath(`/stream/2v2-cup-2026/228152236587483136/${id}`)).toEqual({
            eventSlug: '2v2-cup-2026',
            streamerId: '228152236587483136',
            scene: id,
        })
    })

    it('hands an unknown scene id back so the stream root can say so', () => {
        expect(parseStreamScenePath('/stream/2v2-cup-2026/42/scoreboard')).toEqual({
            eventSlug: '2v2-cup-2026',
            streamerId: '42',
            scene: 'scoreboard',
        })
    })

    it('decodes the slug and the streamer id', () => {
        expect(parseStreamScenePath('/stream/groups%20a/id%2Fwith%20slash/overlay')).toEqual({
            eventSlug: 'groups a',
            streamerId: 'id/with slash',
            scene: 'overlay',
        })
    })

    it('accepts a trailing slash', () => {
        expect(parseStreamScenePath('/stream/cup/42/brb/')).toEqual({ eventSlug: 'cup', streamerId: '42', scene: 'brb' })
    })

    it('rejects missing segments', () => {
        for (const path of ['', '/stream', '/stream/', '/stream/cup', '/stream/cup/42', '/stream/cup//overlay', '/stream//42/overlay', '/stream/cup/42/']) {
            expect(parseStreamScenePath(path)).toBeNull()
        }
    })

    it('rejects extra segments', () => {
        expect(parseStreamScenePath('/stream/cup/42/overlay/extra')).toBeNull()
        expect(parseStreamScenePath('/stream/cup/42/overlay/stream')).toBeNull()
    })

    it('rejects empty segments instead of collapsing them', () => {
        for (const path of ['/stream//42/overlay/brb', '/stream/cup/42//overlay', '//stream/cup/42/overlay', '/stream/cup/42/overlay//']) {
            expect(parseStreamScenePath(path)).toBeNull()
        }
    })

    it('rejects paths that are not under /stream', () => {
        for (const path of ['/', '/events/cup', '/events/cup/matches/77/stream', '/streams/cup/42/overlay', '/x/stream/cup/42']) {
            expect(parseStreamScenePath(path)).toBeNull()
        }
    })

    it('does not throw on a malformed percent escape', () => {
        expect(() => parseStreamScenePath('/stream/%/42/overlay')).not.toThrow()
        expect(parseStreamScenePath('/stream/%/42/overlay')).toEqual({ eventSlug: '%', streamerId: '42', scene: 'overlay' })
    })
})

describe('streamScenePath', () => {
    it('builds the chromeless scene path', () => {
        expect(streamScenePath('2v2-cup-2026', '228152236587483136', 'post-match')).toBe(
            '/stream/2v2-cup-2026/228152236587483136/post-match'
        )
    })

    it('encodes the slug and the streamer id', () => {
        expect(streamScenePath('groups a', 'id/with slash', 'overlay')).toBe('/stream/groups%20a/id%2Fwith%20slash/overlay')
    })
})

describe('streamSceneUrl', () => {
    it('puts the scene path on the public site origin', () => {
        expect(streamSceneUrl('2v2-cup-2026', '228152236587483136', 'overlay')).toBe(
            'https://utbt.net/stream/2v2-cup-2026/228152236587483136/overlay'
        )
    })

    it.each(SCENE_IDS)('round-trips the %s scene through the parser', id => {
        const url = new URL(streamSceneUrl('groups a', 'id/with slash', id))
        expect(parseStreamScenePath(url.pathname)).toEqual({ eventSlug: 'groups a', streamerId: 'id/with slash', scene: id })
    })
})
