import { displayMapName } from '@/app/utils/format'
import type { PickBanTone } from '@/app/components/broadcast/broadcastTone'
import type { StreamMapScore, StreamMatch, StreamScore, StreamScoreSource, StreamSide } from '../../data/streamHotState'
import { mapDrawn, mapNumber } from '../../sceneHelpers'

export type SeriesScore = StreamScore['series']

export type SeriesMapStatus = 'decided' | 'next' | 'open' | 'skipped'

export type CapsSourceLabel = 'Official' | 'Live' | 'Corrected'

export interface SeriesMapView {
    ordinal: number
    number: number
    map: string | null
    pickedBy: StreamSide | null
    decider: boolean
    caps: { a: number | null; b: number | null } | null
    winner: StreamSide | null
    drawn: boolean
    status: SeriesMapStatus
    sourceLabel: CapsSourceLabel | null
    latest: boolean
}

export interface UpNextView {
    text: string
    tone: PickBanTone
}

export interface SeriesFinalView {
    winner: StreamSide | null
    series: SeriesScore
    official: boolean
}

export interface IntermissionView {
    maps: SeriesMapView[]
    series: SeriesScore
    latest: SeriesMapView | null
    upNext: UpNextView | null
    final: SeriesFinalView | null
    kicker: string
}

export interface MapRevealState {
    matchId: string
    decided: number[]
    reveal: { ordinals: number[]; seq: number } | null
}

const SOURCE_LABELS: Record<StreamScoreSource, CapsSourceLabel> = {
    official: 'Official',
    live: 'Live',
    manual: 'Corrected',
}

const FINISHED_STATUSES = ['complete', 'forfeit', 'bye']

function capsShown(score: StreamMapScore): boolean {
    return score.decided || score.source === 'manual' || (score.caps.a ?? 0) + (score.caps.b ?? 0) > 0
}

function statusOf(score: StreamMapScore, current: number | null, over: boolean): SeriesMapStatus {
    if (score.decided) return 'decided'
    if (score.ordinal === current) return 'next'
    return over ? 'skipped' : 'open'
}

function seriesOver(match: StreamMatch): boolean {
    return match.score.live_decided || FINISHED_STATUSES.includes(match.status)
}

function seriesMaps(match: StreamMatch): SeriesMapView[] {
    const maps = [...match.score.maps].sort((left, right) => left.ordinal - right.ordinal)
    const latest = maps.filter(map => map.decided).at(-1)?.ordinal ?? null
    const over = seriesOver(match)
    return maps.map(score => {
        const row = match.maps.find(map => map.ordinal === score.ordinal)
        const shown = capsShown(score)
        return {
            ordinal: score.ordinal,
            number: mapNumber(score.ordinal),
            map: row?.map ?? null,
            pickedBy: row?.picked_by ?? null,
            decider: row?.kind === 'decider',
            caps: shown ? { a: score.caps.a, b: score.caps.b } : null,
            winner: score.winner,
            drawn: mapDrawn(score),
            status: statusOf(score, match.score.current_map, over),
            sourceLabel: shown ? SOURCE_LABELS[score.source] : null,
            latest: score.ordinal === latest,
        }
    })
}

function upNextOf(match: StreamMatch, column: SeriesMapView | undefined): UpNextView | null {
    if (!column) return null
    if (!column.map) return { text: 'Up next: map to be decided', tone: 'neutral' }
    const name = displayMapName(column.map)
    if (column.decider) return { text: `Up next: ${name} · decider`, tone: 'gold' }
    if (!column.pickedBy) return { text: `Up next: ${name}`, tone: 'neutral' }
    return { text: `Up next: ${name} · picked by ${teamLabel(match, column.pickedBy)}`, tone: column.pickedBy }
}

function seriesFinal(match: StreamMatch, maps: SeriesMapView[]): SeriesFinalView | null {
    if (match.score.current_map !== null || maps.length === 0 || !seriesOver(match)) return null
    return { winner: match.score.winner, series: { ...match.score.series }, official: FINISHED_STATUSES.includes(match.status) }
}

export function intermissionView(match: StreamMatch): IntermissionView {
    const maps = seriesMaps(match)
    const series = { ...match.score.series }
    const next = maps.find(map => map.ordinal === match.score.current_map)
    const upNext = upNextOf(match, next)
    const final = upNext ? null : seriesFinal(match, maps)
    const tally = `Series ${series.a}–${series.b}`
    const kicker = next ? `${tally} · map ${next.number} next` : final ? `${tally} · final` : stalledKicker(match, tally)
    return { maps, series, latest: maps.find(map => map.latest) ?? null, upNext, final, kicker }
}

function stalledKicker(match: StreamMatch, tally: string): string {
    if (match.score.series_state !== 'unresolved') return tally
    return match.score.series.a === match.score.series.b ? `${tally} · level, decider to come` : `${tally} · awaiting the result`
}

export function teamLabel(match: StreamMatch, side: StreamSide): string {
    return match.teams[side]?.name ?? `Team ${side.toUpperCase()}`
}

export function mapToneOf(pickedBy: StreamSide | null, decider: boolean): PickBanTone {
    if (pickedBy) return pickedBy
    return decider ? 'gold' : 'neutral'
}

function decidedOrdinals(score: StreamScore): number[] {
    return score.maps.filter(map => map.decided).map(map => map.ordinal).sort((left, right) => left - right)
}

export function initialMapReveal(matchId: string, score: StreamScore): MapRevealState {
    return { matchId, decided: decidedOrdinals(score), reveal: null }
}

export function advanceMapReveal(state: MapRevealState, matchId: string, score: StreamScore): MapRevealState {
    if (state.matchId !== matchId) return initialMapReveal(matchId, score)
    const decided = decidedOrdinals(score)
    if (decided.length === state.decided.length && decided.every((ordinal, index) => ordinal === state.decided[index])) return state
    const fresh = decided.filter(ordinal => !state.decided.includes(ordinal))
    const reveal = fresh.length > 0 ? { ordinals: fresh, seq: (state.reveal?.seq ?? 0) + 1 } : state.reveal
    return { matchId, decided, reveal }
}
