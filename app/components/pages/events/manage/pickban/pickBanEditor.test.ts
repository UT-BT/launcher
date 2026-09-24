import { describe, expect, it } from 'vitest'
import type { EventFormatSpec, PickBanBlock, PickBanPoolMap, PickBanStageConfig } from '@/app/utils/api'
import {
    DEFAULT_PICK_BAN_PACING, PICK_BAN_PRESET_SEQUENCES, addPoolMap, configChanged, configErrors, configInput,
    draftFromStage, draftWarnings, movePoolMap, poolChanged, poolError, poolInput, poolStatusFor, pruneDrafts,
    presetDrifted, rebaseDraft, removePoolMap, savedWarnings, sequenceCounts, settledDraft, stageWarnings, tagError,
    validateConfigDraft, warningMessage, withDraft, withPoolTag, withPreset, withStagePickBan, withoutPoolTag,
    type PickBanStageDraft,
} from './pickBanEditor'

function card(map: string, tags: string[] = []): PickBanPoolMap {
    return { map, tags, screenshot_version: null }
}

function pool(count: number, hardCount = 0): PickBanPoolMap[] {
    return Array.from({ length: count }, (_, index) => card(`CTF-BT-Map${index + 1}`, index < hardCount ? ['Hard'] : []))
}

function block(patch: Partial<PickBanBlock> = {}): PickBanBlock {
    return {
        preset_id: 'bo5_ban_pick',
        sequence: PICK_BAN_PRESET_SEQUENCES.bo5_ban_pick,
        exclusions: [{ tag: 'Hard', min_pre_cup_seed: 10 }],
        pacing: { ...DEFAULT_PICK_BAN_PACING },
        ...patch,
    }
}

function stage(patch: Partial<PickBanStageConfig> = {}): PickBanStageConfig {
    return {
        key: 'playoffs',
        name: 'Playoffs',
        best_of: 5,
        pick_ban: block(),
        counts: { lettered_picks: 4, lettered_bans: 4, maps_yielded: 5, full_sequence_minimum: 9, absolute_minimum: 5 },
        sequence_mismatch: false,
        pool: pool(12, 4),
        pool_status: { normal: { size: 12, status: 'full_sequence' }, exempt: { size: 8, status: 'bans_dropped' } },
        ...patch,
    }
}

describe('sequenceCounts', () => {
    it('matches the server counts for every shipped preset', () => {
        expect(sequenceCounts(PICK_BAN_PRESET_SEQUENCES.bo4_picks)).toEqual({
            lettered_picks: 4, lettered_bans: 0, maps_yielded: 4, full_sequence_minimum: 4, absolute_minimum: 4,
        })
        expect(sequenceCounts(PICK_BAN_PRESET_SEQUENCES.bo3_ban_pick)).toEqual({
            lettered_picks: 2, lettered_bans: 2, maps_yielded: 3, full_sequence_minimum: 5, absolute_minimum: 3,
        })
        expect(sequenceCounts(PICK_BAN_PRESET_SEQUENCES.bo5_ban_pick)).toEqual({
            lettered_picks: 4, lettered_bans: 4, maps_yielded: 5, full_sequence_minimum: 9, absolute_minimum: 5,
        })
    })

    it('counts a pure ban-down as one map', () => {
        expect(sequenceCounts({ steps: [], ban_down: true })).toEqual({
            lettered_picks: 0, lettered_bans: 0, maps_yielded: 1, full_sequence_minimum: 1, absolute_minimum: 1,
        })
    })

    it('copies the preset steps the server ships', () => {
        expect(PICK_BAN_PRESET_SEQUENCES.bo3_ban_pick).toEqual({
            steps: [
                { actor: 'A', action: 'ban' }, { actor: 'B', action: 'ban' },
                { actor: 'B', action: 'pick' }, { actor: 'A', action: 'pick' },
            ],
            ban_down: true,
        })
    })
})

