import { describe, expect, it } from 'vitest'
import { BASE_NAV_SECTIONS, eventSlugOfView, isEventLinkLive, isNavItemActive, navItemDestination, newSinceVisitBadge, type NavItem } from './nav-items'

const mapsItem: NavItem = { id: 'maps', label: 'Maps', icon: () => null }
const eventsItem = BASE_NAV_SECTIONS.flatMap(section => section.items).find(item => item.id === 'events')!
const cupItem = BASE_NAV_SECTIONS.flatMap(section => section.items).find(item => item.id === 'cup-2v2-2026')!

describe('isNavItemActive', () => {
    describe('a plain item', () => {
        it('is active when the current view equals its id', () => {
            expect(isNavItemActive(mapsItem, 'maps', {})).toBe(true)
        })

        it('is inactive when the current view differs', () => {
            expect(isNavItemActive(mapsItem, 'players', {})).toBe(false)
        })

        it('leaves Events inactive on an event page', () => {
            expect(isNavItemActive(eventsItem, 'event-detail', { eventSlug: '2v2-cup-2026' })).toBe(false)
            expect(isNavItemActive(eventsItem, 'match-pickban', { eventSlug: '2v2-cup-2026', matchId: '42' })).toBe(false)
        })
    })

    describe('the cup event link', () => {
        it('is active on its event page', () => {
            expect(isNavItemActive(cupItem, 'event-detail', { eventSlug: '2v2-cup-2026' })).toBe(true)
        })

        it('stays active whichever event tab is open', () => {
            expect(isNavItemActive(cupItem, 'event-detail', { eventSlug: '2v2-cup-2026', eventTab: 'bracket' })).toBe(true)
        })

        it('is active on a cup match picks & bans page', () => {
            expect(isNavItemActive(cupItem, 'match-pickban', { eventSlug: '2v2-cup-2026', matchId: '42' })).toBe(true)
        })

        it('is inactive on a different event page', () => {
            expect(isNavItemActive(cupItem, 'event-detail', { eventSlug: 'other-cup' })).toBe(false)
            expect(isNavItemActive(cupItem, 'match-pickban', { eventSlug: 'other-cup', matchId: '42' })).toBe(false)
        })

        it('is inactive on unrelated views', () => {
            expect(isNavItemActive(cupItem, 'home', {})).toBe(false)
            expect(isNavItemActive(cupItem, 'events', {})).toBe(false)
            expect(isNavItemActive(cupItem, 'cup-2v2-2026', {})).toBe(false)
        })
    })
})

describe('BASE_NAV_SECTIONS registry', () => {
    it('places the cup item directly after Achievements in Main', () => {
        const main = BASE_NAV_SECTIONS.find(section => section.title === 'Main')!
        const ids = main.items.map(item => item.id)
        const achievementsIndex = ids.indexOf('achievements')
        expect(ids[achievementsIndex + 1]).toBe('cup-2v2-2026')
    })

    it('makes the cup item an event link to the 2v2 World Cup 2026, live until 2026-11-22', () => {
        expect(cupItem.label).toBe('2v2 Cup')
        expect(cupItem.eventLink).toEqual({ slug: '2v2-cup-2026', fullName: '2v2 World Cup 2026', liveUntil: '2026-11-22' })
    })
})

describe('navItemDestination', () => {
    it('sends the cup event link to the event-detail view with its slug', () => {
        expect(navItemDestination(cupItem)).toEqual({ view: 'event-detail', params: { eventSlug: '2v2-cup-2026' } })
    })

    it('sends a plain item to its id with empty params', () => {
        expect(navItemDestination(mapsItem)).toEqual({ view: 'maps', params: {} })
    })
})

describe('eventSlugOfView', () => {
    it('gives the slug of an event detail page', () => {
        expect(eventSlugOfView('event-detail', { eventSlug: '2v2-cup-2026', eventTab: 'schedule' })).toBe('2v2-cup-2026')
    })

    it('gives the slug of a match picks & bans page', () => {
        expect(eventSlugOfView('match-pickban', { eventSlug: '2v2-cup-2026', matchId: '42' })).toBe('2v2-cup-2026')
    })

    it('gives nothing for a view that belongs to no event', () => {
        expect(eventSlugOfView('events', {})).toBeNull()
        expect(eventSlugOfView('maps-detail', { mapName: 'CTF-BT-Test', eventSlug: '2v2-cup-2026' })).toBeNull()
    })

    it('gives nothing for an event view without a slug', () => {
        expect(eventSlugOfView('event-detail', {})).toBeNull()
        expect(eventSlugOfView('match-pickban', { matchId: '42' })).toBeNull()
    })
})

describe('isEventLinkLive', () => {
    const cupLink = cupItem.eventLink!

    it('shows the Live tag the day before the live-until day', () => {
        expect(isEventLinkLive(cupLink, new Date(2026, 10, 21, 12, 0))).toBe(true)
    })

    it('shows the Live tag for the whole live-until day in local time', () => {
        expect(isEventLinkLive(cupLink, new Date(2026, 10, 22, 0, 0, 0))).toBe(true)
        expect(isEventLinkLive(cupLink, new Date(2026, 10, 22, 23, 59, 59))).toBe(true)
    })

    it('hides the Live tag from the first local moment of the day after', () => {
        expect(isEventLinkLive(cupLink, new Date(2026, 10, 23, 0, 0, 0))).toBe(false)
        expect(isEventLinkLive(cupLink, new Date(2026, 10, 23, 12, 0))).toBe(false)
    })

    it('keeps comparing whole days across month and year boundaries', () => {
        const link = { slug: 'winter-cup', fullName: 'Winter Cup', liveUntil: '2026-12-31' } as const
        expect(isEventLinkLive(link, new Date(2026, 8, 30))).toBe(true)
        expect(isEventLinkLive(link, new Date(2027, 0, 1))).toBe(false)
    })
})

describe('newSinceVisitBadge', () => {
    it('shows the count with its meaning', () => {
        expect(newSinceVisitBadge(2)).toEqual({ count: 2, live: false, details: ['2 new since your last visit'] })
    })

    it('shows nothing without new items', () => {
        expect(newSinceVisitBadge(0)).toBeNull()
        expect(newSinceVisitBadge(null)).toBeNull()
        expect(newSinceVisitBadge(undefined)).toBeNull()
    })
})
