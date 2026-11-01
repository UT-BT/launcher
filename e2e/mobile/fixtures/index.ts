import { capDetailFixtures } from './cap-detail'
import { homeFixtures } from './home'
import { mapsFixtures } from './maps'
import type { FixtureSet } from './types'

export const FIXTURE_SETS: Readonly<Record<string, FixtureSet>> = Object.fromEntries(
    [homeFixtures, mapsFixtures, capDetailFixtures].map(set => [set.name, set]),
)
