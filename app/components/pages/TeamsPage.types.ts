import type { TeamCore, TeamDetail, TeamSort } from '@/app/utils/api'
import type { TeamAccessFilter } from './teams/TeamGallery'

export interface TeamsPageState {
    directorySearch: string
    directoryAccess: TeamAccessFilter
    directorySort: TeamSort
    directorySortDir: 'asc' | 'desc'
    scrollTop: number
}

export interface TeamsPageCaches {
    myTeam: TeamDetail | null
    invitations: TeamCore[]
    loaded: boolean
    lastRefreshIso: string | null
}

export const DEFAULT_TEAMS_STATE: TeamsPageState = {
    directorySearch: '',
    directoryAccess: 'all',
    directorySort: 'world_records',
    directorySortDir: 'desc',
    scrollTop: 0,
}

export const DEFAULT_TEAMS_CACHES: TeamsPageCaches = {
    myTeam: null,
    invitations: [],
    loaded: false,
    lastRefreshIso: null,
}
