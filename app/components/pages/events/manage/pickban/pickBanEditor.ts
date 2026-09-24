import type {
    EventFormatSpec, PickBanBlock, PickBanCounts, PickBanPacing, PickBanPoolEntryInput, PickBanPoolMap,
    PickBanPoolSizeStatus, PickBanPoolStatus, PickBanPresetId, PickBanSequence, PickBanStageConfig,
    PickBanStageConfigInput,
} from '@/app/utils/api'
import { parseSpecErrors } from '../formatFields'
import { sameTag } from '../../pickBanTags'

export type PickBanPacingKey = keyof PickBanPacing

export const PICK_BAN_PACING_KEYS: PickBanPacingKey[] = ['intro', 'spotlight', 'ban_down_spotlight', 'decider_spotlight']

export const DEFAULT_PICK_BAN_PACING: PickBanPacing = { intro: 5, spotlight: 10, ban_down_spotlight: 4, decider_spotlight: 10 }

export const PICK_BAN_PACING_MAX_SECONDS = 60

export const PICK_BAN_TAG_MAX_LENGTH = 32

export const PICK_BAN_PRESET_SEQUENCES: Record<PickBanPresetId, PickBanSequence> = {
    bo4_picks: {
        steps: [
            { actor: 'A', action: 'pick' }, { actor: 'B', action: 'pick' },
            { actor: 'B', action: 'pick' }, { actor: 'A', action: 'pick' },
        ],
        ban_down: false,
    },
    bo3_ban_pick: {
        steps: [
            { actor: 'A', action: 'ban' }, { actor: 'B', action: 'ban' },
            { actor: 'B', action: 'pick' }, { actor: 'A', action: 'pick' },
        ],
        ban_down: true,
    },
    bo5_ban_pick: {
        steps: [
            { actor: 'A', action: 'ban' }, { actor: 'B', action: 'ban' },
            { actor: 'B', action: 'pick' }, { actor: 'A', action: 'pick' },
            { actor: 'B', action: 'pick' }, { actor: 'A', action: 'pick' },
            { actor: 'B', action: 'ban' }, { actor: 'A', action: 'ban' },
        ],
        ban_down: true,
    },
}

export interface PickBanExclusionDraft {
    tag: string
    min_pre_cup_seed: number | null
}

export interface PickBanStageDraft {
    presetId: PickBanPresetId | null
    sequence: PickBanSequence | null
    pacing: PickBanPacing
    exclusions: PickBanExclusionDraft[]
    pool: PickBanPoolMap[]
}

export type PickBanDrafts = Record<string, PickBanStageDraft>

export type PickBanPoolScope = 'normal' | 'exempt'

export type PickBanWarning =
    | { kind: 'sequence_mismatch'; mapsYielded: number; bestOf: number }
    | { kind: 'pool_too_small' | 'bans_dropped'; scope: PickBanPoolScope; size: number; minimum: number }

export function sequenceCounts(sequence: PickBanSequence): PickBanCounts {
    const picks = sequence.steps.filter(step => step.action === 'pick').length
    const bans = sequence.steps.filter(step => step.action === 'ban').length
    const banDown = sequence.ban_down ? 1 : 0

    return {
        lettered_picks: picks,
        lettered_bans: bans,
        maps_yielded: picks + banDown,
        full_sequence_minimum: picks + bans + banDown,
        absolute_minimum: picks + banDown,
    }
}

function poolSizeStatus(size: number, counts: PickBanCounts): PickBanPoolSizeStatus {
    if (size >= counts.full_sequence_minimum) return 'full_sequence'
    if (size >= counts.absolute_minimum) return 'bans_dropped'
    return 'too_small'
}

function carriesTag(tags: string[], tag: string): boolean {
    return tags.some(candidate => sameTag(candidate, tag))
}

export function poolStatusFor(pool: PickBanPoolMap[], exclusionTags: string[], counts: PickBanCounts): PickBanPoolStatus {
    const normal = { size: pool.length, status: poolSizeStatus(pool.length, counts) }
    if (exclusionTags.length === 0) return { normal, exempt: null }

    const exemptSize = pool.filter(entry => !exclusionTags.some(tag => carriesTag(entry.tags, tag))).length
    return { normal, exempt: { size: exemptSize, status: poolSizeStatus(exemptSize, counts) } }
}

