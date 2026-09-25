import { describe, expect, it } from 'vitest'
import { scheduleTabVisible } from './eventsShared'

describe('scheduleTabVisible', () => {
    it('is visible to a rostered team member', () => {
        expect(scheduleTabVisible(true, false, false)).toBe(true)
    })

    it('is visible to a bracket manager with no team in the event', () => {
        expect(scheduleTabVisible(false, true, false)).toBe(true)
    })

    it('is visible to a streaming volunteer with no team in the event', () => {
        expect(scheduleTabVisible(false, false, true)).toBe(true)
    })

    it('is hidden from a spectator who is none of those', () => {
        expect(scheduleTabVisible(false, false, false)).toBe(false)
    })
})
