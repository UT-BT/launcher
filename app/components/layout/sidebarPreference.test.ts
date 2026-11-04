import { describe, expect, it } from 'vitest'
import { viewToPath } from '@/app/components/navigation/routes'
import { THEATER_VIEWS } from './sidebarPreference'

describe('the theater views', () => {
    it('are the compare page alone', () => {
        expect([...THEATER_VIEWS]).toEqual(['run-compare'])
        expect(viewToPath('run-compare', {})).toBe('/compare')
    })

    it('leave every other page to the saved rail preference', () => {
        for (const view of ['home', 'maps', 'maps-detail', 'cap-detail', 'team-cap-detail', 'world-records']) {
            expect(THEATER_VIEWS.has(view)).toBe(false)
        }
    })
})
