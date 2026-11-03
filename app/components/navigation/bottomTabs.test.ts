import { describe, expect, it } from 'vitest'
import { activeBottomTab, BOTTOM_TABS, showsBottomTabs } from './bottomTabs'
import { pathToNav, viewToPath } from './routes'

describe('activeBottomTab', () => {
    it.each([
        ['home', 'home'],
        ['maps', 'maps'],
        ['maps-detail', 'maps'],
        ['world-records', 'world-records'],
        ['events', 'events'],
        ['event-detail', 'events'],
        ['match-pickban', 'events'],
        ['event-team', 'events'],
    ])('highlights the %s view under the %s tab', (view, tab) => {
        expect(activeBottomTab(view)).toBe(tab)
    })

    it.each(['news', 'news-detail', 'players', 'player-detail', 'cap-detail', 'teams', 'servers', 'cap-it-all', 'achievements', 'admin', 'unknown', 'constructor', ''])(
        'highlights no tab on the %s view',
        view => {
            expect(activeBottomTab(view)).toBeNull()
        },
    )
})

describe('BOTTOM_TABS', () => {
    it('holds Home, Maps, World Records and Events in that order, before the Menu slot', () => {
        expect(BOTTOM_TABS.map(tab => tab.label)).toEqual(['Home', 'Maps', 'World Records', 'Events'])
    })

    it('opens each tab on its own page-view', () => {
        expect(BOTTOM_TABS.map(tab => tab.id)).toEqual(['home', 'maps', 'world-records', 'events'])
    })

    it('routes each tab to a URL that opens the same view', () => {
        expect(BOTTOM_TABS.map(tab => pathToNav(viewToPath(tab.id, {}), '').view)).toEqual(BOTTOM_TABS.map(tab => tab.id))
    })
})

describe('showsBottomTabs', () => {
    const phone = { touch: true, belowLg: true, orientation: 'portrait' } as const

    it('shows on a touch device below lg in portrait', () => {
        expect(showsBottomTabs(phone)).toBe(true)
    })

    it('hides in landscape', () => {
        expect(showsBottomTabs({ ...phone, orientation: 'landscape' })).toBe(false)
    })

    it('hides from lg up', () => {
        expect(showsBottomTabs({ ...phone, belowLg: false })).toBe(false)
    })

    it('hides without touch', () => {
        expect(showsBottomTabs({ ...phone, touch: false })).toBe(false)
    })
})
