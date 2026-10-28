import { EMPTY_STAT, teamNames, teamPageTeams } from '@/app/components/pages/events/stats/statsView'
import { formatZoned, parseApiInstant } from '@/app/utils/timezone'
import type { EventStatsResult, EventTeamRun, EventTeamStats } from '@/app/utils/api'

export type TeamRunSortKey = 'map' | 'time' | 'opponent' | 'stage' | 'date'

export interface TeamRunSort {
    key: TeamRunSortKey
    dir: 'asc' | 'desc'
}

export const DEFAULT_TEAM_RUN_SORT: TeamRunSort = { key: 'time', dir: 'asc' }

export const COMPACT_RUN_SORTS: readonly { key: TeamRunSortKey; label: string }[] = [
    { key: 'time', label: 'Time' },
    { key: 'map', label: 'Map' },
    { key: 'date', label: 'Date' },
]

export const COMPACT_RUN_LIMIT = 12

export function nextTeamRunSort(current: TeamRunSort, key: TeamRunSortKey): TeamRunSort {
    if (current.key !== key) return { key, dir: 'asc' }
    return { key, dir: current.dir === 'asc' ? 'desc' : 'asc' }
}

function stagePlayOrder(stats: EventTeamStats): Map<string, number> {
    const order = new Map<string, number>()
    for (const match of stats.matches) {
        if (!order.has(match.stage_key)) order.set(match.stage_key, order.size)
    }
    for (const run of stats.runs) {
        if (!order.has(run.stage_key)) order.set(run.stage_key, order.size)
    }
    return order
}

type RunComparator = (a: EventTeamRun, b: EventTeamRun) => number

function columnComparator(stats: EventTeamStats, key: TeamRunSortKey): RunComparator {
    switch (key) {
        case 'map':
            return (a, b) => a.display_name.localeCompare(b.display_name)
        case 'opponent': {
            const names = teamNames(teamPageTeams(stats))
            return (a, b) => (names[a.opponent_id] ?? 'TBD').localeCompare(names[b.opponent_id] ?? 'TBD')
        }
        case 'stage': {
            const order = stagePlayOrder(stats)
            return (a, b) => order.get(a.stage_key)! - order.get(b.stage_key)!
        }
        case 'date':
            return (a, b) => Date.parse(a.completed_at) - Date.parse(b.completed_at)
        case 'time':
            return (a, b) => a.team_time_seconds - b.team_time_seconds
    }
}

export function sortTeamRuns(stats: EventTeamStats, sort: TeamRunSort): EventTeamRun[] {
    const compare = columnComparator(stats, sort.key)
    const sign = sort.dir === 'asc' ? 1 : -1
    return [...stats.runs].sort((a, b) => sign * compare(a, b) || a.team_time_seconds - b.team_time_seconds)
}

export function teamRunsPage<T>(rows: readonly T[], showAll: boolean): { rows: T[]; showAllLabel: string | null } {
    if (showAll || rows.length <= COMPACT_RUN_LIMIT) return { rows: [...rows], showAllLabel: null }
    return { rows: rows.slice(0, COMPACT_RUN_LIMIT), showAllLabel: `Show all ${rows.length} runs` }
}

export function runDateText(iso: string, timezone: string): string {
    const at = parseApiInstant(iso)
    return at === null ? EMPTY_STAT : formatZoned(at, timezone, { day: 'numeric', month: 'short' })
}

export interface WdlBarSegment {
    result: EventStatsResult
    width: string
}

export function wdlBarSegments(shares: { w: number; d: number; l: number }): WdlBarSegment[] {
    const entries: [EventStatsResult, number][] = [['W', shares.w], ['D', shares.d], ['L', shares.l]]
    return entries.filter(([, share]) => share > 0).map(([result, share]) => ({ result, width: `${share * 100}%` }))
}
