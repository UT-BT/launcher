import type { LeaderboardEntry, ReplayVideo } from '@/app/utils/api'
import { parseCompareQuery, serializeCompareQuery } from '../url/compareUrl'
import type { CompareModel } from './compareModel'
import { CHECKPOINTS_ONLY, FINAL_TIME_ONLY } from './laneModel'
import { formatRaceTime, GRAPH_ONLY, MAX_VIDEO_TILES, type LoadedVideos } from './raceModel'
import { sideGroupOf } from './referenceModel'
import { editableSet, editSet, type EditOutcome } from './setEdits'

export type TeamColour = 'any' | 'red' | 'blue'

export type VideoFilter = 'any' | 'video' | 'utrecorder' | 'democonverter' | 'none'

export type RunData = 'replay' | 'zones' | 'time'

export type DataFilter = 'any' | RunData

export interface AddRunsFilters {
    search: string
    video: VideoFilter
    data: DataFilter
    colour: TeamColour
}

export const NO_FILTERS: AddRunsFilters = { search: '', video: 'any', data: 'any', colour: 'any' }

export const VIDEO_FILTERS: { value: VideoFilter; label: string }[] = [
    { value: 'any', label: 'Any' },
    { value: 'video', label: 'Has Video' },
    { value: 'utrecorder', label: 'UTRecorder' },
    { value: 'democonverter', label: 'DemoConverter' },
    { value: 'none', label: 'No Video' },
]

export const DATA_FILTERS: { value: DataFilter; label: string }[] = [
    { value: 'any', label: 'Any' },
    { value: 'replay', label: 'Full Replay' },
    { value: 'zones', label: 'Checkpoints Only' },
    { value: 'time', label: 'Final Time Only' },
]

export function activeFilters(filters: AddRunsFilters): number {
    return (filters.video === 'any' ? 0 : 1) + (filters.data === 'any' ? 0 : 1)
}

export function videoMatches(filter: VideoFilter, video: ReplayVideo | null | undefined): boolean {
    switch (filter) {
        case 'any': return true
        case 'video': return Boolean(video)
        case 'utrecorder': return video?.source === 'utrecorder'
        case 'democonverter': return video?.source === 'democonverter'
        case 'none': return video === null
    }
}

export function runDataOf(hasGhost: boolean | null | undefined, zones: boolean): RunData {
    if (hasGhost === true) return 'replay'
    return zones ? 'zones' : 'time'
}

export function dataMatches(filter: DataFilter, data: RunData): boolean {
    return filter === 'any' || filter === data
}

export function isOlderVideo(video: ReplayVideo | null | undefined): boolean {
    return video?.source === 'democonverter'
}

export type ChipId = 'wr' | 'pb' | 'faster' | 'slower' | 'top3'

export interface AddChip {
    id: ChipId
    label: string
    capIds: string[]
    disabled: boolean
}

export type RowVideo = 'video' | 'none' | 'pending'

export interface AddRow {
    capId: string
    entry: LeaderboardEntry
    rank: number
    time: string
    video: RowVideo
    older: boolean
    side: number | null
    badges: string[]
    inComparison: boolean
    reference: boolean
}

export interface AddRunsInput {
    entries: readonly LeaderboardEntry[]
    model: CompareModel
    videos: LoadedVideos
    userId: string | null
    filters: AddRunsFilters
    picked?: readonly string[]
}

export interface AddRunsModel {
    chips: AddChip[]
    rows: AddRow[]
    reference: string | null
    mixed: boolean
}

export interface SetChange {
    outcome: EditOutcome
    note: string | null
}

const COLOUR_SIDE: Record<Exclude<TeamColour, 'any'>, number> = { red: 0, blue: 1 }

export function sideOf(entry: LeaderboardEntry): number | null {
    return entry.team === 0 || entry.team === 1 ? entry.team : null
}

export function hasZones(entry: LeaderboardEntry): boolean {
    return /[^;\s]/.test(entry.zone_checkpoints ?? '')
}

export function listedEntries(entries: readonly LeaderboardEntry[]): LeaderboardEntry[] {
    return entries
        .filter(entry => entry.id && entry.disallowed !== true)
        .sort((a, b) => a.cap_time_seconds - b.cap_time_seconds)
}

export function chipReference(model: CompareModel): string | null {
    const [first] = model.runs
    if (!first) return null
    const side = sideGroupOf(model.runs)(first)
    return model.race.references.sides.find(entry => entry.side === side)?.capId ?? null
}

function setRuns(model: CompareModel): string[] {
    return parseCompareQuery(model.query).state.runs
}

function chipsFor(listed: readonly LeaderboardEntry[], model: CompareModel, inSet: ReadonlySet<string>, userId: string | null): AddChip[] {
    const verified = listed.filter(entry => entry.verified)
    const referenceId = chipReference(model)
    const referenceTime = model.runs.find(run => run.capId === referenceId)?.timeSeconds ?? null
    const faster = referenceTime === null ? [] : verified.filter(entry => entry.id !== referenceId && entry.cap_time_seconds < referenceTime)
    const slower = referenceTime === null ? [] : verified.filter(entry => entry.id !== referenceId && entry.cap_time_seconds > referenceTime)
    const own = userId === null ? [] : listed.filter(entry => String(entry.user) === userId)
    const chip = (id: ChipId, label: string, targets: readonly (LeaderboardEntry | undefined)[]): AddChip => {
        const capIds = targets.flatMap(target => (target ? [target.id] : []))
        return { id, label, capIds, disabled: capIds.length === 0 || capIds.every(capId => inSet.has(capId)) }
    }
    return [
        chip('wr', 'World Record', [verified[0]]),
        ...(userId === null ? [] : [chip('pb', 'Your Best', [own[0]])]),
        ...(model.runs.length === 0 ? [] : [
            chip('faster', 'Next Faster', [faster[faster.length - 1]]),
            chip('slower', 'Next Slower', [slower[0]]),
        ]),
        chip('top3', 'Top 3', verified.slice(0, 3)),
    ]
}