describe('poolStatusFor', () => {
    const counts = sequenceCounts(PICK_BAN_PRESET_SEQUENCES.bo5_ban_pick)

    it('reads full sequence, dropped bans and too small at the server thresholds', () => {
        expect(poolStatusFor(pool(9), [], counts).normal).toEqual({ size: 9, status: 'full_sequence' })
        expect(poolStatusFor(pool(8), [], counts).normal).toEqual({ size: 8, status: 'bans_dropped' })
        expect(poolStatusFor(pool(5), [], counts).normal).toEqual({ size: 5, status: 'bans_dropped' })
        expect(poolStatusFor(pool(4), [], counts).normal).toEqual({ size: 4, status: 'too_small' })
    })

    it('has no exempt status without an exclusion tag', () => {
        expect(poolStatusFor(pool(12, 4), [], counts).exempt).toBeNull()
    })

    it('removes tagged maps case-insensitively for exempt matches', () => {
        const mixed = [card('A', ['hard']), card('B', [' HARD ']), card('C', ['Fast']), ...pool(6)]
        expect(poolStatusFor(mixed, ['Hard'], counts)).toEqual({
            normal: { size: 9, status: 'full_sequence' },
            exempt: { size: 7, status: 'bans_dropped' },
        })
    })
})

describe('warnings', () => {
    it('agrees with the server status for the same stage', () => {
        const cases: PickBanStageConfig[] = [
            stage(),
            stage({ pool: pool(9, 5), pool_status: { normal: { size: 9, status: 'full_sequence' }, exempt: { size: 4, status: 'too_small' } } }),
            stage({ pool: pool(4), pool_status: { normal: { size: 4, status: 'too_small' }, exempt: { size: 4, status: 'too_small' } } }),
            stage({
                best_of: 4,
                sequence_mismatch: true,
                pool: pool(7),
                pool_status: { normal: { size: 7, status: 'bans_dropped' }, exempt: { size: 7, status: 'bans_dropped' } },
            }),
            stage({
                pick_ban: block({ preset_id: 'bo4_picks', sequence: PICK_BAN_PRESET_SEQUENCES.bo4_picks, exclusions: [] }),
                best_of: 4,
                counts: sequenceCounts(PICK_BAN_PRESET_SEQUENCES.bo4_picks),
                pool: pool(3),
                pool_status: { normal: { size: 3, status: 'too_small' }, exempt: null },
            }),
        ]

        for (const entry of cases) {
            expect(draftWarnings(draftFromStage(entry), entry.best_of)).toEqual(savedWarnings(entry))
        }
    })

    it('lists a mismatch, then normal, then exempt problems', () => {
        const saved = stage({
            best_of: 3,
            sequence_mismatch: true,
            pool: pool(7, 3),
            pool_status: { normal: { size: 7, status: 'bans_dropped' }, exempt: { size: 4, status: 'too_small' } },
        })

        expect(savedWarnings(saved)).toEqual([
            { kind: 'sequence_mismatch', mapsYielded: 5, bestOf: 3 },
            { kind: 'bans_dropped', scope: 'normal', size: 7, minimum: 9 },
            { kind: 'pool_too_small', scope: 'exempt', size: 4, minimum: 5 },
        ])
    })

    it('has nothing to say about a stage without a sequence', () => {
        const bare = stage({ pick_ban: null, counts: null, pool_status: null, pool: [] })
        expect(savedWarnings(bare)).toEqual([])
        expect(draftWarnings(draftFromStage(bare), 5)).toEqual([])
    })

    it('recomputes from the draft while editing', () => {
        const saved = stage()
        const draft = { ...draftFromStage(saved), pool: pool(6, 2) }

        expect(stageWarnings(saved, draft)).toEqual([
            { kind: 'bans_dropped', scope: 'normal', size: 6, minimum: 9 },
            { kind: 'pool_too_small', scope: 'exempt', size: 4, minimum: 5 },
        ])
        expect(stageWarnings(saved, undefined)).toEqual(savedWarnings(saved))
    })

    it('ignores an exclusion row whose tag is still blank', () => {
        const draft = { ...draftFromStage(stage()), exclusions: [{ tag: '  ', min_pre_cup_seed: 10 }], pool: pool(9, 9) }
        expect(draftWarnings(draft, 5)).toEqual([])
    })

    it('words each warning for the editor', () => {
        expect(warningMessage({ kind: 'sequence_mismatch', mapsYielded: 3, bestOf: 5 }))
            .toBe('The sequence yields 3 maps, but this stage is best of 5.')
        expect(warningMessage({ kind: 'pool_too_small', scope: 'normal', size: 4, minimum: 5 }))
            .toBe('Too few maps for normal matches: the pool has 4, and the sequence needs at least 5.')
        expect(warningMessage({ kind: 'pool_too_small', scope: 'exempt', size: 1, minimum: 5 }))
            .toBe('Too few maps for exempt matches: 1 is left once tagged maps are excluded, and the sequence needs at least 5.')
        expect(warningMessage({ kind: 'bans_dropped', scope: 'normal', size: 8, minimum: 9 }))
            .toBe('Normal matches will skip 1 ban: the pool has 8, and the full sequence needs 9.')
        expect(warningMessage({ kind: 'bans_dropped', scope: 'exempt', size: 6, minimum: 9 }))
            .toBe('Exempt matches will skip 3 bans: 6 are left once tagged maps are excluded, and the full sequence needs 9.')
    })
})

