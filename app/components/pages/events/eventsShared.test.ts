import { describe, expect, it } from 'vitest'
import { autoScheduleView, hasPublishedStages, isScheduleParticipant, scheduleTabVisible, streamerName } from './eventsShared'

function bracket(published: boolean, stages: boolean[]) {
    return { published, stages: stages.map(stagePublished => ({ published: stagePublished })) }
}

describe('isScheduleParticipant', () => {
    it('is true for a rostered team member', () => {
        expect(isScheduleParticipant(true, false, false)).toBe(true)
    })

    it('is true for a bracket manager with no team in the event', () => {
        expect(isScheduleParticipant(false, true, false)).toBe(true)
    })

    it('is true for a streaming volunteer with no team in the event', () => {
        expect(isScheduleParticipant(false, false, true)).toBe(true)
    })

    it('is false for a spectator who is none of those', () => {
        expect(isScheduleParticipant(false, false, false)).toBe(false)
    })
})

describe('hasPublishedStages', () => {
    it('is false before the bracket has loaded', () => {
        expect(hasPublishedStages(null)).toBe(false)
    })

    it('is false for a bracket with no stages', () => {
        expect(hasPublishedStages(bracket(true, []))).toBe(false)
    })

    it('is false while every stage is still hidden', () => {
        expect(hasPublishedStages(bracket(true, [false, false]))).toBe(false)
    })

    it('is false while the bracket itself is hidden, even with a published stage', () => {
        expect(hasPublishedStages(bracket(false, [true]))).toBe(false)
    })

    it('is true once one stage of a published bracket is published', () => {
        expect(hasPublishedStages(bracket(true, [false, true]))).toBe(true)
    })
})

describe('scheduleTabVisible', () => {
    it('is visible to a participant before any stage is published', () => {
        expect(scheduleTabVisible(true, null)).toBe(true)
        expect(scheduleTabVisible(true, bracket(false, [false]))).toBe(true)
    })

    it('is hidden from a spectator while no stage is published', () => {
        expect(scheduleTabVisible(false, null)).toBe(false)
        expect(scheduleTabVisible(false, bracket(true, [false]))).toBe(false)
    })

    it('is visible to a spectator once a stage is published', () => {
        expect(scheduleTabVisible(false, bracket(true, [true]))).toBe(true)
    })
})

describe('autoScheduleView', () => {
    it('opens My Matches while the team owes a response', () => {
        expect(autoScheduleView(1, false)).toBe('mine')
    })

    it('opens My Matches while a picks & bans session is open', () => {
        expect(autoScheduleView(0, true)).toBe('mine')
    })

    it('opens All Matches when there is nothing to act on', () => {
        expect(autoScheduleView(0, false)).toBe('all')
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
