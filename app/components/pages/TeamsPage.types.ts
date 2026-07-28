import type { TeamCore, TeamDetail, TeamSort } from '@/app/utils/api'
import type { TeamAccessFilter } from './teams/TeamGallery'

export interface TeamsPageState {
    directorySearch: string
    directoryPage: number
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
    directoryPage: 1,
    directoryAccess: 'all',
    directorySort: 'added',
    directorySortDir: 'asc',
    scrollTop: 0,
}

export const DEFAULT_TEAMS_CACHES: TeamsPageCaches = {
    myTeam: null,
    invitations: [],
    loaded: false,
    lastRefreshIso: null,
}