describe('drafts', () => {
    it('starts an unconfigured stage from the defaults', () => {
        expect(draftFromStage(stage({ pick_ban: null, pool: [] }))).toEqual({
            presetId: null, sequence: null, pacing: { intro: 5, spotlight: 10, ban_down_spotlight: 4, decider_spotlight: 10 },
            exclusions: [], pool: [],
        })
    })

    it('is unchanged until something differs from the saved stage', () => {
        const saved = stage()
        const draft = draftFromStage(saved)

        expect(configChanged(saved, draft)).toBe(false)
        expect(poolChanged(saved, draft)).toBe(false)
        expect(settledDraft(saved, draft)).toBeNull()
    })

    it('ignores key order the server may return', () => {
        const saved = stage({
            pick_ban: block({
                sequence: { ban_down: true, steps: PICK_BAN_PRESET_SEQUENCES.bo5_ban_pick.steps.map(step => ({ action: step.action, actor: step.actor })) },
                pacing: { spotlight: 10, intro: 5, decider_spotlight: 10, ban_down_spotlight: 4 },
            }),
        })

        expect(settledDraft(saved, withPreset(draftFromStage(saved), 'bo5_ban_pick'))).toBeNull()
    })

    it('tells a config edit from a pool edit', () => {
        const saved = stage()
        const paced = { ...draftFromStage(saved), pacing: { ...DEFAULT_PICK_BAN_PACING, intro: 7 } }
        const retagged = { ...draftFromStage(saved), pool: withoutPoolTag(saved.pool, 0, 'Hard') }

        expect([configChanged(saved, paced), poolChanged(saved, paced)]).toEqual([true, false])
        expect([configChanged(saved, retagged), poolChanged(saved, retagged)]).toEqual([false, true])
    })

    it('settles back to no draft when an edit is undone', () => {
        const saved = stage()
        const moved = { ...draftFromStage(saved), pool: movePoolMap(saved.pool, 0, 1) }

        expect(settledDraft(saved, moved)).toBe(moved)
        expect(settledDraft(saved, { ...moved, pool: movePoolMap(moved.pool, 1, -1) })).toBeNull()
    })

    it('marks an unconfigured stage changed once a preset is chosen', () => {
        const bare = stage({ pick_ban: null })
        const chosen = withPreset(draftFromStage(bare), 'bo3_ban_pick')

        expect(chosen.presetId).toBe('bo3_ban_pick')
        expect(chosen.sequence).toEqual(PICK_BAN_PRESET_SEQUENCES.bo3_ban_pick)
        expect(configChanged(bare, chosen)).toBe(true)
    })

    it('copies preset steps instead of sharing them', () => {
        const chosen = withPreset(draftFromStage(stage()), 'bo4_picks')
        chosen.sequence?.steps.push({ actor: 'A', action: 'ban' })

        expect(PICK_BAN_PRESET_SEQUENCES.bo4_picks.steps).toHaveLength(4)
    })

    it('keeps only the unsaved half after a partial save', () => {
        const before = stage()
        const draft: PickBanStageDraft = {
            ...draftFromStage(before),
            pacing: { ...DEFAULT_PICK_BAN_PACING, intro: 7 },
            pool: removePoolMap(before.pool, 0),
        }
        const afterConfig = stage({ pick_ban: block({ pacing: { ...DEFAULT_PICK_BAN_PACING, intro: 7 } }) })

        const rebased = rebaseDraft(afterConfig, draft, { config: true, pool: false })
        expect(rebased && configChanged(afterConfig, rebased)).toBe(false)
        expect(rebased && poolChanged(afterConfig, rebased)).toBe(true)

        const afterBoth = stage({ pick_ban: afterConfig.pick_ban, pool: draft.pool })
        expect(rebaseDraft(afterBoth, draft, { config: true, pool: true })).toBeNull()
    })

    it('adds, replaces and drops stage drafts by key', () => {
        const draft = draftFromStage(stage())
        const drafts = withDraft({}, 'groups', draft)

        expect(drafts).toEqual({ groups: draft })
        expect(withDraft(drafts, 'groups', null)).toEqual({})
        expect(withDraft({}, 'groups', null)).toEqual({})
    })

    it('forgets drafts for stages the format no longer has', () => {
        const draft = draftFromStage(stage())
        const drafts = { groups: draft, gone: draft }

        expect(pruneDrafts(drafts, ['groups', 'playoffs'])).toEqual({ groups: draft })
    })

    it('keeps the same drafts object when nothing is pruned', () => {
        const drafts = { groups: draftFromStage(stage()) }

        expect(pruneDrafts(drafts, ['groups'])).toBe(drafts)
    })
})

