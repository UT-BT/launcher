import type { TeamSort } from '@/app/utils/api'

export const TEAM_STAT_SORTS: TeamSort[] = ['world_records', 'caps', 'playtime']

export function isTeamStatSort(sort: TeamSort): boolean {
    return TEAM_STAT_SORTS.includes(sort)
}

export function formatTeamHours(seconds: number | null | undefined): string {
    const total = Math.max(0, seconds ?? 0)
    const hours = total / 3600
    if (hours >= 1000) return `${(hours / 1000).toFixed(1)}k h`
    if (hours >= 10) return `${Math.round(hours)} h`
    if (hours >= 1) return `${hours.toFixed(1)} h`
    return `${Math.round(total / 60)} m`
}
