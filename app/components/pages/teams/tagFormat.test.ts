import { describe, expect, it } from 'vitest'
import { nameValidationError, tagValidationError } from './tagFormat'

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
