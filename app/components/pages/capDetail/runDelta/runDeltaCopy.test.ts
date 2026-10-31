import { describe, expect, it } from 'vitest'
import { differentLineNote, routesDifferSummary } from './runDeltaCopy'

describe('the run delta card copy', () => {
    it('explains a flagged sector in one line under the table', () => {
        expect(differentLineNote('gxls', '[UTW]Nettlez')).toBe("gxls left [UTW]Nettlez's line in this sector")
    })

    it('explains a pair whose routes differ with the coverage', () => {
        expect(routesDifferSummary(27, 'Bun` #OF')).toBe(
            "Only 27% of this run follows Bun` #OF's line, for example because they started from different spawns. Sector splits are hidden.",
        )
    })
})
