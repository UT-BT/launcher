import type {
    EventMatch, EventMatchInput, EventMatchMap, EventMatchMapInput, EventMatchStatus, EventSide, MatchSideSource,
    PredictionMarket,
} from '@/app/utils/api'
import { fromZonedInput, toZonedInput } from '@/app/utils/timezone'
import { sideOf } from '../bracket/bracketShared'

export const SLOT_CHANGE_WARNING = 'Changing bracket slots voids the prediction market and refunds every bet.'
export const RESULTS_AFTER_SLOTS = 'Save the bracket slots first, then edit results'

export const RED_SIDE_SOURCE_LABELS: Record<MatchSideSource, string> = {
    step0: 'Step 0',
    admin: 'Admin',
    caster: 'Caster',
    backfill: 'Backfill',
}

const DERIVED_STATUSES: EventMatchStatus[] = ['complete', 'forfeit']

export interface MatchEditorFields {
    teamA: string
    teamB: string
    status: EventMatchStatus
    scheduledAt: string
    streamUrl: string
    notes: string
    published: boolean
}

export interface MatchEditorDraft {
    fields: MatchEditorFields
    redSide: string
    maps: EventMatchMap[]
}

export interface MatchEditorChanges {
    fields: boolean
    slots: boolean
    redSide: boolean
    result: boolean
}

export interface MatchResultInput {
    maps: EventMatchMapInput[]
    forfeit_winner: EventSide | null
}

export type MatchEditorSave =
    | { refused: string }
    | { patch: EventMatchInput | null; result: MatchResultInput | null }

function fieldsFrom(match: EventMatch, timezone: string): MatchEditorFields {
    return {
        teamA: match.team_a?.id ?? '',
        teamB: match.team_b?.id ?? '',
        status: DERIVED_STATUSES.includes(match.status) ? 'pending' : match.status,
        scheduledAt: toZonedInput(match.scheduled_at, timezone),
        streamUrl: match.stream_url ?? '',
        notes: match.notes ?? '',
        published: match.published,
    }
}

function redSideWithin(redSide: string | null, slots: Pick<MatchEditorFields, 'teamA' | 'teamB'>): string {
    return redSide && (redSide === slots.teamA || redSide === slots.teamB) ? redSide : ''
}

function savedRedSide(match: EventMatch): string {
    return redSideWithin(match.red_team_id, { teamA: match.team_a?.id ?? '', teamB: match.team_b?.id ?? '' })
}

export function draftFrom(match: EventMatch, timezone: string): MatchEditorDraft {
    return { fields: fieldsFrom(match, timezone), redSide: savedRedSide(match), maps: match.maps ?? [] }
}

export function withField<K extends keyof MatchEditorFields>(
    draft: MatchEditorDraft,
    key: K,
    value: MatchEditorFields[K],
): MatchEditorDraft {
    const fields = { ...draft.fields, [key]: value }
    return { ...draft, fields, redSide: redSideWithin(draft.redSide, fields) }
}

export function withRedSide(draft: MatchEditorDraft, teamId: string): MatchEditorDraft {
    return { ...draft, redSide: redSideWithin(teamId, draft.fields) }
}

export function withMapRow(draft: MatchEditorDraft, ordinal: number, patch: Partial<EventMatchMap>): MatchEditorDraft {
    return { ...draft, maps: draft.maps.map(row => (row.ordinal === ordinal ? { ...row, ...patch } : row)) }
}

export function toMapInput(row: EventMatchMap): EventMatchMapInput {
    return {
        ordinal: row.ordinal,
        map: row.map,
        kind: row.kind,
        picked_by: row.picked_by,
        caps_a: row.caps_a,
        caps_b: row.caps_b,
        deaths_a: row.deaths_a,
        deaths_b: row.deaths_b,
        winner_side: row.winner_side,
        started_at: row.started_at,
        ended_at: row.ended_at,
        notes: row.notes,
    }
}

function sameMaps(left: EventMatchMap[], right: EventMatchMap[]): boolean {
    return JSON.stringify(left.map(toMapInput)) === JSON.stringify(right.map(toMapInput))
}

function sameFields(left: MatchEditorFields, right: MatchEditorFields): boolean {
    return (Object.keys(left) as Array<keyof MatchEditorFields>).every(key => left[key] === right[key])
}

function sameTeamSet(left: MatchEditorFields, right: MatchEditorFields): boolean {
    const teamsOf = (fields: MatchEditorFields) => [fields.teamA, fields.teamB].sort().join()
    return teamsOf(left) === teamsOf(right)
}

export function changesOf(match: EventMatch, draft: MatchEditorDraft, timezone: string): MatchEditorChanges {
    const saved = fieldsFrom(match, timezone)
    const keptAcrossNewTeams = draft.redSide !== '' && !sameTeamSet(saved, draft.fields)
    return {
        fields: !sameFields(saved, draft.fields),
        slots: saved.teamA !== draft.fields.teamA || saved.teamB !== draft.fields.teamB,
        redSide: draft.redSide !== savedRedSide(match) || keptAcrossNewTeams,
        result: !sameMaps(match.maps ?? [], draft.maps),
    }
}

export function hasChanges(changes: MatchEditorChanges): boolean {
    return changes.fields || changes.redSide || changes.result
}

function patchOf(draft: MatchEditorDraft, changes: MatchEditorChanges, timezone: string): EventMatchInput | null {
    const { fields } = draft
    const red = changes.redSide ? { red_team_id: draft.redSide || null } : {}
    if (!changes.fields) return changes.redSide ? red : null

    return {
        team_a_id: fields.teamA || null,
        team_b_id: fields.teamB || null,
        status: fields.status,
        scheduled_at: fromZonedInput(fields.scheduledAt, timezone),
        stream_url: fields.streamUrl.trim() || null,
        notes: fields.notes.trim() || null,
        published: fields.published,
        ...red,
    }
}

export function planSave(match: EventMatch, draft: MatchEditorDraft, timezone: string, forfeit?: EventSide): MatchEditorSave {
    const changes = changesOf(match, draft, timezone)
    const resultDirty = changes.result || forfeit !== undefined
    if (changes.slots && resultDirty) return { refused: RESULTS_AFTER_SLOTS }

    const recordedForfeit = match.status === 'forfeit' ? sideOf(match, match.winner_team_id) : null
    return {
        patch: patchOf(draft, changes, timezone),
        result: resultDirty ? { maps: draft.maps.map(toMapInput), forfeit_winner: forfeit ?? recordedForfeit } : null,
    }
}

export function redSideOptions(
    fields: MatchEditorFields,
    teamName: (teamId: string) => string,
): Array<{ value: string; label: string }> {
    const teams = [...new Set([fields.teamA, fields.teamB].filter(Boolean))]
    return [{ value: '', label: 'Not set' }, ...teams.map(teamId => ({ value: teamId, label: teamName(teamId) }))]
}

export function redSideSourceLabel(match: EventMatch, draft: MatchEditorDraft, changes: MatchEditorChanges): string | null {
    if (!draft.redSide || changes.redSide || !match.red_side_source) return null
    return RED_SIDE_SOURCE_LABELS[match.red_side_source]
}

export function showsSlotWarning(changes: MatchEditorChanges, market: PredictionMarket | null): boolean {
    return changes.slots && market !== null && market.status !== 'voided'
}
