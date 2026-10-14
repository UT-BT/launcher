import { describe, expect, it } from 'vitest'

import type { AchievementDefinition, AchievementEvent, AchievementEventState } from '@/app/utils/api'
import {
    awardedAtEnd,
    eventSectionFirst,
    eventSectionLabel,
    eventStateOf,
    eventWindowNotice,
    isEventAchievement,
    isStillWinnable,
} from './eventAchievements'

const OPENS = '2026-09-26T22:00:00+00:00'
const CLOSES = '2026-11-22T22:59:00+00:00'

function cupEvent(state: AchievementEventState, overrides: Partial<AchievementEvent> = {}): AchievementEvent {
    return {
        key: 'cup-2026-predictions',
        name: '2v2 World Cup 2026',
        opens_at: OPENS,
        closes_at: CLOSES,
        finalised_at: state === 'ended' ? CLOSES : null,
        state,
        ...overrides,
    }
}

function def(overrides: Partial<AchievementDefinition> = {}): AchievementDefinition {
    return {
        code: 'cup_2026_net_positive',
        name: 'Net Positive',
        description: '',
        metric: 'event_in_profit',
        icon: 'Coins',
        goal: 'Finish above your starting coins',
        category: 'event',
        tiers: [],
        ...overrides,
    }
}

const always = def({ code: 'time_played', category: 'general', event: null })

describe('spotting a limited-time achievement', () => {
    it('needs both the category and the event block, so a stray category cannot fake one', () => {
        expect(isEventAchievement(def({ event: cupEvent('live') }))).toBe(true)
        expect(isEventAchievement(def({ event: null }))).toBe(false)
        expect(isEventAchievement(always)).toBe(false)
    })

    it('reads the state the server sent rather than comparing dates', () => {
        expect(eventStateOf(def({ event: cupEvent('upcoming') }))).toBe('upcoming')
        expect(eventStateOf(always)).toBeNull()
    })
})

describe('whether there is still anything to win', () => {
    it('is true while the event runs', () => {
        expect(isStillWinnable(def({ event: cupEvent('live') }))).toBe(true)
    })

    it('is true before it opens, because that is ahead of you rather than behind', () => {
        expect(isStillWinnable(def({ event: cupEvent('upcoming') }))).toBe(true)
    })

    it('is false once it has ended, which is what keeps a dead goal off the homepage', () => {
        expect(isStillWinnable(def({ event: cupEvent('ended') }))).toBe(false)
    })

    it('is true for an ordinary achievement, which is never not winnable', () => {
        expect(isStillWinnable(always)).toBe(true)
    })
})

describe('which achievements wait for the event to end', () => {
    it('holds back a standing-based achievement while the event is unfinalised', () => {
        expect(awardedAtEnd(def({ event: cupEvent('live'), unlocks_mid_event: false }))).toBe(true)
        expect(awardedAtEnd(def({ event: cupEvent('upcoming') }))).toBe(true)
    })

    it('lets one that unlocks mid-event through', () => {
        expect(awardedAtEnd(def({ event: cupEvent('live'), unlocks_mid_event: true }))).toBe(false)
    })

    it('stops holding back once the event is finalised', () => {
        expect(awardedAtEnd(def({ event: cupEvent('ended'), unlocks_mid_event: false }))).toBe(false)
    })

    it('keeps holding back an event whose window closed but nobody finalised', () => {
        expect(awardedAtEnd(def({ event: cupEvent('ended', { finalised_at: null }) }))).toBe(true)
    })

    it('never applies to an ordinary achievement', () => {
        expect(awardedAtEnd(always)).toBe(false)
    })
})

describe('where the section sits', () => {
    it('leads while the event is live', () => {
        expect(eventSectionFirst([always, def({ event: cupEvent('live') })])).toBe(true)
    })

    it('leads before it opens, so people know it is coming', () => {
        expect(eventSectionFirst([def({ event: cupEvent('upcoming') })])).toBe(true)
    })

    it('drops below the everyday ladders once it is over', () => {
        expect(eventSectionFirst([def({ event: cupEvent('ended') })])).toBe(false)
    })

    it('stays put when there is no event at all', () => {
        expect(eventSectionFirst([always])).toBe(false)
    })
})

describe('the window notice', () => {
    it('counts towards the opening while the event is still ahead', () => {
        expect(eventWindowNotice(def({ event: cupEvent('upcoming') }))).toEqual({
            prefix: 'Opens',
            at: Date.parse(OPENS),
        })
    })

    it('counts towards the deadline while it runs', () => {
        expect(eventWindowNotice(def({ event: cupEvent('live') }))).toEqual({
            prefix: 'Ends',
            at: Date.parse(CLOSES),
        })
    })

    it('speaks in the past tense once it is over', () => {
        expect(eventWindowNotice(def({ event: cupEvent('ended') }))).toEqual({
            prefix: 'Ended',
            at: Date.parse(CLOSES),
        })
    })

    it('falls back to when it was finalised for an event with no closing time', () => {
        const event = cupEvent('ended', { closes_at: null, finalised_at: CLOSES })

        expect(eventWindowNotice(def({ event }))).toEqual({ prefix: 'Ended', at: Date.parse(CLOSES) })
    })

    it('survives an event with no dates at all rather than rendering an invalid one', () => {
        const event = cupEvent('live', { opens_at: null, closes_at: null })

        expect(eventWindowNotice(def({ event }))).toEqual({ prefix: 'Ends', at: null })
    })

    it('is nothing at all for an ordinary achievement', () => {
        expect(eventWindowNotice(always)).toBeNull()
    })
})

describe('the section label', () => {
    it('names the event, because "Event" tells a reader nothing', () => {
        expect(eventSectionLabel([always, def({ event: cupEvent('live') })])).toBe('2v2 World Cup 2026')
    })

    it('falls back when the definitions carry no event', () => {
        expect(eventSectionLabel([always])).toBe('Limited time')
    })
})
