import { heading } from './steps'
import type { MobileRouteEntry } from './types'

export const TEAM_ID = '9ca5c141-f968-4bf1-b05f-2bd2af0611b3'

export const teamDetail: MobileRouteEntry = {
    view: 'team-detail',
    tier: 'public',
    path: `/teams/${TEAM_ID}`,
    fixtures: 'team-detail',
    decorative: [],
    ready: heading('fierd_'),
    stress: { pr: 'long-text' },
}
