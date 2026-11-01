import { MAPS_LIST } from '../fixtures/maps'
import type { MobileRouteEntry } from './types'

export const maps: MobileRouteEntry = {
    view: 'maps',
    tier: 'public',
    path: '/maps',
    fixtures: 'maps',
    storage: { 'utbt:mapsPageTutorial:v1': JSON.stringify({ seen: true, version: 1 }) },
    ready: async page => {
        await page.getByText(MAPS_LIST[0].name.replace(/^CTF-BT-/, ''), { exact: true }).first().waitFor()
    },
    subViews: [
        { id: 'new', label: 'New maps only', path: '/maps?new=1' },
    ],
}
