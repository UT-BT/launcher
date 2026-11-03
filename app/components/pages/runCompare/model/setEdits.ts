import type { SoloRun } from '../loading/soloRuns'
import { MAX_COMPARE_RUNS, parseCompareQuery, serializeCompareQuery, type CompareSync, type CompareUrlState } from '../url/compareUrl'
import type { CompareModel } from './compareModel'
import { MAX_VIDEO_TILES } from './raceModel'
import { sideGroupOf } from './referenceModel'

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
}

export type EditOutcome = { query: string; blocked: null } | { query: null; blocked: string }

export const RUN_LIMIT_REACHED = `A comparison holds at most ${MAX_COMPARE_RUNS} runs. Remove one before adding another.`
export const VIDEO_LIMIT_REACHED = `At most ${MAX_VIDEO_TILES} videos play at once. Turn another run’s video off first.`
export const LAST_RUN = 'A comparison needs at least one run.'

export function editableSet(model: CompareModel): EditableSet {
    return {
        state: parseCompareQuery(model.query).state,
        runs: model.runs,
        videoTiles: model.race.tiles.map(tile => tile.id),
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
    const next = nextState(set, edit)
    if (typeof next === 'string') return { query: null, blocked: next }
    return { query: serializeCompareQuery({ ...next, t: null }), blocked: null }
}