describe('pool editing', () => {
    it('appends a map once', () => {
        const start = [card('CTF-BT-A')]

        expect(addPoolMap(start, 'CTF-BT-B').map(entry => entry.map)).toEqual(['CTF-BT-A', 'CTF-BT-B'])
        expect(addPoolMap(start, 'CTF-BT-A')).toBe(start)
    })

    it('moves a map up or down and stops at the ends', () => {
        const start = [card('A'), card('B'), card('C')]

        expect(movePoolMap(start, 2, -1).map(entry => entry.map)).toEqual(['A', 'C', 'B'])
        expect(movePoolMap(start, 0, 1).map(entry => entry.map)).toEqual(['B', 'A', 'C'])
        expect(movePoolMap(start, 0, -1)).toBe(start)
        expect(movePoolMap(start, 2, 1)).toBe(start)
    })

    it('removes a map by position', () => {
        expect(removePoolMap([card('A'), card('B')], 0).map(entry => entry.map)).toEqual(['B'])
    })

    it('trims tags and skips a case-insensitive duplicate', () => {
        const start = [card('A', ['Hard'])]

        expect(withPoolTag(start, 0, '  Long ')).toEqual({ pool: [card('A', ['Hard', 'Long'])], error: null })
        expect(withPoolTag(start, 0, 'hard')).toEqual({ pool: start, error: null })
    })

    it('rejects a blank or overlong tag with the server wording', () => {
        const start = [card('A')]

        expect(withPoolTag(start, 0, '   ')).toEqual({ pool: start, error: 'is required' })
        expect(withPoolTag(start, 0, 'x'.repeat(33))).toEqual({ pool: start, error: 'must be at most 32 characters' })
        expect(tagError('x'.repeat(32))).toBeNull()
    })

    it('removes one tag case-insensitively', () => {
        expect(withoutPoolTag([card('A', ['Hard', 'Long'])], 0, 'HARD')).toEqual([card('A', ['Long'])])
    })
})