function poolWarnings(status: PickBanPoolStatus, counts: PickBanCounts): PickBanWarning[] {
    const scoped: Array<[PickBanPoolScope, PickBanPoolStatus['normal'] | null]> = [['normal', status.normal], ['exempt', status.exempt]]

    return scoped.flatMap(([scope, entry]): PickBanWarning[] => {
        if (!entry || entry.status === 'full_sequence') return []
        return entry.status === 'too_small'
            ? [{ kind: 'pool_too_small', scope, size: entry.size, minimum: counts.absolute_minimum }]
            : [{ kind: 'bans_dropped', scope, size: entry.size, minimum: counts.full_sequence_minimum }]
    })
}

function mismatchWarnings(mismatch: boolean, counts: PickBanCounts, bestOf: number): PickBanWarning[] {
    return mismatch ? [{ kind: 'sequence_mismatch', mapsYielded: counts.maps_yielded, bestOf }] : []
}

export function draftWarnings(draft: PickBanStageDraft, bestOf: number): PickBanWarning[] {
    if (!draft.sequence) return []

    const counts = sequenceCounts(draft.sequence)
    const exclusionTags = draft.exclusions.map(rule => rule.tag.trim()).filter(Boolean)

    return [
        ...mismatchWarnings(counts.maps_yielded !== bestOf, counts, bestOf),
        ...poolWarnings(poolStatusFor(draft.pool, exclusionTags, counts), counts),
    ]
}

export function savedWarnings(stage: PickBanStageConfig): PickBanWarning[] {
    if (!stage.counts || !stage.pool_status) return []

    return [
        ...mismatchWarnings(stage.sequence_mismatch, stage.counts, stage.best_of),
        ...poolWarnings(stage.pool_status, stage.counts),
    ]
}

export function stageWarnings(stage: PickBanStageConfig, draft: PickBanStageDraft | undefined): PickBanWarning[] {
    return draft ? draftWarnings(draft, stage.best_of) : savedWarnings(stage)
}

function plural(count: number, word: string): string {
    return `${count} ${word}${count === 1 ? '' : 's'}`
}

export function warningMessage(warning: PickBanWarning): string {
    if (warning.kind === 'sequence_mismatch') {
        return `The sequence yields ${plural(warning.mapsYielded, 'map')}, but this stage is best of ${warning.bestOf}.`
    }

    const exempt = warning.scope === 'exempt'
    const left = `${warning.size} ${warning.size === 1 ? 'is' : 'are'} left once tagged maps are excluded`

    if (warning.kind === 'pool_too_small') {
        return exempt
            ? `Too few maps for exempt matches: ${left}, and the sequence needs at least ${warning.minimum}.`
            : `Too few maps for normal matches: the pool has ${warning.size}, and the sequence needs at least ${warning.minimum}.`
    }

    const skipped = plural(warning.minimum - warning.size, 'ban')
    return exempt
        ? `Exempt matches will skip ${skipped}: ${left}, and the full sequence needs ${warning.minimum}.`
        : `Normal matches will skip ${skipped}: the pool has ${warning.size}, and the full sequence needs ${warning.minimum}.`
}

function copySequence(sequence: PickBanSequence): PickBanSequence {
    return { steps: sequence.steps.map(step => ({ actor: step.actor, action: step.action })), ban_down: sequence.ban_down }
}

export function draftFromStage(stage: PickBanStageConfig): PickBanStageDraft {
    const block = stage.pick_ban

    return {
        presetId: block?.preset_id ?? null,
        sequence: block ? copySequence(block.sequence) : null,
        pacing: { ...DEFAULT_PICK_BAN_PACING, ...block?.pacing },
        exclusions: (block?.exclusions ?? []).map(rule => ({ tag: rule.tag, min_pre_cup_seed: rule.min_pre_cup_seed })),
        pool: stage.pool.map(entry => ({ ...entry, tags: [...entry.tags] })),
    }
}

export function withPreset(draft: PickBanStageDraft, presetId: PickBanPresetId): PickBanStageDraft {
    return { ...draft, presetId, sequence: copySequence(PICK_BAN_PRESET_SEQUENCES[presetId]) }
}

