import { describe, expect, it } from 'vitest'
import { NEWEST_STREAM_SCENE_ID, STREAM_SCENES, streamSceneLabel } from '@/app/components/stream/streamSceneRegistry'
import { kitBannerHeadline, kitBannerState } from './kitBanner'

describe('kitBannerState', () => {
    it('asks for an import when the kit was never downloaded', () => {
        expect(kitBannerState({ currentVersion: 1, downloadedVersion: null })).toBe('never-downloaded')
    })

    it('is quiet when the downloaded kit is the current structure', () => {
        expect(kitBannerState({ currentVersion: 2, downloadedVersion: 2 })).toBe('current')
    })

    it('asks for a re-import when the structure moved on', () => {
        expect(kitBannerState({ currentVersion: 3, downloadedVersion: 2 })).toBe('outdated')
    })

    it('is quiet when the streamer somehow holds a newer kit', () => {
        expect(kitBannerState({ currentVersion: 1, downloadedVersion: 2 })).toBe('current')
    })
})

describe('kitBannerHeadline', () => {
    it('names the newest registered scene when the kit is outdated', () => {
        expect(STREAM_SCENES.map(scene => scene.id)).toContain(NEWEST_STREAM_SCENE_ID)
        expect(kitBannerHeadline('outdated')).toBe(`Kit updated — re-import to get ${streamSceneLabel(NEWEST_STREAM_SCENE_ID)}`)
    })

    it('asks for a first download when the kit was never downloaded', () => {
        expect(kitBannerHeadline('never-downloaded')).toBe("You haven't downloaded your kit yet.")
    })
})
