import { describe, expect, it } from 'vitest'
import { formatTaggedAlias, memberNumberValidationError, nameValidationError, tagValidationError } from './tagFormat'

describe('tagValidationError', () => {
    it.each(['gg', '[BT]', '<GDI>', '!BT!', '#BT#', '-=BT=-', '~BT~'])('accepts %s', tag => {
        expect(tagValidationError(tag)).toBeNull()
    })

    it.each(['a', 'x'.repeat(10), '[]', '-=_', '[B]', 'B T', 'a|b', '|BT|', '<C05>', 'x<C05>', 'B,T', 'café'])(
        'rejects %s',
        tag => {
            expect(tagValidationError(tag)).not.toBeNull()
        },
    )
})

describe('nameValidationError', () => {
    it.each(['Bunny Brigade', "D.O.G-9_'!", 'GDI'])('accepts %s', name => {
        expect(nameValidationError(name)).toBeNull()
    })

    it.each(['ab', 'x'.repeat(25), '!!!', 'Bünny', 'Team#1'])('rejects %s', name => {
        expect(nameValidationError(name)).not.toBeNull()
    })
})

describe('formatTaggedAlias', () => {
    it('places a plain tag on either side', () => {
        expect(formatTaggedAlias('Naru', '[ABC]', 'prefix')).toBe('[ABC] Naru')
        expect(formatTaggedAlias('Naru', '[ABC]', 'suffix')).toBe('Naru [ABC]')
    })

    it('drops the separator when the team turns spacing off', () => {
        expect(formatTaggedAlias('Naru', '[ABC]', 'prefix', 'plain', false)).toBe('[ABC]Naru')
        expect(formatTaggedAlias('Naru', '[ABC]', 'suffix', 'plain', false)).toBe('Naru[ABC]')
    })

    it('appends the member number to a suffix tag', () => {
        expect(formatTaggedAlias('Naru', '.pX', 'suffix', 'numbered', true, 3)).toBe('Naru .pX3')
    })

    it('replaces the alias entirely under number_only', () => {
        expect(formatTaggedAlias('Naru', 'fierd_', 'prefix', 'number_only', false, 1)).toBe('fierd_1')
        expect(formatTaggedAlias('Naru', 'fierd_', 'suffix', 'number_only', true, 12)).toBe('fierd_12')
    })

    it('treats zero as a real number', () => {
        expect(formatTaggedAlias('Naru', 'fierd_', 'prefix', 'number_only', false, 0)).toBe('fierd_0')
    })

    it('falls back to plain when a numbered team has not assigned a number', () => {
        expect(formatTaggedAlias('Naru', '.pX', 'suffix', 'numbered', true, null)).toBe('Naru .pX')
    })

    it('falls back to the raw alias when number_only has no number, so names stay unique', () => {
        expect(formatTaggedAlias('Naru', 'fierd_', 'prefix', 'number_only', false, null)).toBe('Naru')
    })

    it('returns the alias untouched without a tag', () => {
        expect(formatTaggedAlias('Naru', null, 'prefix')).toBe('Naru')
        expect(formatTaggedAlias('  ', '[ABC]', 'prefix')).toBe('[ABC] Player')
    })
})

describe('memberNumberValidationError', () => {
    it.each(['', '  ', '0', '999', '7'])('accepts %s', value => {
        expect(memberNumberValidationError(value)).toBeNull()
    })

    it.each(['-1', '3.5', 'abc', '1000'])('rejects %s', value => {
        expect(memberNumberValidationError(value)).not.toBeNull()
    })
})
