import type { SignedGap } from '@/app/components/pages/capDetail/runDelta/deltaCurve'
import type { SoloRun } from '../loading/soloRuns'
import { stateOf, type CompareModel } from '../model/compareModel'
import { formatRaceTime, GRAPH_ONLY, type LoadedVideos } from '../model/raceModel'
import { focusRuns, isSideReference, onFocusSide } from '../model/referenceModel'
import type { TeamRow } from '../model/teamModel'
import type { PairMenu } from '../model/teamPairing'
import { FALLBACK_FPS } from '../playback/playbackConstants'

export const OLDER_VIDEO = 'Older video'

export type RosterVideo = 'on' | 'off' | 'none'

export interface RosterRow {
    capId: string
    run: SoloRun
    time: string
    reference: boolean
    gap: SignedGap | null
    pinned: boolean
    badges: string[]
    sideLabel: string | null
    video: RosterVideo
    frameSynced: boolean
    offsetMs: number
    fps: number
}

export interface RosterInput {
    model: CompareModel
    videos: LoadedVideos
    failedVideos: ReadonlySet<string>
}

function rowOrder(model: CompareModel): string[] {
    const { references } = model.race
    const order = references.sides.flatMap(({ capId: reference }) => [
        reference,
        ...model.runs
            .map(run => run.capId)
            .filter(capId => references.partners.get(capId) === reference && !isSideReference(references, capId)),
    ])
    return order.length === model.runs.length ? order : model.runs.map(run => run.capId)
}

export function rosterRows({ model, videos, failedVideos }: RosterInput): RosterRow[] {
    const state = stateOf(model)
    const raceRuns = new Map(model.race.runs.map(raceRun => [raceRun.run.capId, raceRun]))
    const lanes = new Map(model.lanes.lanes.map(lane => [lane.capId, lane]))
    const pins = new Set(state.refs)
    return rowOrder(model).flatMap(capId => {
        const raceRun = raceRuns.get(capId)
        const lane = lanes.get(capId)
        if (!raceRun || !lane) return []
        const video: RosterVideo = failedVideos.has(capId) || videos.get(capId) === null ? 'none' : raceRun.tile ? 'on' : 'off'
        return [{
            capId,
            run: raceRun.run,
            time: formatRaceTime(raceRun.run.timeSeconds),
            reference: lane.reference && onFocusSide(model.race.sides, raceRun.run) && focusRuns(model.race.sides, model.runs.length) >= 2,
            gap: lane.reference || !onFocusSide(model.race.sides, raceRun.run) ? null : lane.finalGap,
            pinned: pins.has(capId),
            badges: lane.badges.filter(badge => !(video === 'off' && badge === GRAPH_ONLY)),
            sideLabel: lane.sideLabel,
            video,
            frameSynced: raceRun.source === null || raceRun.source === 'utrecorder',
            offsetMs: state.offsets.find(offset => offset.capId === capId)?.ms ?? 0,
            fps: raceRun.fps ?? FALLBACK_FPS,
        }]
    })
}

export interface TeamRosterMember {
    roster: RosterRow
    index: number
    menu: PairMenu | null
    driving: boolean | null
}

export interface TeamRosterGroup {
    row: TeamRow
    members: TeamRosterMember[]
}

function drivingOf(model: CompareModel, teamCapId: string, capId: string): boolean | null {
    const drive = model.teams.pairing.drives.get(teamCapId)
    if (model.sync.mode !== 'position' || !drive?.choices.includes(capId)) return null
    return drive.driver === capId
}

export function teamRosterGroups(model: CompareModel, rows: readonly RosterRow[]): TeamRosterGroup[] {
    const { seats, pairing } = model.teams
    return model.teams.rows.map(row => ({
        row,
        members: rows.flatMap(roster => {
            const seat = seats.get(roster.capId)
            if (seat?.teamCapId !== row.teamCapId) return []
            return [{ roster, index: seat.index, menu: pairing.menus.get(roster.capId) ?? null, driving: drivingOf(model, row.teamCapId, roster.capId) }]
        }),
    }))
}
