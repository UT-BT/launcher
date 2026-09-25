import type { PickBanActor, PickBanEditFinalEntry, PickBanSide } from '@/app/utils/api'
import { displayMapName } from '@/app/utils/format'
import type { PickBanTeamPanel, PickBanView } from './pickBanView'

export interface FinalDraftEntry {
    key: number
    map: string | null
    side: PickBanSide | null
    decider: boolean
}

export interface FinalDraft {
    version: number
    entries: FinalDraftEntry[]
    nextKey: number
}

export interface FinalEditorRow {
    key: number
    mapNumber: number
    map: string | null
    side: PickBanSide | null
    decider: boolean
    canBeDecider: boolean
    canMoveUp: boolean
    canMoveDown: boolean
    invalid: boolean
}

export interface FinalMapChoice {
    map: string
    label: string
}

export interface FinalSideChoice {
    side: PickBanSide
    ab: PickBanActor | null
    name: string
}

export interface FinalEditor {
    rows: FinalEditorRow[]
    maps: FinalMapChoice[]
    sides: FinalSideChoice[]
    canAdd: boolean
    problems: string[]
    body: { maps: PickBanEditFinalEntry[] } | null
    outdated: boolean
}

export function finalDraftOf(view: PickBanView): FinalDraft {
    return {
        version: view.version,
        entries: view.summary.map((entry, key) => ({
            key,
            map: entry.map,
            side: entry.decider ? null : entry.side,
            decider: entry.decider,
        })),
        nextKey: view.summary.length,
    }
}

interface Problem {
    keys: number[]
    message: string
}

function withEntry(draft: FinalDraft, key: number, change: Partial<FinalDraftEntry>): FinalDraft {
    return { ...draft, entries: draft.entries.map((entry) => (entry.key === key ? { ...entry, ...change } : entry)) }
}

export function setFinalMap(draft: FinalDraft, key: number, map: string | null): FinalDraft {
    return withEntry(draft, key, { map })
}

export function setFinalSide(draft: FinalDraft, key: number, side: PickBanSide | null): FinalDraft {
    return withEntry(draft, key, { side })
}

export function setFinalDecider(draft: FinalDraft, key: number, decider: boolean): FinalDraft {
    if (!decider) return withEntry(draft, key, { decider })
    if (draft.entries[draft.entries.length - 1]?.key !== key) return draft
    return { ...draft, entries: draft.entries.map((entry) => ({ ...entry, decider: entry.key === key })) }
}

export function addFinalEntry(draft: FinalDraft): FinalDraft {
    const { entries, nextKey } = draft
    const at = entries[entries.length - 1]?.decider ? entries.length - 1 : entries.length
    const blank: FinalDraftEntry = { key: nextKey, map: null, side: null, decider: false }
    return { ...draft, entries: [...entries.slice(0, at), blank, ...entries.slice(at)], nextKey: nextKey + 1 }
}

export function moveFinalEntry(draft: FinalDraft, key: number, offset: -1 | 1): FinalDraft {
    const from = draft.entries.findIndex((entry) => entry.key === key)
    const to = from + offset
    if (from < 0 || to < 0 || to >= draft.entries.length) return draft
    const entries = draft.entries.slice()
    const [moved] = entries.splice(from, 1)
    entries.splice(to, 0, moved)
    return { ...draft, entries }
}

export function removeFinalEntry(draft: FinalDraft, key: number): FinalDraft {
    return { ...draft, entries: draft.entries.filter((entry) => entry.key !== key) }
}

function entryProblemsOf({ key, map, side, decider }: FinalDraftEntry, mapNumber: number, eligible: string[]): Problem[] {
    const problems: Problem[] = []
    if (map === null) problems.push({ keys: [key], message: `Map ${mapNumber}: choose a map.` })
    else if (!eligible.includes(map)) problems.push({ keys: [key], message: `Map ${mapNumber}: ${displayMapName(map)} isn’t in this match’s eligible pool.` })
    if (!decider && side === null) problems.push({ keys: [key], message: `Map ${mapNumber}: choose who picked it.` })
    return problems
}

function duplicateProblemsOf(entries: FinalDraftEntry[]): Problem[] {
    const keysByMap = new Map<string, number[]>()
    for (const { key, map } of entries) {
        if (map !== null) keysByMap.set(map, [...(keysByMap.get(map) ?? []), key])
    }
    return [...keysByMap]
        .filter(([, keys]) => keys.length > 1)
        .map(([map, keys]) => ({ keys, message: `${displayMapName(map)} is listed more than once.` }))
}

function deciderProblemsOf(entries: FinalDraftEntry[]): Problem[] {
    const deciderKeys = entries.filter((entry) => entry.decider).map((entry) => entry.key)
    const misplaced = deciderKeys.filter((key) => key !== entries[entries.length - 1].key)
    const problems: Problem[] = []
    if (deciderKeys.length > 1) problems.push({ keys: deciderKeys, message: 'Only one map can be the decider.' })
    if (misplaced.length > 0) problems.push({ keys: misplaced, message: 'Only the last map can be the decider.' })
    return problems
}

function problemsOf(entries: FinalDraftEntry[], eligible: string[]): Problem[] {
    if (entries.length === 0) return [{ keys: [], message: 'Add at least one map.' }]
    return [
        ...entries.flatMap((entry, index) => entryProblemsOf(entry, index + 1, eligible)),
        ...duplicateProblemsOf(entries),
        ...deciderProblemsOf(entries),
    ]
}

function eligibleMapsOf(view: PickBanView): string[] {
    return view.cards.filter((card) => card.state !== 'excluded').map((card) => card.map)
}

function sidesOf(view: PickBanView): FinalSideChoice[] {
    return [view.teams.left, view.teams.right]
        .filter((panel): panel is PickBanTeamPanel => panel !== null)
        .map(({ side, ab, name }) => ({ side, ab, name }))
}

function bodyOf(entries: FinalDraftEntry[]): { maps: PickBanEditFinalEntry[] } {
    return {
        maps: entries.map(({ map, side, decider }) => ({ map: map ?? '', picked_by: decider ? null : side, decider })),
    }
}

export function finalEditorOf(draft: FinalDraft, view: PickBanView): FinalEditor {
    const maps = eligibleMapsOf(view)
    const last = draft.entries.length - 1
    const problems = problemsOf(draft.entries, maps)
    return {
        rows: draft.entries.map((entry, index) => ({
            key: entry.key,
            mapNumber: index + 1,
            map: entry.map,
            side: entry.decider ? null : entry.side,
            decider: entry.decider,
            canBeDecider: entry.decider || index === last,
            canMoveUp: index > 0,
            canMoveDown: index < last,
            invalid: problems.some((problem) => problem.keys.includes(entry.key)),
        })),
        maps: maps.map((map) => ({ map, label: displayMapName(map) })),
        sides: sidesOf(view),
        canAdd: draft.entries.length < maps.length,
        problems: problems.map((problem) => problem.message),
        body: problems.length === 0 ? bodyOf(draft.entries) : null,
        outdated: draft.version !== view.version,
    }
}
