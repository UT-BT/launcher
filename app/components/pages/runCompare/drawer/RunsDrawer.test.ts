import { describe, expect, it } from 'vitest'
import { runsCount } from './RunsDrawer'

describe('the run count in the Runs header', () => {
    it('counts solo runs against the limit of ten', () => {
        expect(runsCount(2, 0)).toBe('2 of 10')
        expect(runsCount(10, 0)).toBe('10 of 10')
    })

    it('counts team runs against the limit of four', () => {
        expect(runsCount(6, 2)).toBe('2 of 4 team runs')
    })
})
