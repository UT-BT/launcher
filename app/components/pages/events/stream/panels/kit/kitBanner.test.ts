import { describe, expect, it } from 'vitest'
import { kitBannerState } from './kitBanner'

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
