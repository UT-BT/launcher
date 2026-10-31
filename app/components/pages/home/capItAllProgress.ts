import type { UserSummary } from '@/app/utils/api'

export interface CapItAllTiles {
    rank: string
    teamCaps: string
    unavailable: boolean
}

export function capItAllTiles({ capItAll }: Pick<UserSummary, 'capItAll'>): CapItAllTiles {
    if (!capItAll) return { rank: '—', teamCaps: '—', unavailable: true }
    return {
        rank: capItAll.rank === null ? 'Unranked' : `#${capItAll.rank.toLocaleString()}`,
        teamCaps: capItAll.team_caps.toLocaleString(),
        unavailable: false,
    }
}
