import { signedInStorage } from '../fixtures/synthetic/session'
import { MAPS_PAGE, mapsReady } from './maps'
import { seen } from './steps'
import type { MobileRouteEntry } from './types'

export const mapsSignedIn: MobileRouteEntry = {
    view: 'maps',
    id: 'maps:signed-in',
    tier: 'role-gated',
    path: '/maps',
    fixtures: 'maps-signed-in',
    decorative: ['column 1'],
    storage: { ...seen('utbt:mapsPageTutorial:v1'), ...signedInStorage() },
    ready: mapsReady(MAPS_PAGE),
}
