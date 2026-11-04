import { describe, expect, it } from 'vitest'
import { parseCompareQuery } from './compareUrl'
import { compareShareLink } from './shareLink'

const A = '0a0a0a0a-0000-4000-8000-00000000000a'
const B = '0b0b0b0b-0000-4000-8000-00000000000b'
const M1 = '1d1d1d1d-0000-4000-8000-0000000000d1'
const M2 = '2d2d2d2d-0000-4000-8000-0000000000d2'

function pathOf(link: string): string {
    const url = new URL(link)
    return `${url.pathname}${url.search}`
}

describe('the share link', () => {
    it('points at the site’s compare page with the whole comparison', () => {
        const { state } = parseCompareQuery(`runs=${A},${B}&ref=${B}&sync=position`)
        const link = compareShareLink(state, null)

        expect(new URL(link).protocol).toBe('https:')
        expect(pathOf(link)).toBe(`/compare?runs=${A},${B}&ref=${B}&sync=position`)
    })

    it('starts at the shared time, to the millisecond', () => {
        const { state } = parseCompareQuery(`runs=${A},${B}`)

        expect(pathOf(compareShareLink(state, 8.2004))).toBe(`/compare?runs=${A},${B}&t=8.200`)
        expect(pathOf(compareShareLink(state, 61.0005))).toBe(`/compare?runs=${A},${B}&t=61.001`)
    })

    it('replaces the start time the comparison was opened at', () => {
        const { state } = parseCompareQuery(`runs=${A},${B}&t=3.000`)

        expect(pathOf(compareShareLink(state, null))).toBe(`/compare?runs=${A},${B}`)
        expect(pathOf(compareShareLink(state, 5))).toBe(`/compare?runs=${A},${B}&t=5.000`)
    })

    it('keeps the team pairings, offsets and hidden videos', () => {
        const query = `runs=${A},${B}&data=${M2}&off=${M1}:-120&pair=${M1}:${M2}&drive=${M1}`
        const { state } = parseCompareQuery(query, new Set([M1, M2]))

        expect(pathOf(compareShareLink(state, null))).toBe(`/compare?${query}`)
    })
})
