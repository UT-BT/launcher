import type { TeamCore, TeamDetail, TeamSort } from '@/app/utils/api'
import type { TeamAccessFilter } from './teams/TeamGallery'

export interface TeamsPageState {
    directorySearch: string
    directoryAccess: TeamAccessFilter
    directorySort: TeamSort
    directorySortDir: 'asc' | 'desc'
}

export interface TeamsPageCaches {
    myTeam: TeamDetail | null
    invitations: TeamCore[]
    directory: TeamCore[]
    directorySig: string | null
    loaded: boolean
    lastRefreshIso: string | null
}

export const DEFAULT_TEAMS_STATE: TeamsPageState = {
    directorySearch: '',
    directoryAccess: 'all',
    directorySort: 'world_records',
    directorySortDir: 'desc',
}

export const DEFAULT_TEAMS_CACHES: TeamsPageCaches = {
    myTeam: null,
    invitations: [],
    directory: [],
    directorySig: null,
    loaded: false,
    lastRefreshIso: null,
}
