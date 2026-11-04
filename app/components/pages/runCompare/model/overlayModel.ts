import { signedGap, type SignedGap } from '@/app/components/pages/capDetail/runDelta/deltaCurve'
import type { SoloRun } from '../loading/soloRuns'
import { FALLBACK_FPS } from '../playback/playbackConstants'
import { parseCompareQuery } from '../url/compareUrl'
import type { CompareModel } from './compareModel'
import { liveDelta, type Lane } from './laneModel'
import { focusRuns, onFocusSide } from './referenceModel'
import { formatRaceTime } from './raceModel'
import type { PairMenu } from './teamPairing'

export const SECTOR_FLASH_MS = 1000

export interface TileOverlay {
    capId: string
    run: SoloRun
    time: string
    reference: boolean
    pinned: boolean
    versus: SoloRun | null
    badges: string[]
    sideLabel: string | null
    olderVideo: boolean
    offsetMs: number
    fps: number
    colour: string | null
    teamColour: string | null
    teamIndex: number | null
    removable: boolean
    lane: Lane | null
    pairMenu: PairMenu | null
}

function pairedWith(menu: PairMenu | null): SoloRun | null {
    return menu?.groups.flatMap(group => group.options).find(option => option.current)?.run ?? null
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
    const { refs, offsets } = parseCompareQuery(model.query).state
    const pins = new Set(refs)
    const lanes = new Map(model.lanes.lanes.map(lane => [lane.capId, lane]))
    const raceRuns = new Map(model.race.runs.map(raceRun => [raceRun.run.capId, raceRun]))
    const runs = new Map(model.runs.map(run => [run.capId, run]))
    const colours = new Map(model.analysis.runs.map(run => [run.capId, run.colour]))
    const { seats, rows } = model.teams
    const removable = rows.length > 0 ? rows.length > 1 : model.runs.length > 1
    const measured = rows.length > 0 || focusRuns(model.race.sides, model.runs.length) >= 2
    return new Map(model.race.tiles.map(tile => {
        const onSide = onFocusSide(model.race.sides, tile.run)
        const lane = onSide ? lanes.get(tile.id) ?? null : null
        const raceRun = raceRuns.get(tile.id)
        const source = raceRun?.source ?? null
        const seat = seats.get(tile.id) ?? null
        const pairMenu = model.teams.pairing.menus.get(tile.id) ?? null
        const partner = runs.get(model.race.references.partners.get(tile.id) ?? '') ?? null
        const reference = (lane?.reference ?? false) && measured
        return [tile.id, {
            capId: tile.id,
            run: tile.run,
            time: formatRaceTime(tile.run.timeSeconds),
            reference,
            pinned: pins.has(seat?.teamCapId ?? tile.id),
            versus: seat ? pairedWith(pairMenu) : reference || !onSide || partner?.capId === tile.id ? null : partner,
            badges: tile.badges,
            sideLabel: lanes.get(tile.id)?.sideLabel ?? null,
            olderVideo: source !== null && source !== 'utrecorder',
            offsetMs: offsets.find(offset => offset.capId === tile.id)?.ms ?? 0,
            fps: raceRun?.fps ?? FALLBACK_FPS,
            colour: colours.get(tile.id) ?? null,
            teamColour: seat?.colour ?? null,
            teamIndex: seat?.index ?? null,
            removable,
            lane,
            pairMenu,
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
