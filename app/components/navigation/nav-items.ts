import type { ElementType } from 'react'
import { Home, Server, Map as MapIcon, Trophy, Globe, Users, Users2, Flag, Award, ShieldAlert, Newspaper, Swords } from 'lucide-react'
import type { NavParams } from './NavigationContext'
import { isStaff } from '@/app/utils/roles'
import type { UserProfile } from '@/app/utils/api'

export interface NavItem {
    id: string
    label: string
    icon: ElementType
    view?: string
    params?: NavParams
    tag?: string
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
            { id: 'cup-2v2-2026', label: '2v2 Cup', icon: Globe, view: 'event-detail', params: { eventSlug: '2v2-cup-2026' }, tag: 'Live' },
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

export function navItemDestination(item: NavItem): { view: string, params: NavParams } {
    return { view: item.view ?? item.id, params: item.params ?? {} }
}

export function isNavItemActive(item: NavItem, currentView: string, currentParams: NavParams): boolean {
    if (!item.params) {
        return currentView === (item.view ?? item.id)
    }
    if (currentView !== 'event-detail' && currentView !== 'match-pickban') return false
    return currentParams.eventSlug === item.params.eventSlug
}
