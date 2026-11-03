import type { LeaderboardEntry } from '@/app/utils/api'
import { parseCompareQuery, serializeCompareQuery } from '../url/compareUrl'
import type { CompareModel } from './compareModel'
import { REPLAY, SET_ON, ZONES } from './laneModel'
import { formatRaceTime, MAX_VIDEO_TILES, NO_VIDEO, type LoadedVideos } from './raceModel'
import { sideGroupOf } from './referenceModel'
import { editableSet, editSet, type EditOutcome } from './setEdits'

export const VIDEO = 'Video'
export const IN_COMPARISON = 'In comparison'

export type TeamColour = 'any' | 'red' | 'blue'

export interface AddRunsFilters {
    search: string
    hasVideo: boolean
    hasReplay: boolean
    colour: TeamColour
}

export const NO_FILTERS: AddRunsFilters = { search: '', hasVideo: false, hasReplay: false, colour: 'any' }

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
    time: string
    video: RowVideo
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
}

export interface AddRunsModel {
    chips: AddChip[]
    rows: AddRow[]
    reference: string | null
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
        chip('wr', 'WR', [verified[0]]),
        ...(userId === null ? [] : [chip('pb', 'Your PB', [own[0]])]),
        chip('faster', 'Next faster', [faster[faster.length - 1]]),
        chip('slower', 'Next slower', [slower[0]]),
        chip('top3', 'Top 3', verified.slice(0, 3)),
    ]
}

function rowVideo(videos: LoadedVideos, capId: string): RowVideo {
    const video = videos.get(capId)
    if (video === undefined) return 'pending'
    return video ? 'video' : 'none'
}

function matches(entry: LeaderboardEntry, video: RowVideo, filters: AddRunsFilters): boolean {
    const search = filters.search.trim().toLowerCase()
    if (search && !(entry.alias ?? '').toLowerCase().includes(search)) return false
    if (filters.hasVideo && video !== 'video') return false
    if (filters.hasReplay && entry.has_ghost !== true) return false
    if (filters.colour !== 'any' && sideOf(entry) !== COLOUR_SIDE[filters.colour]) return false
    return true
}

function badgesOf(entry: LeaderboardEntry, video: RowVideo, inComparison: boolean): string[] {
    const side = sideOf(entry)
    return [
        ...(video === 'video' ? [VIDEO] : video === 'none' ? [NO_VIDEO] : []),
        ...(entry.has_ghost === true ? [REPLAY] : hasZones(entry) ? [ZONES] : []),
        ...(side === null ? [] : [SET_ON[side]]),
        ...(inComparison ? [IN_COMPARISON] : []),
    ]
}

export function addRunsModel({ entries, model, videos, userId, filters }: AddRunsInput): AddRunsModel {
    const listed = listedEntries(entries)
    const inSet = new Set(setRuns(model))
    const reference = chipReference(model)
    const pinned = [...listed.filter(entry => entry.id === reference), ...listed.filter(entry => entry.id !== reference)]
    const rows = pinned.flatMap(entry => {
        const video = rowVideo(videos, entry.id)
        if (!matches(entry, video, filters)) return []
        const inComparison = inSet.has(entry.id)
        return [{
            capId: entry.id,
            entry,
            time: formatRaceTime(entry.cap_time_seconds),
            video,
            badges: badgesOf(entry, video, inComparison),
            inComparison,
            reference: entry.id === reference,
        }]
    })
    return { chips: chipsFor(listed, model, inSet, userId), rows, reference }
}

export function pastVideoTilesNote(count: number): string | null {
    if (count === 0) return null
    const who = count === 1 ? 'Joined' : `${count} runs joined`
    return `${who} as data-only: ${MAX_VIDEO_TILES} videos already play.`
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
    if (!settled.runs.every(run => requested.has(run.capId))) return composed
    return { ...settled, query: composed.query }
}
