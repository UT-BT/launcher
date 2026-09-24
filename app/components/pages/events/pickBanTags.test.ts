import { describe, expect, it } from 'vitest'
import { sameTag, tagKey } from './pickBanTags'

describe('tagKey', () => {
    it('trims and lower-cases a tag', () => {
        expect(tagKey('  Hard ')).toBe('hard')
    })
})

describe('sameTag', () => {
    it('matches tags case-insensitively around whitespace', () => {
        expect(sameTag(' HARD', 'hard ')).toBe(true)
    })

    it('does not match a tag that only starts the same', () => {
        expect(sameTag('Hardcore', 'Hard')).toBe(false)
    })
})
