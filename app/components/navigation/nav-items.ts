import type { ElementType } from 'react'
import { Home, Server, Map as MapIcon, Trophy, Globe, Users, Users2, Flag, Award, ShieldAlert, Newspaper, Swords } from 'lucide-react'
import type { NavParams } from './NavigationContext'
import { isStaff } from '@/app/utils/roles'
import type { UserProfile } from '@/app/utils/api'

export type CalendarDay = `${number}-${number}-${number}`

export interface EventLink {
    slug: string
    fullName: string
    liveUntil: CalendarDay
}

export interface NavItem {
    id: string
    label: string
    icon: ElementType
    eventLink?: EventLink
}

export interface NavDestination {
    view: string
    params: NavParams
}

export interface NavBadge {
    count: number | null
    live: boolean
    details: string[]
}

export interface NavSection {
    title: string
    items: NavItem[]
}

export const BASE_NAV_SECTIONS: NavSection[] = [
    {
        title: 'Main',
        items: [
            { id: 'home', label: 'Home', icon: Home },
            { id: 'news', label: 'News', icon: Newspaper },
            { id: 'achievements', label: 'Achievements', icon: Award },
            {
                id: 'cup-2v2-2026',
                label: '2v2 Cup',
                icon: Globe,
                eventLink: { slug: '2v2-cup-2026', fullName: '2v2 World Cup 2026', liveUntil: '2026-11-22' },
            },
        ],
    },
    {
        title: 'UTBT.net',
        items: [
            { id: 'maps', label: 'Maps', icon: MapIcon },
            { id: 'players', label: 'Players', icon: Users },
            { id: 'teams', label: 'Teams', icon: Users2 },
            { id: 'events', label: 'Events', icon: Swords },
            { id: 'servers', label: 'Servers', icon: Server },
        ],
    },
    {
        title: 'Leaderboards',
        items: [
            { id: 'cap-it-all', label: 'Cap It All', icon: Flag },
            { id: 'world-records', label: 'World Records', icon: Trophy },
        ],
    },
]

export function buildNavSections(userProfile?: UserProfile): NavSection[] {
    if (!isStaff(userProfile)) return BASE_NAV_SECTIONS
    return [
        ...BASE_NAV_SECTIONS,
        { title: 'Staff', items: [{ id: 'admin', label: 'Admin', icon: ShieldAlert }] },
    ]
}

export function navItemDestination(item: NavItem): NavDestination {
    if (item.eventLink) return { view: 'event-detail', params: { eventSlug: item.eventLink.slug } }
    return { view: item.id, params: {} }
}

export function eventSlugOfView(view: string, params: NavParams): string | null {
    if (view !== 'event-detail' && view !== 'match-pickban') return null
    return params.eventSlug || null
}

export function isNavItemActive(item: NavItem, currentView: string, currentParams: NavParams): boolean {
    if (!item.eventLink) return currentView === item.id
    return eventSlugOfView(currentView, currentParams) === item.eventLink.slug
}

export function isEventLinkLive(eventLink: EventLink, today: Date): boolean {
    const [year, month, day] = eventLink.liveUntil.split('-').map(Number)
    const startOfDayAfter = new Date(year, month - 1, day + 1)
    return today.getTime() < startOfDayAfter.getTime()
}

export function newSinceVisitBadge(count: number | null | undefined): NavBadge | null {
    if (!count || count <= 0) return null
    return { count, live: false, details: [`${count} new since your last visit`] }
}
