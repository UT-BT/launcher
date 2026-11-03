import type { FixtureSet } from '../types'
import { ADMIN_SET } from './admin'
import { EVENT_MANAGER_SET } from './event-manager'
import { MAPS_SIGNED_IN_SET } from './maps-signed-in'
import { PICKBAN_CAPTAIN_SET, PICKBAN_MANAGER_SET } from './pickban'
import { RUN_COMPARE_SET } from './run-compare'
import { SIGNED_IN_SET } from './signed-in'

export const SYNTHETIC_SETS: readonly FixtureSet[] = [
    ADMIN_SET,
    EVENT_MANAGER_SET,
    MAPS_SIGNED_IN_SET,
    PICKBAN_CAPTAIN_SET,
    PICKBAN_MANAGER_SET,
    RUN_COMPARE_SET,
    SIGNED_IN_SET,
]
