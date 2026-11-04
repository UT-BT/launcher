import { signedGap, type SignedGap } from '@/app/components/pages/capDetail/runDelta/deltaCurve'
import { NOT_FRAME_SYNCED } from '../drawer/rosterRows'
import type { SoloRun } from '../loading/soloRuns'
import { parseCompareQuery } from '../url/compareUrl'
import type { CompareModel } from './compareModel'
import { liveDelta, type Lane } from './laneModel'
import { formatRaceTime } from './raceModel'
import type { PairMenu } from './teamPairing'

export const OVERLAY_IDLE_MS = 2000
export const SECTOR_FLASH_MS = 1000

export interface TileOverlay {
    capId: string
    run: SoloRun
    time: string
    reference: boolean
    pinned: boolean
    badges: string[]
    teamColour: string | null
    teamIndex: number | null
    removable: boolean
    lane: Lane | null
    pairMenu: PairMenu | null
}

export interface SectorFlash {
    index: number
    label: string
    gap: SignedGap
}

export interface TileReadout {
    delta: SignedGap | null
    flash: SectorFlash | null
}

export interface ReadoutClock {
    seconds: number
    playing: boolean
}

export function tileOverlays(model: CompareModel): ReadonlyMap<string, TileOverlay> {
    const pins = new Set(parseCompareQuery(model.query).state.refs)
    const lanes = new Map(model.lanes.lanes.map(lane => [lane.capId, lane]))
    const sources = new Map(model.race.runs.map(raceRun => [raceRun.run.capId, raceRun.source]))
    const { seats, rows } = model.teams
    const removable = rows.length > 0 ? rows.length > 1 : model.runs.length > 1
    return new Map(model.race.tiles.map(tile => {
        const lane = lanes.get(tile.id) ?? null
        const source = sources.get(tile.id) ?? null
        const seat = seats.get(tile.id) ?? null
        return [tile.id, {
            capId: tile.id,
            run: tile.run,
            time: formatRaceTime(tile.run.timeSeconds),
            reference: lane?.reference ?? false,
            pinned: pins.has(seat?.teamCapId ?? tile.id),
            badges: [...tile.badges, ...(source !== null && source !== 'utrecorder' ? [NOT_FRAME_SYNCED] : [])],
            teamColour: seat?.colour ?? null,
            teamIndex: seat?.index ?? null,
            removable,
            lane,
            pairMenu: model.teams.pairing.menus.get(tile.id) ?? null,
        }]
    }))
}

export function sectorFlash(lane: Lane, seconds: number): SectorFlash | null {
    if (lane.reference) return null
    const timeMs = seconds * 1000
    let crossed: SectorFlash | null = null
    for (const split of lane.splits) {
        if (split.endMs >= lane.capMs || split.endMs > timeMs) continue
        if (timeMs < split.endMs + SECTOR_FLASH_MS) crossed = { index: split.index, label: split.label, gap: signedGap(split.deltaSplitMs) }
    }
    return crossed
}

export function tileReadout(overlay: TileOverlay, { seconds, playing }: ReadoutClock): TileReadout {
    const { lane } = overlay
    if (!lane || lane.reference) return { delta: null, flash: null }
    return {
        delta: liveDelta(lane, seconds)?.gap ?? null,
        flash: playing ? sectorFlash(lane, seconds) : null,
    }
}

export function sameReadout(a: TileReadout, b: TileReadout): boolean {
    return a.delta?.label === b.delta?.label
        && a.delta?.tone === b.delta?.tone
        && a.flash?.index === b.flash?.index
        && a.flash?.gap.label === b.flash?.gap.label
}
