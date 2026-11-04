import type { TeamLeaderboardEntry, TeamRunMember } from '@/app/utils/api'
import { serializeCompareQuery } from '../url/compareUrl'
import { dataMatches, isOlderVideo, mixedEntrySides, runDataOf, videoMatches, type AddChip, type AddRunsFilters, type ChipId, type RowVideo, type SetChange, type TeamColour } from './addRuns'
import { stateOf, type CompareModel } from './compareModel'
import { CHECKPOINTS_ONLY, FINAL_TIME_ONLY } from './laneModel'
import { formatRaceTime, GRAPH_ONLY, MAX_VIDEO_TILES, type LoadedVideos } from './raceModel'
import { editableSet, editSet, type EditOutcome } from './setEdits'

export interface TeamAddMember {
    capId: string
    member: TeamRunMember
    video: RowVideo
    older: boolean
    side: number | null
    badges: string[]
}

export interface TeamAddRow {
    teamCapId: string
    entry: TeamLeaderboardEntry
    rank: number
    time: string
    members: TeamAddMember[]
    inComparison: boolean
    reference: boolean
}

export interface TeamAddRunsInput {
    entries: readonly TeamLeaderboardEntry[]
    model: CompareModel
    videos: LoadedVideos
    userId: string | null
    filters: AddRunsFilters
    picked?: readonly string[]
}

export interface TeamAddRunsModel {
    chips: AddChip[]
    rows: TeamAddRow[]
    reference: string | null
    mixed: boolean
}

const COLOUR_SIDE: Record<Exclude<TeamColour, 'any'>, number> = { red: 0, blue: 1 }

function sideOf(member: TeamRunMember): number | null {
    return member.team === 0 || member.team === 1 ? member.team : null
}

export function listedTeamEntries(entries: readonly TeamLeaderboardEntry[]): TeamLeaderboardEntry[] {
    return entries
        .filter(entry => entry.id && entry.disallowed !== true && entry.complete !== false && Number.isFinite(entry.cap_time_seconds))
        .sort((a, b) => a.cap_time_seconds - b.cap_time_seconds)
}

function rowVideo(videos: LoadedVideos, capId: string): RowVideo {
    const video = videos.get(capId)
    if (video === undefined) return 'pending'
    return video ? 'video' : 'none'
}

function memberBadges(member: TeamRunMember, video: RowVideo): string[] {
    return [
        ...(video === 'none' ? [GRAPH_ONLY] : []),
        ...(member.has_ghost === true ? [] : member.has_zones === true ? [CHECKPOINTS_ONLY] : [FINAL_TIME_ONLY]),
    ]
}

function matches(entry: TeamLeaderboardEntry, members: readonly TeamAddMember[], videos: LoadedVideos, filters: AddRunsFilters): boolean {
    const search = filters.search.trim().toLowerCase()
    if (search && !entry.members.some(member => (member.alias ?? '').toLowerCase().includes(search))) return false
    if (!members.some(member => videoMatches(filters.video, videos.get(member.capId)))) return false
    if (!entry.members.some(member => dataMatches(filters.data, runDataOf(member.has_ghost, member.has_zones === true)))) return false
    if (filters.colour !== 'any' && !entry.members.some(member => sideOf(member) === COLOUR_SIDE[filters.colour as Exclude<TeamColour, 'any'>])) return false
    return true
}

function chipsFor(listed: readonly TeamLeaderboardEntry[], model: CompareModel, inSet: ReadonlySet<string>, userId: string | null): AddChip[] {
    const verified = listed.filter(entry => entry.verified)
    const reference = model.teams.rows.find(row => row.reference)
    const referenceTime = reference?.team.timeSeconds ?? null
    const others = verified.filter(entry => entry.id !== reference?.teamCapId)
    const faster = referenceTime === null ? [] : others.filter(entry => entry.cap_time_seconds < referenceTime)
    const slower = referenceTime === null ? [] : others.filter(entry => entry.cap_time_seconds > referenceTime)
    const own = userId === null ? [] : listed.filter(entry => entry.members.some(member => String(member.user) === userId))
    const chip = (id: ChipId, label: string, targets: readonly (TeamLeaderboardEntry | undefined)[]): AddChip => {
        const capIds = targets.flatMap(target => (target ? [target.id] : []))
        return { id, label, capIds, disabled: capIds.length === 0 || capIds.every(capId => inSet.has(capId)) }
    }
    return [
        chip('wr', 'World Record', [verified[0]]),
        ...(userId === null ? [] : [chip('pb', 'Your Best', [own[0]])]),
        ...(model.teams.rows.length === 0 ? [] : [
            chip('faster', 'Next Faster', [faster[faster.length - 1]]),
            chip('slower', 'Next Slower', [slower[0]]),
        ]),
        chip('top3', 'Top 3', verified.slice(0, 3)),
    ]
}

