import { describe, expect, it } from 'vitest'
import { paramsEqual } from './NavigationContext'

describe('paramsEqual', () => {
    it('treats two different match ids as different params', () => {
        expect(paramsEqual({ eventSlug: 'cup', matchId: '1' }, { eventSlug: 'cup', matchId: '2' })).toBe(false)
    })

    it('treats the same event slug and match id as equal', () => {
        expect(paramsEqual({ eventSlug: 'cup', matchId: '1' }, { eventSlug: 'cup', matchId: '1' })).toBe(true)
    })
})
