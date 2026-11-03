import type { DeviceEnvironment } from '@/app/device/deviceEnvironment'
import { BASE_NAV_SECTIONS, type NavItem } from './nav-items'

const TAB_IDS = ['home', 'maps', 'world-records', 'events'] as const

export type BottomTabId = typeof TAB_IDS[number]

const TAB_OF_VIEW = new Map<string, BottomTabId>([
    ['home', 'home'],
    ['maps', 'maps'],
    ['maps-detail', 'maps'],
    ['world-records', 'world-records'],
    ['events', 'events'],
    ['event-detail', 'events'],
    ['match-pickban', 'events'],
    ['event-team', 'events'],
])

function navItemOf(id: BottomTabId): NavItem & { id: BottomTabId } {
    const item = BASE_NAV_SECTIONS.flatMap(section => section.items).find(candidate => candidate.id === id)
    if (!item) throw new Error(`no sidebar item for the ${id} tab`)
    return { ...item, id }
}

export const BOTTOM_TABS = TAB_IDS.map(navItemOf)

export function activeBottomTab(view: string): BottomTabId | null {
    return TAB_OF_VIEW.get(view) ?? null
}

export function showsBottomTabs(environment: Pick<DeviceEnvironment, 'touch' | 'belowLg' | 'orientation'>): boolean {
    return environment.touch && environment.belowLg && environment.orientation === 'portrait'
}
