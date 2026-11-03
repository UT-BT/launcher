import { recordedFixtureSet } from '../recording'
import type { FixtureSet } from '../types'

export const RUN_COMPARE_SET: FixtureSet = {
    name: 'run-compare',
    routes: recordedFixtureSet('cap-detail').routes,
}