function sequencesEqual(a: PickBanSequence | null, b: PickBanSequence | null): boolean {
    if (!a || !b) return a === b
    return a.ban_down === b.ban_down
        && a.steps.length === b.steps.length
        && a.steps.every((step, index) => step.actor === b.steps[index].actor && step.action === b.steps[index].action)
}

function tagsEqual(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((tag, index) => tag === b[index])
}

export function configChanged(stage: PickBanStageConfig, draft: PickBanStageDraft): boolean {
    const saved = draftFromStage(stage)

    return saved.presetId !== draft.presetId
        || !sequencesEqual(saved.sequence, draft.sequence)
        || PICK_BAN_PACING_KEYS.some(key => saved.pacing[key] !== draft.pacing[key])
        || saved.exclusions.length !== draft.exclusions.length
        || saved.exclusions.some((rule, index) => (
            rule.tag !== draft.exclusions[index].tag || rule.min_pre_cup_seed !== draft.exclusions[index].min_pre_cup_seed
        ))
}

export function poolChanged(stage: PickBanStageConfig, draft: PickBanStageDraft): boolean {
    return stage.pool.length !== draft.pool.length
        || stage.pool.some((entry, index) => entry.map !== draft.pool[index].map || !tagsEqual(entry.tags, draft.pool[index].tags))
}

export function settledDraft(stage: PickBanStageConfig, draft: PickBanStageDraft): PickBanStageDraft | null {
    return configChanged(stage, draft) || poolChanged(stage, draft) ? draft : null
}

export function rebaseDraft(
    stage: PickBanStageConfig,
    draft: PickBanStageDraft,
    saved: { config: boolean; pool: boolean },
): PickBanStageDraft | null {
    const fresh = draftFromStage(stage)
    const configPart = saved.config
        ? { presetId: fresh.presetId, sequence: fresh.sequence, pacing: fresh.pacing, exclusions: fresh.exclusions }
        : {}

    return settledDraft(stage, { ...draft, ...configPart, pool: saved.pool ? fresh.pool : draft.pool })
}

export function withDraft(drafts: PickBanDrafts, stageKey: string, draft: PickBanStageDraft | null): PickBanDrafts {
    if (draft) return { ...drafts, [stageKey]: draft }
    if (!(stageKey in drafts)) return drafts

    const rest = { ...drafts }
    delete rest[stageKey]
    return rest
}

export function pruneDrafts(drafts: PickBanDrafts, stageKeys: string[]): PickBanDrafts {
    const orphans = Object.keys(drafts).filter(key => !stageKeys.includes(key))
    return orphans.reduce((remaining, key) => withDraft(remaining, key, null), drafts)
}

export function poolHasMap(pool: PickBanPoolMap[], mapName: string): boolean {
    return pool.some(entry => entry.map === mapName)
}

export function addPoolMap(pool: PickBanPoolMap[], mapName: string): PickBanPoolMap[] {
    return poolHasMap(pool, mapName) ? pool : [...pool, { map: mapName, tags: [], screenshot_version: null }]
}

export function movePoolMap(pool: PickBanPoolMap[], index: number, offset: -1 | 1): PickBanPoolMap[] {
    const target = index + offset
    if (target < 0 || target >= pool.length) return pool

    const next = [...pool]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
}

export function removePoolMap(pool: PickBanPoolMap[], index: number): PickBanPoolMap[] {
    return pool.filter((_, at) => at !== index)
}

export function tagError(raw: string): string | null {
    const tag = raw.trim()
    if (!tag) return 'is required'
    if (tag.length > PICK_BAN_TAG_MAX_LENGTH) return `must be at most ${PICK_BAN_TAG_MAX_LENGTH} characters`
    return null
}

export function withPoolTag(pool: PickBanPoolMap[], index: number, raw: string): { pool: PickBanPoolMap[]; error: string | null } {
    const error = tagError(raw)
    const entry = pool[index]
    if (error || !entry || carriesTag(entry.tags, raw)) return { pool, error }

    return { pool: pool.map((current, at) => (at === index ? { ...current, tags: [...current.tags, raw.trim()] } : current)), error: null }
}

