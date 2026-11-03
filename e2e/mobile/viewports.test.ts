import { describe, expect, it } from 'vitest'
import { crawlViewports, matrixScope } from './viewports'

describe('crawl viewports', () => {
    it('runs the PR subset: WebKit at 390x844 and 844x390, Chromium at 360x780 and 915x412', () => {
        const subset = crawlViewports('pr').map(viewport => [viewport.id, viewport.engines])
        expect(subset).toEqual([
            ['390x844', ['webkit']],
            ['844x390', ['webkit']],
            ['360x780', ['chromium']],
            ['915x412', ['chromium']],
        ])
    })

    it('runs every SPEC size on both engines in the full matrix, plus the PR landscape 915x412', () => {
        const full = crawlViewports('full')
        expect(full.map(viewport => viewport.id)).toEqual([
            '360x780', '390x844', '393x852', '402x874', '412x915', '430x932', '440x956',
            '780x360', '844x390', '915x412', '932x430', '956x440',
            '673x841', '744x1133', '820x1180', '1024x1366', '1180x820',
        ])
        expect(full.every(viewport => viewport.engines.join() === 'webkit,chromium')).toBe(true)
    })

    it('reads the scope from MOBILE_MATRIX and defaults to the PR subset', () => {
        expect(matrixScope(undefined)).toBe('pr')
        expect(matrixScope('')).toBe('pr')
        expect(matrixScope('full')).toBe('full')
        expect(() => matrixScope('nightly')).toThrow(/MOBILE_MATRIX/)
    })
})
