import { formatSignedDelta } from '@/app/components/pages/capDetail/capStats'
import { formatCapTime } from '@/app/utils/format'
import type { ReplaySource, ReplayVideo } from '@/app/utils/api'
import type { SoloRun } from '../loading/soloRuns'
import { EMPTY_COMPARE_STATE, type CompareUrlState } from '../url/compareUrl'
import { resolveReferences, type References } from './referenceModel'
import { packStage, type StageBox, type StageLayout } from './stageLayout'

export const MAX_VIDEO_TILES = 8
export const NO_VIDEO = 'No video'
export const VIDEO_UNAVAILABLE = 'Video unavailable'

export type LoadedVideos = ReadonlyMap<string, ReplayVideo | null>

export interface VideoSlot {
    kind: 'video'
    id: string
    run: SoloRun
    src: string | null
    badges: string[]
    result: string
}

export type TileSlot = VideoSlot

export interface RaceRun {
    run: SoloRun
    cap: number
    offset: number
    source: ReplaySource | null
    fps: number | null
    tile: boolean
    badges: string[]
    result: string
}

export interface RaceModel {
    runs: RaceRun[]
    reference: string | null
    references: References
    tiles: TileSlot[]
    dataOnly: RaceRun[]
    layout: StageLayout<TileSlot>
}

export interface RaceInput {
    runs: readonly SoloRun[]
    state: CompareUrlState
    videos: LoadedVideos
    failedVideos: ReadonlySet<string>
    stageBox: StageBox | null
}

const UNMEASURED: StageBox = { width: 0, height: 0 }

export function videoReadOrder(state: CompareUrlState): string[] {
    const dataOnly = new Set(state.data)
    return [...state.runs.filter(id => !dataOnly.has(id)), ...state.runs.filter(id => dataOnly.has(id))]
}

function ordinal(n: number): string {
    const teen = n % 100 >= 11 && n % 100 <= 13
    const suffix = teen ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
    return `${n}${suffix}`
}

export function formatRaceTime(seconds: number): string {
    return formatCapTime(seconds).replace(/^0(?=\d:)/, '')
}

function resultLine(run: SoloRun, runs: readonly SoloRun[], reference: SoloRun): string {
    const gapMs = Math.round(run.timeSeconds * 1000) - Math.round(reference.timeSeconds * 1000)
    const rank = 1 + runs.filter(other => other.side === run.side && other.timeSeconds < run.timeSeconds).length
    return `CAP ${formatRaceTime(run.timeSeconds)} · ${formatSignedDelta(gapMs / 1000)} · ${ordinal(rank)}`
}

function offsetOf(state: CompareUrlState, capId: string, video: ReplayVideo | null | undefined): number {
    if (!video || video.source === 'utrecorder') return 0
    const entry = state.offsets.find(offset => offset.capId === capId)
    return entry ? entry.ms / 1000 : 0
}

export function composeRace({ runs, state, videos, failedVideos, stageBox }: RaceInput): RaceModel {
    const references = resolveReferences(runs, state.refs)
    const byId = new Map(runs.map(run => [run.capId, run]))
    const dataOnly = new Set(state.data)
    const tiles: TileSlot[] = []
    const raceRuns = runs.map(run => {
        const video = videos.get(run.capId)
        const failed = failedVideos.has(run.capId)
        const partner = byId.get(references.partners.get(run.capId) ?? '')
        const result = partner ? resultLine(run, runs, partner) : ''
        const tile = !failed && video !== null && !dataOnly.has(run.capId) && tiles.length < MAX_VIDEO_TILES
        if (tile) tiles.push({ kind: 'video', id: run.capId, run, src: video?.mp4_url ?? null, badges: [], result })
        return {
            run,
            cap: run.timeSeconds,
            offset: offsetOf(state, run.capId, video),
            source: video?.source ?? null,
            fps: video?.fps ?? null,
            tile,
            badges: tile ? [] : [failed ? VIDEO_UNAVAILABLE : NO_VIDEO],
            result,
        }
    })
    return {
        runs: raceRuns,
        reference: references.lead,
        references,
        tiles,
        dataOnly: raceRuns.filter(run => !run.tile),
        layout: packStage(tiles, stageBox ?? UNMEASURED),
    }
}

export const EMPTY_RACE: RaceModel = composeRace({
    runs: [],
    state: EMPTY_COMPARE_STATE,
    videos: new Map(),
    failedVideos: new Set(),
    stageBox: null,
})
