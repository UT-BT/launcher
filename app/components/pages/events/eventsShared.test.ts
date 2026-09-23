import { describe, expect, it } from 'vitest'
import { scheduleTabVisible } from './eventsShared'

describe('scheduleTabVisible', () => {
    it('is visible to a rostered team member', () => {
        expect(scheduleTabVisible(true, false)).toBe(true)
    })

    it('is visible to a bracket manager with no team in the event', () => {
        expect(scheduleTabVisible(false, true)).toBe(true)
    })

    it('is hidden from a spectator who is neither', () => {
        expect(scheduleTabVisible(false, false)).toBe(false)
    })
})
