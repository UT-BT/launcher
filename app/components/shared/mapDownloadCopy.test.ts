import { describe, expect, it } from 'vitest'
import { mapDownloadSuccessCopy } from './mapDownloadCopy'

const webResult = { mapName: 'CTF-BT-Chain', installPath: '', extracted: [], skipped: [] }
const desktopResult = {
    mapName: 'CTF-BT-Chain',
    installPath: 'C:\\UT99',
    extracted: ['Maps/CTF-BT-Chain.unr'],
    skipped: [],
}

describe('mapDownloadSuccessCopy', () => {
    it('says the map was downloaded as a zip when the target does not install', () => {
        const copy = mapDownloadSuccessCopy(webResult, false)
        expect(copy.title).toBe('Map Downloaded')
        expect(copy.summary).toContain('Downloaded as CTF-BT-Chain.zip')
        expect(copy.lines).toEqual([])
        expect(copy.installPath).toBeNull()
    })

    it('never mentions installing or extracting in the download copy', () => {
        const copy = mapDownloadSuccessCopy(webResult, false)
        const text = [copy.title, copy.summary, ...copy.lines].join(' ')
        expect(text).not.toMatch(/install|extracted/i)
    })

    it('keeps the desktop install copy', () => {
        expect(mapDownloadSuccessCopy(desktopResult, true)).toEqual({
            title: 'Map Installed',
            summary: null,
            lines: ['Extracted: 1 file'],
            installPath: 'C:\\UT99',
        })
    })

    it('pluralises counts and lists skipped files on desktop', () => {
        const copy = mapDownloadSuccessCopy(
            { ...desktopResult, extracted: ['a', 'b'], skipped: ['c'] },
            true,
        )
        expect(copy.lines).toEqual(['Extracted: 2 files', 'Skipped (already existed): 1 file'])
    })
})
