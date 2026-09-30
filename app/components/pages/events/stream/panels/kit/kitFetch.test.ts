import { describe, expect, it } from 'vitest'
import { kitDownloadUrl, kitInfoFromPayload, kitPath, kitZipName } from './kitFetch'

describe('kit routes', () => {
    it('builds the kit path for an event and streamer', () => {
        expect(kitPath('stream-cup', '111')).toBe('/tournaments/stream-cup/stream/111/kit')
    })

    it('carries the folder as an encoded query', () => {
        expect(kitPath('stream-cup', '111', 'C:\\UTBT Kit')).toBe('/tournaments/stream-cup/stream/111/kit?folder=C%3A%5CUTBT%20Kit')
    })

    it('makes the desktop download url absolute', () => {
        expect(kitDownloadUrl('stream-cup', '111', 'C:\\Kit')).toMatch(/^https?:\/\/.+\/tournaments\/stream-cup\/stream\/111\/kit\?folder=C%3A%5CKit$/)
    })

    it('names the ZIP after the event', () => {
        expect(kitZipName('stream-cup')).toBe('utbt-stream-kit-stream-cup.zip')
    })
})

describe('kitInfoFromPayload', () => {
    it('reads the kit-info fields', () => {
        expect(kitInfoFromPayload({ current_version: 2, downloaded_version: 1, default_folder: 'C:\\UTBT-StreamKit' }))
            .toEqual({ currentVersion: 2, downloadedVersion: 1, defaultFolder: 'C:\\UTBT-StreamKit' })
    })

    it('keeps a missing download as null', () => {
        expect(kitInfoFromPayload({ current_version: 1, downloaded_version: null }).downloadedVersion).toBeNull()
    })
})
