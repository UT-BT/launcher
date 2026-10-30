import { describe, expect, it } from 'vitest'
import { countWord, joinWithAnd } from './wording'

describe('countWord', () => {
    it('spells small counts as words', () => {
        expect(countWord(1)).toBe('one')
        expect(countWord(4)).toBe('four')
        expect(countWord(13)).toBe('thirteen')
        expect(countWord(20)).toBe('twenty')
    })

    it('falls back to digits past twenty', () => {
        expect(countWord(21)).toBe('21')
        expect(countWord(0)).toBe('0')
    })
})

describe('joinWithAnd', () => {
    it('joins a list with commas and a final and, without an Oxford comma', () => {
        expect(joinWithAnd(['Halloween', 'Christmas', 'Easter'])).toBe('Halloween, Christmas and Easter')
    })

    it('joins two items with and and leaves one alone', () => {
        expect(joinWithAnd(['BRB', 'Ending'])).toBe('BRB and Ending')
        expect(joinWithAnd(['BRB'])).toBe('BRB')
        expect(joinWithAnd([])).toBe('')
    })
})
