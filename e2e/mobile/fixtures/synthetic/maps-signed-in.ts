import type { BestCap, MapReview } from '../../../../app/utils/api'
import { CAP_TYPE_UTBT_CERTIFIED } from '../../../../app/utils/capTypes'
import { ROLE } from '../../../../app/utils/roles'
import { dataFrom } from '../data'
import { recordedFixtureSet } from '../recording'
import { ok, type FixtureSet } from '../types'
import { VIEWER } from './people'
import { sessionRoutes } from './session'

const MAPS = recordedFixtureSet('maps')
const PAGE = 'active=true&limit=10&offset=0&order=desc&sort=added'
const REVIEWS = 'columns=aesthetics,learning,luck,overall,map_name,user'
const PB_FACTORS = [1, 1.04, 1.12, 1.3, 1.6, 2.2]

interface ShownMap {
    name: string
    world_record?: number | null
}

const shown = (dataFrom(MAPS).api('/maps', PAGE) as ShownMap[] | undefined) ?? []

const bestCaps: BestCap[] = shown.flatMap((map, index) => {
    const factor = PB_FACTORS[index]
    if (factor == null || !map.world_record) return []
    return [{
        map: map.name,
        cap_id: `00000000-0000-4000-b000-${String(index + 1).padStart(12, '0')}`,
        cap_time_seconds: Math.round(map.world_record * factor * 1000) / 1000,
        cap_type: CAP_TYPE_UTBT_CERTIFIED,
        verified: index !== 3,
    }]
})

const ownReviews: MapReview[] = shown.slice(0, 2).map((map, index) => ({
    id: 900_000 + index,
    map_name: map.name,
    user: VIEWER.id,
    aesthetics: 7 + index,
    learning: 5,
    luck: 3,
    difficulty: 4,
    overall: 8 - index,
}))

const publicReviews = (dataFrom(MAPS).api('/map_reviews', REVIEWS) as MapReview[] | undefined) ?? []

export const MAPS_SIGNED_IN_SET: FixtureSet = {
    name: 'maps-signed-in',
    routes: [
        ...sessionRoutes(ROLE.USER),
        { host: 'api', path: `/caps/capped_maps/${VIEWER.id}`, reply: ok(bestCaps) },
        { host: 'api', path: '/map_reviews', reply: ok([...ownReviews, ...publicReviews]) },
        ...MAPS.routes,
    ],
}
