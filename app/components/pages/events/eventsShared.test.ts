import { describe, expect, it } from 'vitest'
import { scheduleTabVisible, streamerName } from './eventsShared'

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

describe('streamerName', () => {
    it('uses the display name', () => {
        expect(streamerName({ display_name: 'AliceStreams' })).toBe('AliceStreams')
    })

    it('falls back for a streamer with no alias', () => {
        expect(streamerName({ display_name: null })).toBe('Unnamed streamer')
        expect(streamerName({ display_name: '  ' })).toBe('Unnamed streamer')
    })
})
