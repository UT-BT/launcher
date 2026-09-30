import { describe, expect, it } from 'vitest'
import { STREAM_SCENES } from '@/app/components/stream/streamScenes'
import { sceneLinks } from './sceneLinks'

describe('sceneLinks', () => {
    it('lists the twelve scenes in contract order with the streamer id in every url', () => {
        const links = sceneLinks('stream-cup', '111111111111', true)
        expect(links.map(link => link.id)).toEqual(STREAM_SCENES.map(scene => scene.id))
        expect(links).toHaveLength(12)
        for (const link of links) {
            expect(link.url).toMatch(/^https?:\/\/[^/]+\/stream\/stream-cup\/111111111111\/[a-z-]+$/)
        }
    })

    it('previews on the current origin on the website and on the site origin in the desktop app', () => {
        const web = sceneLinks('stream-cup', '111111111111', true)[0]
        const desktop = sceneLinks('stream-cup', '111111111111', false)[0]
        expect(web.previewSrc).toBe('/stream/stream-cup/111111111111/starting-soon?preview=1')
        expect(desktop.previewSrc).toBe(`${desktop.url}?preview=1`)
    })

    it('flags the transparent scenes for the checkerboard', () => {
        const transparent = sceneLinks('stream-cup', '111111111111', true).filter(link => link.transparent).map(link => link.id)
        expect(transparent).toEqual(['overlay', 'caster'])
    })

    it('encodes ids that are not url safe', () => {
        expect(sceneLinks('a b', 'x/y', true)[0].previewSrc).toBe('/stream/a%20b/x%2Fy/starting-soon?preview=1')
    })
})
