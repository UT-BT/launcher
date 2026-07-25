import { displayMapName } from '@/app/utils/format'
import type { NavParams } from './NavigationContext'

export const SITE_NAME = 'UTBT.net'

/**
 * Tab title for a route, from the nav entry alone — no data fetch.
 *
 * Detail pages whose identifier is opaque (a Discord id, a uuid) get a generic
 * label here and are refined by `useDocumentTitle` once the page has its
 * payload. Mirrors the view list in `viewToPath`; `routes.contract.test.ts`
 * fails if the two drift.
 */
export function titleForRoute(view: string, params: NavParams): string {
    switch (view) {
        case 'home':
            return `${SITE_NAME} — Unreal Tournament BunnyTrack records & community`
        case 'servers':
            return `Servers — ${SITE_NAME}`
        case 'maps':
            return params.mapsNewOnly ? `New maps — ${SITE_NAME}` : `Maps — ${SITE_NAME}`
        case 'maps-detail':
            return params.mapName ? `${displayMapName(params.mapName)} — ${SITE_NAME}` : `Map — ${SITE_NAME}`
        case 'players':
            return `Players — ${SITE_NAME}`
        case 'player-detail':
            return `Player — ${SITE_NAME}`
        case 'teams':
            return `Teams — ${SITE_NAME}`
        case 'team-detail':
            return `Team — ${SITE_NAME}`
        case 'events':
            return `Events — ${SITE_NAME}`
        case 'event-detail':
            return `Event — ${SITE_NAME}`
        case 'world-records':
            return `World records — ${SITE_NAME}`
        case 'cap-it-all':
            return `Cap It All — ${SITE_NAME}`
        case 'cap-detail':
            return `Cap — ${SITE_NAME}`
        case 'team-cap-detail':
            return `Team cap — ${SITE_NAME}`
        case 'achievements':
            return `Achievements — ${SITE_NAME}`
        case 'news':
            return `News — ${SITE_NAME}`
        case 'news-detail':
            return `News — ${SITE_NAME}`
        case 'admin':
            return `Admin — ${SITE_NAME}`
        default:
            return SITE_NAME
    }
}
