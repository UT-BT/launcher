import { displayMapName } from '@/app/utils/format'
import type { StreamLineupSlot, StreamMatch, StreamScore, StreamScoreSource, StreamSide } from '../../data/streamHotState'
import { mapDrawn, mapNumber, seriesFlags, type SeriesFlag } from '../../sceneHelpers'
import { BAND, LONG_TEAM_NAME_CHARS, MAP_NAME_MAX_PX, STRIP_ESTIMATE, UPCOMING_NAME_MIN_PX, type OverlayMapState } from './overlayLayout'

export type OverlayTagPlacement = 'above-seam-left' | 'above-seam-right' | 'below-seam-left' | 'below-seam-right'
export type OverlayPickTone = StreamSide | 'gold'

export interface OverlayTag {
    slot: StreamLineupSlot
    side: StreamSide
    placement: OverlayTagPlacement
    userId: string | null
    name: string | null
}

export interface OverlayTeamRow {
    side: StreamSide
    name: string
    longName: boolean
    pips: SeriesFlag[]
    caps: number | null
}

export interface OverlayMapResult {
    a: number
    b: number
    winner: StreamSide | null
    drawn: boolean
}

export const DRAW_LABEL = 'Draw'

export interface OverlayStripMap {
    ordinal: number
    number: number
    name: string
    state: OverlayMapState
    tone: OverlayPickTone
    result: OverlayMapResult | null
    showName: boolean
    nameMaxPx: number | null
}

export interface OverlayStrip {
    maps: OverlayStripMap[]
    target: string | null
    compact: boolean
}

export interface OverlayView {
    tags: OverlayTag[]
    teams: [OverlayTeamRow, OverlayTeamRow]
    capsSource: StreamScoreSource | null
    strip: OverlayStrip
}

const QUADRANTS: { slot: StreamLineupSlot; side: StreamSide; placement: OverlayTagPlacement }[] = [
    { slot: 'a1', side: 'a', placement: 'above-seam-left' },
    { slot: 'a2', side: 'a', placement: 'above-seam-right' },
    { slot: 'b1', side: 'b', placement: 'below-seam-left' },
    { slot: 'b2', side: 'b', placement: 'below-seam-right' },
]

function shownMapOrdinal(score: StreamScore): number | null {
    if (score.current_map !== null) return score.current_map
    const decided = score.maps.filter(map => map.decided).map(map => map.ordinal)
    return decided.length > 0 ? Math.max(...decided) : null
}

function teamName(match: StreamMatch, side: StreamSide): string {
    return match.teams[side]?.name ?? 'TBD'
}

function nameTags(match: StreamMatch): OverlayTag[] {
    return QUADRANTS.flatMap(({ slot, side, placement }) => {
        const player = match.lineup[slot]
        if (!player || (player.id === null && player.display_name === null)) return []
        return [{ slot, side, placement, userId: player.id, name: player.display_name }]
    })
}

function resultText(result: OverlayMapResult): string {
    return `${result.a}–${result.b}`
}

function resultPx(result: OverlayMapResult): number {
    const draw = result.drawn ? STRIP_ESTIMATE.gapPx + textPx(DRAW_LABEL) : 0
    return STRIP_ESTIMATE.gapPx + textPx(resultText(result)) + draw + STRIP_ESTIMATE.resultPaddingPx
}

function textPx(text: string, maxPx: number | null = null): number {
    const px = text.length * STRIP_ESTIMATE.charPx
    return maxPx === null ? px : Math.min(px, maxPx)
}

function cellPx(map: OverlayStripMap): number {
    const name = map.showName ? STRIP_ESTIMATE.gapPx + textPx(map.name, map.nameMaxPx) : 0
    const result = map.result ? resultPx(map.result) : 0
    return STRIP_ESTIMATE.cellPaddingPx + STRIP_ESTIMATE.badgePx + name + result
}

function bandPx(maps: OverlayStripMap[], target: string | null): number {
    const chip = target === null ? 0 : STRIP_ESTIMATE.chipGapPx + STRIP_ESTIMATE.chipPaddingPx + textPx(target)
    return 2 * BAND.paddingX + maps.reduce((sum, map) => sum + cellPx(map), 0) + chip
}

function mapState(match: StreamMatch, ordinal: number, decided: boolean): OverlayMapState {
    if (decided) return 'played'
    if (ordinal === match.score.current_map) return 'current'
    return match.score.live_decided ? 'skipped' : 'upcoming'
}

function stripMaps(match: StreamMatch): OverlayStripMap[] {
    return [...match.maps]
        .sort((left, right) => left.ordinal - right.ordinal)
        .map(map => {
            const score = match.score.maps.find(entry => entry.ordinal === map.ordinal)
            const state = mapState(match, map.ordinal, score?.decided ?? false)
            const caps = score?.caps
            const result = state === 'played' && score && caps && caps.a !== null && caps.b !== null
                ? { a: caps.a, b: caps.b, winner: score.winner, drawn: mapDrawn(score) }
                : null
            return {
                ordinal: map.ordinal,
                number: mapNumber(map.ordinal),
                name: displayMapName(map.map),
                state,
                tone: map.picked_by ?? 'gold',
                result,
                showName: true,
                nameMaxPx: MAP_NAME_MAX_PX[state],
            }
        })
}

function capUpcomingNames(maps: OverlayStripMap[], maxPx: number): OverlayStripMap[] {
    return maps.map(map => (map.state === 'upcoming' ? { ...map, nameMaxPx: maxPx } : map))
}

function fitUpcomingNames(maps: OverlayStripMap[], target: string | null): OverlayStripMap[] {
    for (let maxPx = MAP_NAME_MAX_PX.upcoming; maxPx >= UPCOMING_NAME_MIN_PX; maxPx -= STRIP_ESTIMATE.charPx) {
        const capped = capUpcomingNames(maps, maxPx)
        if (bandPx(capped, target) <= BAND.maxWidth) return capped
    }
    return maps.map(map => (map.state === 'upcoming' ? { ...map, showName: false } : map))
}

function mapStrip(match: StreamMatch): OverlayStrip {
    const target = match.caps_to_win === null ? null : `FT${match.caps_to_win}`
    const full = stripMaps(match)
    if (bandPx(full, target) <= BAND.maxWidth) return { maps: full, target, compact: false }
    const collapsed = full.map(map => (map.state === 'played' || map.state === 'skipped' ? { ...map, showName: false } : map))
    return { maps: fitUpcomingNames(collapsed, target), target, compact: true }
}

export function overlayView(match: StreamMatch | null): OverlayView | null {
    if (!match) return null
    const ordinal = shownMapOrdinal(match.score)
    const shown = match.score.maps.find(map => map.ordinal === ordinal)
    const pips = seriesFlags(match)
    const row = (side: StreamSide): OverlayTeamRow => {
        const name = teamName(match, side)
        return { side, name, longName: name.length > LONG_TEAM_NAME_CHARS, pips: pips[side], caps: shown?.caps[side] ?? null }
    }

    return {
        tags: nameTags(match),
        teams: [row('a'), row('b')],
        capsSource: shown?.source ?? null,
        strip: mapStrip(match),
    }
}