export function withoutPoolTag(pool: PickBanPoolMap[], index: number, tag: string): PickBanPoolMap[] {
    return pool.map((entry, at) => (
        at === index ? { ...entry, tags: entry.tags.filter(candidate => !sameTag(candidate, tag)) } : entry
    ))
}

function wholeNumberError(value: number | null, minimum: number, maximum?: number): string | null {
    if (value === null) return 'is required'
    if (!Number.isInteger(value)) return 'must be a whole number'
    if (value < minimum) return `must be at least ${minimum}`
    if (maximum !== undefined && value > maximum) return `must be at most ${maximum}`
    return null
}

export function validateConfigDraft(draft: PickBanStageDraft): Record<string, string> {
    const errors: Record<string, string> = {}
    const add = (path: string, error: string | null) => { if (error) errors[path] = error }

    if (!draft.presetId && !draft.sequence) add('sequence', 'choose a sequence preset')

    for (const key of PICK_BAN_PACING_KEYS) {
        add(`pacing.${key}`, wholeNumberError(draft.pacing[key], 0, PICK_BAN_PACING_MAX_SECONDS))
    }

    draft.exclusions.forEach((rule, index) => {
        add(`exclusions[${index}].tag`, tagError(rule.tag))
        add(`exclusions[${index}].min_pre_cup_seed`, wholeNumberError(rule.min_pre_cup_seed, 1))
    })

    return errors
}

export function presetDrifted(draft: PickBanStageDraft): boolean {
    if (!draft.presetId || !draft.sequence) return false
    return !sequencesEqual(draft.sequence, PICK_BAN_PRESET_SEQUENCES[draft.presetId] ?? null)
}

export function configInput(draft: PickBanStageDraft): PickBanStageConfigInput | null {
    if (!draft.sequence) return null

    const rest = {
        exclusions: draft.exclusions.map(rule => ({ tag: rule.tag.trim(), min_pre_cup_seed: rule.min_pre_cup_seed ?? 0 })),
        pacing: { ...draft.pacing },
    }

    return draft.presetId && !presetDrifted(draft)
        ? { preset_id: draft.presetId, ...rest }
        : { sequence: copySequence(draft.sequence), ...rest }
}

export function poolInput(draft: PickBanStageDraft): PickBanPoolEntryInput[] {
    return draft.pool.map(entry => ({ map: entry.map, tags: [...entry.tags] }))
}

function configField(path: string): string | null {
    if (path === 'preset_id' || path === 'sequence' || path.startsWith('sequence.')) return 'sequence'
    if (/^pacing\.(intro|spotlight|ban_down_spotlight|decider_spotlight)$/.test(path)) return path
    if (/^exclusions\[\d+\]\.(tag|min_pre_cup_seed)$/.test(path)) return path
    if (/^exclusions(\[\d+\])?$/.test(path)) return 'exclusions'
    return null
}

export function configErrors(message: string, stageIndex: number): { fields: Record<string, string>; general: string | null } {
    const prefix = `stages[${stageIndex}].pick_ban.`
    const fields: Record<string, string> = {}
    const unplaced: string[] = []

    for (const [path, reason] of Object.entries(parseSpecErrors(message))) {
        const field = configField(path.startsWith(prefix) ? path.slice(prefix.length) : path)
        if (!field) unplaced.push(`${path}: ${reason}`)
        else if (!fields[field]) fields[field] = reason
    }

    if (Object.keys(fields).length === 0) return { fields, general: message }
    return { fields, general: unplaced.length ? unplaced.join('; ') : null }
}

export function poolError(message: string, pool: PickBanPoolMap[]): { map: string | null; message: string } {
    const named = /Map '(.+?)'/.exec(message)?.[1]
    if (named && poolHasMap(pool, named)) return { map: named, message }

    const indexed = /^pool\[(\d+)\]/.exec(message)?.[1]
    if (indexed !== undefined) return { map: pool[Number(indexed)]?.map ?? null, message }

    if (/^[a-z]/.test(message)) return { map: null, message: `A tag ${message}.` }
    return { map: null, message }
}

export function withStagePickBan(spec: EventFormatSpec, stageKey: string, block: PickBanBlock | null): EventFormatSpec {
    return {
        ...spec,
        stages: spec.stages.map(entry => (entry.key === stageKey ? { ...entry, pick_ban: block } : entry)),
    }
}
