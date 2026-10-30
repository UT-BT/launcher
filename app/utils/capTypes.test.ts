import { describe, expect, it } from 'vitest'
import { CAP_TYPE_I4GAMES, CAP_TYPE_UTBT_CERTIFIED, isCertifiedCap } from './capTypes'

describe('cap types', () => {
    it('matches the API cap_type values', () => {
        expect(CAP_TYPE_UTBT_CERTIFIED).toBe(2)
        expect(CAP_TYPE_I4GAMES).toBe(3)
    })

    it('treats only UTBT certified caps as certified', () => {
        expect(isCertifiedCap({ cap_type: 2 })).toBe(true)
        expect(isCertifiedCap({ cap_type: 3 })).toBe(false)
        expect(isCertifiedCap({ cap_type: 0 })).toBe(false)
        expect(isCertifiedCap({ cap_type: null })).toBe(false)
        expect(isCertifiedCap({})).toBe(false)
    })
})
