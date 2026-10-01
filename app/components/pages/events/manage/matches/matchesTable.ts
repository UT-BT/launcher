import { parseApiInstant } from '@/app/utils/timezone'
import type {
    EventBracket, EventBracketEntrant, EventBracketTeamRef, EventMatch, EventMatchAdmin, EventMatchStatus,
    EventStreamer,
} from '@/app/utils/api'

export type MatchStatusFilter = 'open' | 'finished' | 'all'
export type MatchStaffFilter = 'all' | 'needs_admin' | 'needs_streamer'

export interface MatchesFilter {
    stage: string
    status: MatchStatusFilter
    staff: MatchStaffFilter
    search: string
}

export const ALL_STAGES = 'all'

export const DEFAULT_MATCHES_FILTER: MatchesFilter = { stage: ALL_STAGES, status: 'open', staff: 'all', search: '' }

export interface MatchRow {
    match: EventMatch
    stageKey: string
    stageName: string
    roundLabel: string
    teamAName: string
    teamBName: string
    score: string | null
    open: boolean
    streamer: EventStreamer | null
    matchAdmin: EventMatchAdmin | null
    entrants: EventBracketEntrant[]
    drawsAllowed: boolean
}

export interface MatchesSummary {
    open: number
    withoutAdmin: number
    withoutStreamer: number
}

export interface MatchStaffPatch {
    streamer?: EventStreamer | null
    match_admin?: EventMatchAdmin | null
}

const OPEN_STATUSES: readonly EventMatchStatus[] = ['pending', 'scheduled', 'live']

export function isOpenMatch(status: EventMatchStatus): boolean {
    return OPEN_STATUSES.includes(status)
}

function teamName(team: EventBracketTeamRef | null, slotLabel: string | null): string {
    return team?.name || slotLabel || 'TBD'
}

function scoreOf(match: EventMatch): string | null {
    if (match.score_a === null || match.score_b === null) return null
    if (!isOpenMatch(match.status) || match.status === 'live') return `${match.score_a}–${match.score_b}`
    return null
}

function startsAt(row: MatchRow): number {
    return parseApiInstant(row.match.scheduled_at) ?? Number.POSITIVE_INFINITY
}

function byScheduleThenBracketOrder(stageOrder: Map<string, number>) {
    return (left: MatchRow, right: MatchRow): number => {
        const leftAt = startsAt(left)
        const rightAt = startsAt(right)
        if (leftAt !== rightAt) return leftAt < rightAt ? -1 : 1

        return (stageOrder.get(left.stageKey) ?? 0) - (stageOrder.get(right.stageKey) ?? 0)
            || left.match.round_no - right.match.round_no
            || left.match.ordinal - right.match.ordinal
            || left.match.id.localeCompare(right.match.id)
    }
}

export function matchRows(bracket: EventBracket | null): MatchRow[] {
    const stages = bracket?.stages ?? []
    const stageOrder = new Map(stages.map(stage => [stage.key, stage.ordinal]))

    return stages
        .flatMap(stage => stage.matches.map((match): MatchRow => ({
            match,
            stageKey: stage.key,
            stageName: stage.name,
            roundLabel: match.round_label || `Round ${match.round_no}`,
            teamAName: teamName(match.team_a, match.slot_a_label),
            teamBName: teamName(match.team_b, match.slot_b_label),
            score: scoreOf(match),
            open: isOpenMatch(match.status),
            streamer: match.streamer ?? null,
            matchAdmin: match.match_admin ?? null,
            entrants: stage.entrants,
            drawsAllowed: stage.kind === 'groups',
        })))
        .sort(byScheduleThenBracketOrder(stageOrder))
}

function matchesStatus(row: MatchRow, status: MatchStatusFilter): boolean {
    if (status === 'all') return true
    return status === 'open' ? row.open : !row.open
}

function matchesStaff(row: MatchRow, staff: MatchStaffFilter): boolean {
    if (staff === 'needs_admin') return row.matchAdmin === null
    if (staff === 'needs_streamer') return row.streamer === null
    return true
}

function matchesSearch(row: MatchRow, search: string): boolean {
    const needle = search.trim().toLocaleLowerCase()
    if (!needle) return true

    return [row.teamAName, row.teamBName, row.streamer?.display_name, row.matchAdmin?.display_name]
        .some(value => value?.toLocaleLowerCase().includes(needle))
}

export function filterMatchRows(rows: MatchRow[], filter: MatchesFilter): MatchRow[] {
    return rows.filter(row =>
        (filter.stage === ALL_STAGES || row.stageKey === filter.stage)
        && matchesStatus(row, filter.status)
        && matchesStaff(row, filter.staff)
        && matchesSearch(row, filter.search))
}

export function matchesSummary(rows: MatchRow[]): MatchesSummary {
    const open = rows.filter(row => row.open)

    return {
        open: open.length,
        withoutAdmin: open.filter(row => row.matchAdmin === null).length,
        withoutStreamer: open.filter(row => row.streamer === null).length,
    }
}

export function withMatchStaff(bracket: EventBracket, matchId: string, patch: MatchStaffPatch): EventBracket {
    return {
        ...bracket,
        stages: bracket.stages.map(stage => (stage.matches.some(match => match.id === matchId)
            ? { ...stage, matches: stage.matches.map(match => (match.id === matchId ? { ...match, ...patch } : match)) }
            : stage)),
    }
}

export function staffChoices<T extends { id: string }>(people: T[], current: T | null): T[] {
    if (!current || people.some(person => person.id === current.id)) return people

    return [current, ...people]
}
