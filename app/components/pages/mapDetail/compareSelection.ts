import type { LeaderboardEntry, TeamLeaderboardEntry } from '@/app/utils/api'
import { EMPTY_COMPARE_STATE, MAX_COMPARE_RUNS, serializeCompareQuery } from '@/app/components/pages/runCompare/url/compareUrl'

export const TEAM_COMPARE_LIMIT = 4

export interface CompareCandidate {
    id: string
    seconds: number
    disallowed: boolean
}

export interface CompareSelection {
    ids: string[]
    full: boolean
    note: string | null
}

export function soloCandidate(entry: LeaderboardEntry): CompareCandidate {
    return { id: entry.id, seconds: entry.cap_time_seconds, disallowed: entry.disallowed === true }
}

export function teamCandidate(entry: TeamLeaderboardEntry): CompareCandidate {
    return { id: String(entry.id), seconds: entry.cap_time_seconds, disallowed: entry.disallowed === true }
}

export function soloCandidates(entries: readonly LeaderboardEntry[]): CompareCandidate[] {
    return entries.map(soloCandidate)
}

export function teamCandidates(entries: readonly TeamLeaderboardEntry[]): CompareCandidate[] {
    return entries.map(teamCandidate)
}

function limitNote(team: boolean): string {
    return team
        ? `A comparison holds at most ${TEAM_COMPARE_LIMIT} team runs. Untick one to choose another.`
        : `A comparison holds at most ${MAX_COMPARE_RUNS} runs. Untick one to choose another.`
}

export function compareSelection(selected: readonly string[], candidates: readonly CompareCandidate[], team: boolean): CompareSelection {
    const limit = team ? TEAM_COMPARE_LIMIT : MAX_COMPARE_RUNS
    const wanted = new Set(selected)
    const ids = candidates
        .map((candidate, index) => ({ candidate, index }))
        .filter(({ candidate }) => wanted.has(candidate.id) && !candidate.disallowed)
        .sort((a, b) => a.candidate.seconds - b.candidate.seconds || a.index - b.index)
        .map(({ candidate }) => candidate.id)
        .filter((candidateId, index, all) => all.indexOf(candidateId) === index)
        .slice(0, limit)
    const full = ids.length >= limit
    return { ids, full, note: full ? limitNote(team) : null }
}

export function canTick(selection: CompareSelection, candidate: CompareCandidate): boolean {
    if (candidate.disallowed) return false
    return selection.ids.includes(candidate.id) || !selection.full
}

export function toggled(selection: CompareSelection, candidate: CompareCandidate): string[] {
    if (selection.ids.includes(candidate.id)) return selection.ids.filter(selectedId => selectedId !== candidate.id)
    if (!canTick(selection, candidate)) return selection.ids
    return [...selection.ids, candidate.id]
}

export function compareQueryOf(ids: readonly string[]): string {
    return serializeCompareQuery({ ...EMPTY_COMPARE_STATE, runs: [...ids] })
}
