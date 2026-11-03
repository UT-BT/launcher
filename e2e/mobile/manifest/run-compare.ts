import { CAP_ID } from './cap-detail'
import { shows } from './steps'
import type { MobileRouteEntry } from './types'

const RIVAL_ID = '418b0aec-34c5-40e7-acf4-f2bc33373063'

export const runCompare: MobileRouteEntry = {
    view: 'run-compare',
    tier: 'public',
    path: `/compare?runs=${CAP_ID},${RIVAL_ID}`,
    fixtures: 'run-compare',
    decorative: [],
    ready: shows(page => page.getByRole('region', { name: 'Playback' })),
}
