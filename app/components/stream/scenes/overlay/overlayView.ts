import { displayMapName } from '@/app/utils/format'
import type { StreamLineupSlot, StreamMatch, StreamScore, StreamScoreSource, StreamSide } from '../../data/streamHotState'
import { formatLabel, mapNumber, seriesFlags, stageLine, type SeriesFlag } from '../../sceneHelpers'

export type OverlayCorner = 'mid-left' | 'mid-right' | 'bottom-left' | 'bottom-right'

export interface OverlayTag {
    slot: StreamLineupSlot
    label: string
    side: StreamSide
    corner: OverlayCorner
    userId: string | null
    name: string | null
}

export interface OverlayTeamRow {
    side: StreamSide
    name: string
    flags: SeriesFlag[]
    caps: number | null
}

export interface OverlayMap {
    name: string
    pickedBy: { side: StreamSide; team: string } | null
}

export interface OverlayView {
    tags: OverlayTag[]
    teams: [OverlayTeamRow, OverlayTeamRow]
    capsSource: StreamScoreSource | null
    mapLine: string
    map: OverlayMap | null
    footer: string
}

const QUADRANTS: { slot: StreamLineupSlot; side: StreamSide; corner: OverlayCorner }[] = [
    { slot: 'a1', side: 'a', corner: 'mid-left' },
    { slot: 'a2', side: 'a', corner: 'mid-right' },
    { slot: 'b1', side: 'b', corner: 'bottom-left' },
    { slot: 'b2', side: 'b', corner: 'bottom-right' },
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
    return QUADRANTS.flatMap(({ slot, side, corner }) => {
        const player = match.lineup[slot]
        if (!player || (player.id === null && player.display_name === null)) return []
        return [{ slot, label: slot.toUpperCase(), side, corner, userId: player.id, name: player.display_name }]
    })
}

function overlayMap(match: StreamMatch, ordinal: number | null): OverlayMap | null {
    const map = match.maps.find(entry => entry.ordinal === ordinal)
    if (!map) return null
    const side = map.picked_by
    return { name: displayMapName(map.map), pickedBy: side ? { side, team: teamName(match, side) } : null }
}

function mapLine(match: StreamMatch, ordinal: number | null): string {
    const parts = [ordinal === null ? null : `Map ${mapNumber(ordinal)} of ${match.best_of}`, match.caps_to_win === null ? null : `first to ${match.caps_to_win}`]
    return parts.filter(Boolean).join(' · ')
}

export function overlayView(match: StreamMatch | null): OverlayView | null {
    if (!match) return null
    const ordinal = shownMapOrdinal(match.score)
    const shown = match.score.maps.find(map => map.ordinal === ordinal)
    const flags = seriesFlags(match)
    const row = (side: StreamSide): OverlayTeamRow => ({ side, name: teamName(match, side), flags: flags[side], caps: shown?.caps[side] ?? null })

    return {
        tags: nameTags(match),
        teams: [row('a'), row('b')],
        capsSource: shown?.source ?? null,
        mapLine: mapLine(match, ordinal),
        map: overlayMap(match, ordinal),
        footer: `${stageLine(match)} · ${formatLabel(match)}`,
    }
}
