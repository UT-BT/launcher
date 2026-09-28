import { describe, expect, it } from 'vitest'
import { BASE_NAV_SECTIONS, isNavItemActive, type NavItem } from './nav-items'

const mapsItem: NavItem = { id: 'maps', label: 'Maps', icon: () => null }
const eventsItem = BASE_NAV_SECTIONS.flatMap(section => section.items).find(item => item.id === 'events')!
const cupItem = BASE_NAV_SECTIONS.flatMap(section => section.items).find(item => item.id === 'cup-2v2-2026')!

describe('isNavItemActive', () => {
    it('is active for a plain item when the current view equals its id', () => {
        expect(isNavItemActive(mapsItem, 'maps', {})).toBe(true)
    })

    it('is inactive for a plain item when the current view differs', () => {
        expect(isNavItemActive(mapsItem, 'players', {})).toBe(false)
    })

    it('is active for the cup item on event-detail with the cup slug', () => {
        expect(isNavItemActive(cupItem, 'event-detail', { eventSlug: '2v2-cup-2026' })).toBe(true)
    })

    it('is active for the cup item on event-detail with the cup slug and a tab', () => {
        expect(isNavItemActive(cupItem, 'event-detail', { eventSlug: '2v2-cup-2026', eventTab: 'bracket' })).toBe(true)
    })

    it('is active for the cup item on a cup match picks & bans page', () => {
        expect(isNavItemActive(cupItem, 'match-pickban', { eventSlug: '2v2-cup-2026', matchId: '42' })).toBe(true)
    })

    it('is inactive for the cup item on a different event slug', () => {
        expect(isNavItemActive(cupItem, 'event-detail', { eventSlug: 'other-cup' })).toBe(false)
    })

    it('is inactive for the cup item on unrelated views', () => {
        expect(isNavItemActive(cupItem, 'home', {})).toBe(false)
        expect(isNavItemActive(cupItem, 'events', {})).toBe(false)
    })

    it('leaves the Events item inactive on an event detail page', () => {
        expect(isNavItemActive(eventsItem, 'event-detail', { eventSlug: '2v2-cup-2026' })).toBe(false)
    })
})

describe('BASE_NAV_SECTIONS registry order', () => {
    it('places the cup item directly after Achievements in Main', () => {
        const main = BASE_NAV_SECTIONS.find(section => section.title === 'Main')!
        const ids = main.items.map(item => item.id)
        const achievementsIndex = ids.indexOf('achievements')
        expect(ids[achievementsIndex + 1]).toBe('cup-2v2-2026')
    })

    it('gives the cup item the event-detail destination with the cup slug', () => {
        expect(cupItem.view).toBe('event-detail')
        expect(cupItem.params).toEqual({ eventSlug: '2v2-cup-2026' })
    })
})
