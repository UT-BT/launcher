import type { FixtureSet } from '../types'
import { ADMIN_SET } from './admin'
import { EVENT_MANAGER_SET } from './event-manager'
import { PICKBAN_CAPTAIN_SET, PICKBAN_MANAGER_SET } from './pickban'
import { SIGNED_IN_SET } from './signed-in'

export const SYNTHETIC_SETS: readonly FixtureSet[] = [
    ADMIN_SET,
    EVENT_MANAGER_SET,
    PICKBAN_CAPTAIN_SET,
    PICKBAN_MANAGER_SET,
    SIGNED_IN_SET,
]
