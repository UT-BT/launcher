import { describe, expect, it } from 'vitest'
import { teamRunStateLabel } from './teamRunState'

describe('teamRunStateLabel', () => {
    it('reads Pending for a complete run still waiting for member demos', () => {
        expect(teamRunStateLabel('pending')).toBe('Pending')
    })

    it('reads Verified only once the run is verified', () => {
        expect(teamRunStateLabel('verified')).toBe('Verified')
    })

    it('labels incomplete and disallowed runs', () => {
        expect(teamRunStateLabel('incomplete')).toBe('Incomplete')
        expect(teamRunStateLabel('disallowed')).toBe('Disallowed')
    })
})