describe('validateConfigDraft', () => {
    const valid = withPreset(draftFromStage(stage({ pick_ban: null })), 'bo4_picks')

    it('accepts a preset with default pacing and no exclusions', () => {
        expect(validateConfigDraft(valid)).toEqual({})
    })

    it('asks for a sequence first', () => {
        expect(validateConfigDraft({ ...valid, presetId: null, sequence: null })).toEqual({ sequence: 'choose a sequence preset' })
    })

    it('keeps pacing to whole seconds from 0 to 60', () => {
        expect(validateConfigDraft({
            ...valid,
            pacing: { intro: 61, spotlight: -1, ban_down_spotlight: 2.5, decider_spotlight: 60 },
        })).toEqual({
            'pacing.intro': 'must be at most 60',
            'pacing.spotlight': 'must be at least 0',
            'pacing.ban_down_spotlight': 'must be a whole number',
        })
    })

    it('checks each exclusion rule at its own path', () => {
        expect(validateConfigDraft({
            ...valid,
            exclusions: [
                { tag: 'Hard', min_pre_cup_seed: 10 },
                { tag: ' ', min_pre_cup_seed: null },
                { tag: 'x'.repeat(40), min_pre_cup_seed: 0 },
            ],
        })).toEqual({
            'exclusions[1].tag': 'is required',
            'exclusions[1].min_pre_cup_seed': 'is required',
            'exclusions[2].tag': 'must be at most 32 characters',
            'exclusions[2].min_pre_cup_seed': 'must be at least 1',
        })
    })
})

describe('payloads', () => {
    it('sends a preset by id', () => {
        const draft = { ...withPreset(draftFromStage(stage()), 'bo3_ban_pick'), exclusions: [{ tag: ' Hard ', min_pre_cup_seed: 10 }] }

        expect(configInput(draft)).toEqual({
            preset_id: 'bo3_ban_pick',
            exclusions: [{ tag: 'Hard', min_pre_cup_seed: 10 }],
            pacing: DEFAULT_PICK_BAN_PACING,
        })
    })

    const olderBo5 = {
        steps: PICK_BAN_PRESET_SEQUENCES.bo5_ban_pick.steps.slice(0, 6),
        ban_down: true,
    }

    it('re-sends an unchanged preset whose saved steps still match it', () => {
        const draft = { ...draftFromStage(stage()), pacing: { ...DEFAULT_PICK_BAN_PACING, intro: 8 } }

        expect(configInput(draft)).toEqual({
            preset_id: 'bo5_ban_pick',
            exclusions: [{ tag: 'Hard', min_pre_cup_seed: 10 }],
            pacing: { ...DEFAULT_PICK_BAN_PACING, intro: 8 },
        })
    })

    it('keeps saved steps verbatim when the shipped preset has changed since they were copied', () => {
        const saved = stage({ pick_ban: block({ preset_id: 'bo5_ban_pick', sequence: olderBo5 }) })
        const draft = { ...draftFromStage(saved), pacing: { ...DEFAULT_PICK_BAN_PACING, intro: 8 } }

        expect(configInput(draft)).toEqual({
            sequence: olderBo5,
            exclusions: [{ tag: 'Hard', min_pre_cup_seed: 10 }],
            pacing: { ...DEFAULT_PICK_BAN_PACING, intro: 8 },
        })
    })

    it('sends the preset when the admin picks a different one over drifted steps', () => {
        const saved = stage({ pick_ban: block({ preset_id: 'bo5_ban_pick', sequence: olderBo5 }) })

        expect(configInput(withPreset(draftFromStage(saved), 'bo3_ban_pick'))).toMatchObject({ preset_id: 'bo3_ban_pick' })
    })

    it('sends the preset when the admin re-picks the same one to take its current steps', () => {
        const saved = stage({ pick_ban: block({ preset_id: 'bo5_ban_pick', sequence: olderBo5 }) })

        expect(configInput(withPreset(draftFromStage(saved), 'bo5_ban_pick'))).toMatchObject({ preset_id: 'bo5_ban_pick' })
    })

    it('flags a preset whose saved steps no longer match the shipped preset', () => {
        const drifted = draftFromStage(stage({ pick_ban: block({ preset_id: 'bo5_ban_pick', sequence: olderBo5 }) }))

        expect(presetDrifted(drifted)).toBe(true)
        expect(presetDrifted(withPreset(drifted, 'bo5_ban_pick'))).toBe(false)
        expect(presetDrifted(draftFromStage(stage()))).toBe(false)
        expect(presetDrifted(draftFromStage(stage({ pick_ban: block({ preset_id: null, sequence: olderBo5 }) })))).toBe(false)
    })

    it('sends a custom sequence as its steps', () => {
        const sequence = { steps: [{ actor: 'A' as const, action: 'pick' as const }], ban_down: true }
        const draft = draftFromStage(stage({ pick_ban: block({ preset_id: null, sequence, exclusions: [] }) }))

        expect(configInput(draft)).toEqual({ sequence, exclusions: [], pacing: DEFAULT_PICK_BAN_PACING })
    })

    it('has nothing to send without a sequence', () => {
        expect(configInput(draftFromStage(stage({ pick_ban: null })))).toBeNull()
    })

    it('sends the pool as map and tags in order', () => {
        const draft = { ...draftFromStage(stage()), pool: [card('B', ['Hard']), card('A')] }

        expect(poolInput(draft)).toEqual([{ map: 'B', tags: ['Hard'] }, { map: 'A', tags: [] }])
    })
})