export function teamAddRunsModel({ entries, model, videos, userId, filters, picked }: TeamAddRunsInput): TeamAddRunsModel {
    const listed = listedTeamEntries(entries)
    const inSet = new Set(picked ?? stateOf(model).runs)
    const reference = model.teams.reference
    const ranks = new Map(listed.map((entry, i) => [entry.id, i + 1]))
    const pinned = [...listed.filter(entry => entry.id === reference), ...listed.filter(entry => entry.id !== reference)]
    const rows = pinned.flatMap((entry): TeamAddRow[] => {
        const members = entry.members.map((member): TeamAddMember => {
            const video = rowVideo(videos, member.cap_id)
            return { capId: member.cap_id, member, video, older: isOlderVideo(videos.get(member.cap_id)), side: sideOf(member), badges: memberBadges(member, video) }
        })
        if (!matches(entry, members, videos, filters)) return []
        return [{
            teamCapId: entry.id,
            entry,
            rank: ranks.get(entry.id) ?? 0,
            time: formatRaceTime(entry.cap_time_seconds),
            members,
            inComparison: inSet.has(entry.id),
            reference: entry.id === reference,
        }]
    })
    return { chips: chipsFor(listed, model, inSet, userId), rows, reference, mixed: mixedEntrySides(listed.flatMap(entry => entry.members.map(sideOf))) }
}

export function pastVideoPovsNote(count: number): string | null {
    if (count === 0) return null
    const who = count === 1 ? 'Joined' : `${count} POVs joined`
    return `${who} as a graph only: ${MAX_VIDEO_TILES} videos already play.`
}

function freeVideoTiles(model: CompareModel, entries: readonly TeamLeaderboardEntry[], videos: LoadedVideos): number {
    const { runs, data } = stateOf(model)
    const loaded = new Set(model.teams.rows.map(row => row.teamCapId))
    const dataOnly = new Set(data)
    const pending = runs
        .filter(capId => !loaded.has(capId))
        .flatMap(capId => entries.find(entry => entry.id === capId)?.members ?? [])
        .filter(member => !dataOnly.has(member.cap_id) && videos.get(member.cap_id) !== null)
    return MAX_VIDEO_TILES - model.race.tiles.length - pending.length
}

export function addTeamRunsEdit(model: CompareModel, teamCapIds: readonly string[], entries: readonly TeamLeaderboardEntry[], videos: LoadedVideos): SetChange {
    let set = editableSet(model)
    const missing = teamCapIds.filter(capId => !set.state.runs.includes(capId))
    let outcome: EditOutcome = { query: serializeCompareQuery({ ...set.state, t: null }), blocked: null }
    for (const capId of missing) {
        outcome = editSet(set, { kind: 'add', capId })
        if (outcome.query === null) return { outcome, note: null }
        set = { ...set, state: { ...set.state, runs: [...set.state.runs, capId] } }
    }
    let free = freeVideoTiles(model, entries, videos)
    let past = 0
    missing
        .flatMap(capId => entries.find(entry => entry.id === capId)?.members ?? [])
        .filter(member => videos.get(member.cap_id) !== null)
        .forEach(() => {
            if (free > 0) free -= 1
            else past += 1
        })
    return { outcome, note: pastVideoPovsNote(past) }
}

export function toggleTeamRunEdit(model: CompareModel, teamCapId: string, entries: readonly TeamLeaderboardEntry[], videos: LoadedVideos): SetChange {
    if (!stateOf(model).runs.includes(teamCapId)) return addTeamRunsEdit(model, [teamCapId], entries, videos)
    return { outcome: editSet(editableSet(model), { kind: 'remove', capId: teamCapId }), note: null }
}
