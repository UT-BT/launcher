import type { RawActiveTitle } from '@/app/utils/api'
import type { PickBanTone } from '@/app/components/broadcast/broadcastTone'
import type { StreamLineupSlot, StreamMapScore, StreamMatch, StreamScore, StreamScoreSource, StreamSide } from '../../data/streamHotState'
import { mapNumber } from '../../sceneHelpers'
import type { IntermissionRead } from './intermissionRead'

export type SeriesScore = StreamScore['series']

export type SeriesMapStatus = 'decided' | 'next' | 'open'

export type CapsSourceLabel = 'Official' | 'Live' | 'Corrected'

export interface SeriesMapView {
    ordinal: number
    number: number
    map: string | null
    pickedBy: StreamSide | null
    decider: boolean
    caps: { a: number | null; b: number | null } | null
    winner: StreamSide | null
    status: SeriesMapStatus
    sourceLabel: CapsSourceLabel | null
    latest: boolean
}

export interface IntermissionPlayerView {
    slot: StreamLineupSlot
    side: StreamSide
    id: string | null
    name: string | null
    title: RawActiveTitle | null
    pb: { seconds: number; verified: boolean } | null
}

export interface NextMapView {
    ordinal: number
    number: number
    map: string | null
    pickedBy: StreamSide | null
    decider: boolean
    mapper: string | null
    screenshotVersion: string | null
    wrSeconds: number | null
    players: IntermissionPlayerView[]
    loaded: boolean
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
    next: NextMapView | null
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
    override: 'Corrected',
}

const SLOTS: StreamLineupSlot[] = ['a1', 'a2', 'b1', 'b2']

const FINISHED_STATUSES = ['complete', 'forfeit', 'bye']

function sideOfSlot(slot: StreamLineupSlot): StreamSide {
    return slot.startsWith('a') ? 'a' : 'b'
}

function capsShown(score: StreamMapScore): boolean {
    return score.decided || score.source === 'override' || (score.caps.a ?? 0) + (score.caps.b ?? 0) > 0
}

function statusOf(score: StreamMapScore, current: number | null): SeriesMapStatus {
    if (score.decided) return 'decided'
    return score.ordinal === current ? 'next' : 'open'
}

function seriesMaps(match: StreamMatch): SeriesMapView[] {
    const maps = [...match.score.maps].sort((left, right) => left.ordinal - right.ordinal)
    const latest = maps.filter(map => map.decided).at(-1)?.ordinal ?? null
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
            status: statusOf(score, match.score.current_map),
            sourceLabel: shown ? SOURCE_LABELS[score.source] : null,
            latest: score.ordinal === latest,
        }
    })
}

function titleOf(match: StreamMatch, side: StreamSide, id: string | null): RawActiveTitle | null {
    return match.teams[side]?.members.find(member => member.id === id)?.title ?? null
}

function nextPlayers(match: StreamMatch, read: IntermissionRead | null): IntermissionPlayerView[] {
    return SLOTS.flatMap<IntermissionPlayerView>(slot => {
        const side = sideOfSlot(slot)
        if (read) {
            const player = read.lineup[slot]
            if (!player) return []
            const pb = player.pb ? { seconds: player.pb.time_seconds, verified: player.pb.verified } : null
            return [{ slot, side, id: player.id, name: player.display_name, title: titleOf(match, side, player.id), pb }]
        }
        const user = match.lineup[slot]
        if (!user) return []
        return [{ slot, side, id: user.id, name: user.display_name, title: titleOf(match, side, user.id), pb: null }]
    })
}

function nextMap(match: StreamMatch, maps: SeriesMapView[], read: IntermissionRead | null): NextMapView | null {
    const column = maps.find(map => map.ordinal === match.score.current_map)
    if (!column) return null
    const fresh = read && read.match_id === match.id && read.ordinal === column.ordinal ? read : null
    return {
        ordinal: column.ordinal,
        number: column.number,
        map: fresh?.map?.name ?? column.map,
        pickedBy: fresh ? fresh.picked_by : column.pickedBy,
        decider: fresh ? fresh.kind === 'decider' : column.decider,
        mapper: fresh?.map?.mapper ?? null,
        screenshotVersion: fresh?.map?.screenshot_version ?? null,
        wrSeconds: fresh?.team_wr?.time_seconds ?? null,
        players: nextPlayers(match, fresh),
        loaded: fresh !== null,
    }
}

function seriesFinal(match: StreamMatch, maps: SeriesMapView[]): SeriesFinalView | null {
    if (match.score.current_map !== null || maps.length === 0) return null
    return { winner: match.score.winner, series: { ...match.score.series }, official: FINISHED_STATUSES.includes(match.status) }
}

export function intermissionView(match: StreamMatch, read: IntermissionRead | null): IntermissionView {
    const maps = seriesMaps(match)
    const series = { ...match.score.series }
    const next = nextMap(match, maps, read)
    const final = next ? null : seriesFinal(match, maps)
    const tally = `Series ${series.a}–${series.b}`
    const kicker = next ? `${tally} · map ${next.number} next` : final ? `${tally} · final` : tally
    return { maps, series, latest: maps.find(map => map.latest) ?? null, next, final, kicker }
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