function rowVideo(videos: LoadedVideos, capId: string): RowVideo {
    const video = videos.get(capId)
    if (video === undefined) return 'pending'
    return video ? 'video' : 'none'
}

function matches(entry: LeaderboardEntry, video: ReplayVideo | null | undefined, filters: AddRunsFilters): boolean {
    const search = filters.search.trim().toLowerCase()
    if (search && !(entry.alias ?? '').toLowerCase().includes(search)) return false
    if (!videoMatches(filters.video, video)) return false
    if (!dataMatches(filters.data, runDataOf(entry.has_ghost, hasZones(entry)))) return false
    if (filters.colour !== 'any' && sideOf(entry) !== COLOUR_SIDE[filters.colour]) return false
    return true
}

function badgesOf(entry: LeaderboardEntry, video: RowVideo): string[] {
    return [
        ...(video === 'none' ? [GRAPH_ONLY] : []),
        ...(entry.has_ghost === true ? [] : hasZones(entry) ? [CHECKPOINTS_ONLY] : [FINAL_TIME_ONLY]),
    ]
}

export function mixedEntrySides(sides: readonly (number | null)[]): boolean {
    return new Set(sides.filter(side => side !== null)).size > 1
}

export function addRunsModel({ entries, model, videos, userId, filters, picked }: AddRunsInput): AddRunsModel {
    const listed = listedEntries(entries)
    const inSet = new Set(picked ?? setRuns(model))
    const reference = chipReference(model)
    const ranks = new Map(listed.map((entry, i) => [entry.id, i + 1]))
    const pinned = [...listed.filter(entry => entry.id === reference), ...listed.filter(entry => entry.id !== reference)]
    const rows = pinned.flatMap(entry => {
        const loaded = videos.get(entry.id)
        if (!matches(entry, loaded, filters)) return []
        const video = rowVideo(videos, entry.id)
        return [{
            capId: entry.id,
            entry,
            rank: ranks.get(entry.id) ?? 0,
            time: formatRaceTime(entry.cap_time_seconds),
            video,
            older: isOlderVideo(loaded),
            side: sideOf(entry),
            badges: badgesOf(entry, video),
            inComparison: inSet.has(entry.id),
            reference: entry.id === reference,
        }]
    })
    return { chips: chipsFor(listed, model, inSet, userId), rows, reference, mixed: mixedEntrySides(listed.map(sideOf)) }
}

export function pastVideoTilesNote(count: number): string | null {
    if (count === 0) return null
    const who = count === 1 ? 'Joined' : `${count} runs joined`
    return `${who} as a graph only: ${MAX_VIDEO_TILES} videos already play.`
}

function freeVideoTiles(model: CompareModel, videos: LoadedVideos): number {
    const { runs, data } = parseCompareQuery(model.query).state
    const loaded = new Set(model.runs.map(run => run.capId))
    const dataOnly = new Set(data)
    const pending = runs.filter(capId => !loaded.has(capId) && !dataOnly.has(capId) && videos.get(capId) !== null)
    return MAX_VIDEO_TILES - model.race.tiles.length - pending.length
}

export function addRunsEdit(model: CompareModel, capIds: readonly string[], videos: LoadedVideos): SetChange {
    let set = editableSet(model)
    const missing = capIds.filter(capId => !set.state.runs.includes(capId))
    let outcome: EditOutcome = { query: serializeCompareQuery({ ...set.state, t: null }), blocked: null }
    for (const capId of missing) {
        outcome = editSet(set, { kind: 'add', capId })
        if (outcome.query === null) return { outcome, note: null }
        set = { ...set, state: parseCompareQuery(outcome.query).state }
    }
    let free = freeVideoTiles(model, videos)
    let past = 0
    for (const capId of missing) {
        if (videos.get(capId) === null) continue
        if (free > 0) free -= 1
        else past += 1
    }
    return { outcome, note: pastVideoTilesNote(past) }
}

export function toggleRunEdit(model: CompareModel, capId: string, videos: LoadedVideos): SetChange {
    if (!setRuns(model).includes(capId)) return addRunsEdit(model, [capId], videos)
    return { outcome: editSet(editableSet(model), { kind: 'remove', capId }), note: null }
}

export function holdWhileAdding(composed: CompareModel, settled: CompareModel | null): CompareModel {
    if (!composed.loading || !settled || settled.loading || settled.runs.length === 0) return composed
    const requested = new Set(parseCompareQuery(composed.query).state.runs)
    if (!parseCompareQuery(settled.query).state.runs.every(capId => requested.has(capId))) return composed
    return { ...settled, query: composed.query }
}
