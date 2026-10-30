import { describe, expect, it } from 'vitest'
import { mapAuthorName } from './mapAuthor'

describe('mapAuthorName', () => {
    it('prefers the display author over the free-text credit', () => {
        expect(mapAuthorName({ author: 'Linked Alias', author_str: 'Old Credit' })).toBe('Linked Alias')
    })

    it('falls back to the free-text credit when author is missing or blank', () => {
        expect(mapAuthorName({ author_str: 'Lun' })).toBe('Lun')
        expect(mapAuthorName({ author: '  ', author_str: ' Lun ' })).toBe('Lun')
        expect(mapAuthorName({ author: null, author_str: 'Lun' })).toBe('Lun')
    })

    it('stringifies a numeric author', () => {
        expect(mapAuthorName({ author: 42, author_str: 'Lun' })).toBe('42')
    })

    it('trims and returns an empty string when there is no author', () => {
        expect(mapAuthorName({ author: ' Ace ' })).toBe('Ace')
        expect(mapAuthorName({ author_str: null })).toBe('')
        expect(mapAuthorName(null)).toBe('')
        expect(mapAuthorName(undefined)).toBe('')
    })
})
