import { describe, expect, it } from 'vitest'
import { DEFAULT_VIDEO_TAGS, parseVideoTags } from './videoTags'

describe('the tags shown on the videos', () => {
    it('shows the name and the live gap until someone turns them off', () => {
        expect(parseVideoTags(null)).toEqual({ names: true, gap: true })
        expect(DEFAULT_VIDEO_TAGS).toEqual({ names: true, gap: true })
    })

    it('reads back each choice on its own', () => {
        expect(parseVideoTags(JSON.stringify({ names: false, gap: true }))).toEqual({ names: false, gap: true })
        expect(parseVideoTags(JSON.stringify({ gap: false }))).toEqual({ names: true, gap: false })
    })

    it('falls back to both shown when the stored value is broken', () => {
        expect(parseVideoTags('{oops')).toEqual(DEFAULT_VIDEO_TAGS)
        expect(parseVideoTags(JSON.stringify(['names']))).toEqual(DEFAULT_VIDEO_TAGS)
        expect(parseVideoTags(JSON.stringify({ names: 'no', gap: 0 }))).toEqual(DEFAULT_VIDEO_TAGS)
    })
})