describe('configErrors', () => {
    it('places route errors next to their field', () => {
        expect(configErrors('preset_id: does not name a pick/ban preset (must be one of: bo4_picks)', 1)).toEqual({
            fields: { sequence: 'does not name a pick/ban preset (must be one of: bo4_picks)' },
            general: null,
        })
    })

    it('strips this stage\'s format prefix from whole-format errors', () => {
        expect(configErrors(
            'stages[1].pick_ban.pacing.intro: must be at most 60; stages[1].pick_ban.exclusions[0].tag: is required; stages[1].pick_ban.sequence.steps[2].actor: must be one of: A, B',
            1,
        )).toEqual({
            fields: {
                'pacing.intro': 'must be at most 60',
                'exclusions[0].tag': 'is required',
                sequence: 'must be one of: A, B',
            },
            general: null,
        })
    })

    it('keeps problems it cannot place for the card', () => {
        expect(configErrors('stages[0].pick_ban.pacing.intro: must be at most 60; stages[3].key: is used by an earlier stage', 0)).toEqual({
            fields: { 'pacing.intro': 'must be at most 60' },
            general: 'stages[3].key: is used by an earlier stage',
        })
        expect(configErrors('stage_key: does not name a stage in this format', 0)).toEqual({
            fields: {},
            general: 'stage_key: does not name a stage in this format',
        })
        expect(configErrors('You cannot manage this event.', 0)).toEqual({ fields: {}, general: 'You cannot manage this event.' })
    })
})

describe('poolError', () => {
    const entries = [card('CTF-BT-A'), card('CTF-BT-B')]

    it('pins a map error to its row', () => {
        expect(poolError("Map 'CTF-BT-B' is not active.", entries)).toEqual({ map: 'CTF-BT-B', message: "Map 'CTF-BT-B' is not active." })
        expect(poolError("pool[0] must be an object with a 'map' field.", entries).map).toBe('CTF-BT-A')
    })

    it('names a bare tag reason', () => {
        expect(poolError('must be at most 32 characters', entries)).toEqual({ map: null, message: 'A tag must be at most 32 characters.' })
    })

    it('passes anything else through', () => {
        expect(poolError("Field 'stage_key' does not name a stage in this event's format.", entries)).toEqual({
            map: null, message: "Field 'stage_key' does not name a stage in this event's format.",
        })
    })
})

describe('withStagePickBan', () => {
    it('writes the saved block into one stage of a format draft', () => {
        const spec = {
            version: 1,
            match_defaults: { best_of: 3, caps_to_win_map: 4, mode: 'first_to', decider: null },
            stages: [{ key: 'groups', name: 'Groups' }, { key: 'playoffs', name: 'Playoffs' }],
        } as unknown as EventFormatSpec
        const saved = block()

        const next = withStagePickBan(spec, 'playoffs', saved)

        expect(next.stages[1].pick_ban).toBe(saved)
        expect(next.stages[0]).toBe(spec.stages[0])
        expect(spec.stages[1].pick_ban).toBeUndefined()
    })
})
