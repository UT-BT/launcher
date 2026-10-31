import type { TeamRunState } from './api'

const TEAM_RUN_STATE_LABELS: Record<TeamRunState, string> = {
    incomplete: 'Incomplete',
    pending: 'Pending',
    verified: 'Verified',
    disallowed: 'Disallowed',
}

export function teamRunStateLabel(state: TeamRunState): string {
    return TEAM_RUN_STATE_LABELS[state]
}
