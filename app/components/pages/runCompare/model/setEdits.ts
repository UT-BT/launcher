import type { SoloRun } from '../loading/soloRuns'
import { MAX_COMPARE_RUNS, serializeCompareQuery, type CompareSync, type CompareUrlState } from '../url/compareUrl'
import { stateOf, type CompareModel } from './compareModel'
import { MAX_VIDEO_TILES } from './raceModel'
import { sideGroupOf } from './referenceModel'
import { MAX_TEAM_RUNS } from './teamModel'

export type SetEdit =
    | { kind: 'add'; capId: string }
    | { kind: 'remove'; capId: string }
    | { kind: 'pin'; capId: string }
    | { kind: 'unpin'; capId: string }
    | { kind: 'video'; capId: string; on: boolean }
    | { kind: 'offset'; capId: string; ms: number }
    | { kind: 'sync'; mode: CompareSync }

export interface EditableSet {
    state: CompareUrlState
    runs: readonly SoloRun[]
    videoTiles: readonly string[]
    teams?: ReadonlyMap<string, readonly string[]>
}

export type EditOutcome = { query: string; blocked: null } | { query: null; blocked: string }

export const RUN_LIMIT_REACHED = `A comparison holds at most ${MAX_COMPARE_RUNS} runs. Remove one before adding another.`
export const VIDEO_LIMIT_REACHED = `At most ${MAX_VIDEO_TILES} videos play at once. Turn another run’s video off first.`
export const LAST_RUN = 'A comparison needs at least one run.'
export const TEAM_LIMIT_REACHED = `A comparison holds at most ${MAX_TEAM_RUNS} team runs. Remove one before adding another.`

export function editableSet(model: CompareModel): EditableSet {
    const { rows } = model.teams
    const teams = new Map(rows.map(row => [row.teamCapId, row.team.members.map(member => member.capId)]))
    return {
        state: stateOf(model),
        runs: model.runs,
        videoTiles: model.race.tiles.map(tile => tile.id),
        ...(rows.length > 0 ? { teams } : {}),
    }
}

function teamUnit(teams: ReadonlyMap<string, readonly string[]>, capId: string): string {
    if (teams.has(capId)) return capId
    return [...teams].find(([, members]) => members.includes(capId))?.[0] ?? capId
}

function withoutTeam(state: CompareUrlState, teamCapId: string, members: readonly string[]): CompareUrlState {
    const gone = new Set([teamCapId, ...members])
    return {
        ...state,
        runs: without(state.runs, teamCapId),
        refs: without(state.refs, teamCapId),
        data: state.data.filter(id => !gone.has(id)),
        offsets: state.offsets.filter(offset => !gone.has(offset.capId)),
        pairs: state.pairs.filter(pair => !gone.has(pair.runner) && !gone.has(pair.reference)),
        drive: state.drive !== null && gone.has(state.drive) ? null : state.drive,
    }
}

function nextTeamState(set: EditableSet, teams: ReadonlyMap<string, readonly string[]>, edit: SetEdit): CompareUrlState | string | null {
    const { state } = set
    if (edit.kind === 'add' && !state.runs.includes(edit.capId) && state.runs.length >= MAX_TEAM_RUNS) return TEAM_LIMIT_REACHED
    if (edit.kind !== 'remove' && edit.kind !== 'pin' && edit.kind !== 'unpin') return null
    const unit = teamUnit(teams, edit.capId)
    switch (edit.kind) {
        case 'remove':
            if (!state.runs.includes(unit)) return state
            if (state.runs.length === 1) return LAST_RUN
            return withoutTeam(state, unit, teams.get(unit) ?? [])
        case 'pin':
            return state.refs.includes(unit) ? state : { ...state, refs: [unit] }
        case 'unpin':
            return { ...state, refs: without(state.refs, unit) }
    }
}

function without(ids: readonly string[], capId: string): string[] {
    return ids.filter(id => id !== capId)
}

function pinned(set: EditableSet, capId: string): string[] {
    const groupOf = sideGroupOf(set.runs)
    const run = set.runs.find(candidate => candidate.capId === capId)
    if (!run) return [...set.state.refs]
    const group = groupOf(run)
    const others = set.state.refs.filter(id => {
        const other = set.runs.find(candidate => candidate.capId === id)
        return !other || groupOf(other) !== group
    })
    return [...others, capId]
}

function withOffset(state: CompareUrlState, capId: string, ms: number): CompareUrlState['offsets'] {
    const rounded = Math.round(ms)
    if (rounded === 0) return state.offsets.filter(offset => offset.capId !== capId)
    if (!state.offsets.some(offset => offset.capId === capId)) return [...state.offsets, { capId, ms: rounded }]
    return state.offsets.map(offset => (offset.capId === capId ? { capId, ms: rounded } : offset))
}

function nextState(set: EditableSet, edit: SetEdit): CompareUrlState | string {
    const { state } = set
    if (edit.kind === 'sync') return { ...state, sync: edit.mode }
    const { capId } = edit
    switch (edit.kind) {
        case 'add':
            if (state.runs.includes(capId)) return state
            if (state.runs.length >= MAX_COMPARE_RUNS) return RUN_LIMIT_REACHED
            return { ...state, runs: [...state.runs, capId] }
        case 'remove':
            if (!state.runs.includes(capId)) return state
            if (state.runs.length === 1) return LAST_RUN
            return {
                ...state,
                runs: without(state.runs, capId),
                refs: without(state.refs, capId),
                data: without(state.data, capId),
                offsets: state.offsets.filter(offset => offset.capId !== capId),
            }
        case 'pin':
            return state.refs.includes(capId) ? state : { ...state, refs: pinned(set, capId) }
        case 'unpin':
            return { ...state, refs: without(state.refs, capId) }
        case 'video':
            if (!edit.on) return state.data.includes(capId) ? state : { ...state, data: [...state.data, capId] }
            if (!set.videoTiles.includes(capId) && set.videoTiles.length >= MAX_VIDEO_TILES) return VIDEO_LIMIT_REACHED
            return { ...state, data: without(state.data, capId) }
        case 'offset':
            return { ...state, offsets: withOffset(state, capId, edit.ms) }
    }
}

export function editSet(set: EditableSet, edit: SetEdit): EditOutcome {
    const next = (set.teams && nextTeamState(set, set.teams, edit)) || nextState(set, edit)
    if (typeof next === 'string') return { query: null, blocked: next }
    return { query: serializeCompareQuery({ ...next, t: null }), blocked: null }
}
