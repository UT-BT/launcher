import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { AdminSelect } from '@/app/components/pages/admin/components/controls'
import { PICK_BAN_PRESET_IDS, type PickBanPresetId, type PickBanSequence, type PickBanStageConfig } from '@/app/utils/api'
import { Field, NumberField, SubCard, TextField } from '../formatFields'
import {
    PICK_BAN_PACING_KEYS, PICK_BAN_PACING_MAX_SECONDS, presetDrifted, sequenceCounts, withPreset,
    type PickBanExclusionDraft, type PickBanPacingKey, type PickBanStageDraft,
} from './pickBanEditor'

const CUSTOM_SEQUENCE = 'custom'

const PRESET_LABELS: Record<PickBanPresetId, string> = {
    bo4_picks: 'Bo4 · four picks',
    bo3_ban_pick: 'Bo3 · bans, picks, decider',
    bo5_ban_pick: 'Bo5 · bans, picks, bans, decider',
}

const PACING_LABELS: Record<PickBanPacingKey, string> = {
    intro: 'Intro',
    spotlight: 'Spotlight',
    ban_down_spotlight: 'Ban-down spotlight',
    decider_spotlight: 'Decider spotlight',
}

interface PickBanSequenceSettingsProps {
    stage: PickBanStageConfig
    draft: PickBanStageDraft
    errors: Record<string, string>
    disabled: boolean
    onChange: (draft: PickBanStageDraft) => void
}

function StepChip({ label, tone }: { label: string; tone: 'ban' | 'pick' | 'neutral' }) {
    return (
        <span className={cn(
            'inline-flex items-center h-6 px-1.5 rounded-md border text-[11px] font-medium',
            tone === 'ban' && 'border-red-500/30 bg-red-500/10 text-red-300',
            tone === 'pick' && 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
            tone === 'neutral' && 'border-white/10 bg-white/5 text-muted-foreground',
        )}>
            {label}
        </span>
    )
}

function SequencePreview({ sequence }: { sequence: PickBanSequence }) {
    const counts = sequenceCounts(sequence)

    return (
        <div className="space-y-1.5">
            <ol className="flex flex-wrap gap-1" aria-label="Sequence steps">
                {sequence.steps.map((step, index) => (
                    <li key={index}><StepChip label={`${step.actor} ${step.action}`} tone={step.action} /></li>
                ))}
                {sequence.ban_down && (
                    <>
                        <li><StepChip label="ban-down" tone="neutral" /></li>
                        <li><StepChip label="decider" tone="neutral" /></li>
                    </>
                )}
            </ol>
            <p className="text-[11px] text-muted-foreground leading-snug">
                Yields {counts.maps_yielded} map{counts.maps_yielded === 1 ? '' : 's'}. The full sequence needs {counts.full_sequence_minimum} pool
                maps; with every ban skipped it still runs on {counts.absolute_minimum}.
            </p>
        </div>
    )
}

function ExclusionRow({ rule, index, errors, disabled, onChange, onRemove }: {
    rule: PickBanExclusionDraft
    index: number
    errors: Record<string, string>
    disabled: boolean
    onChange: (rule: PickBanExclusionDraft) => void
    onRemove: () => void
}) {
    return (
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,8rem)_auto] items-start gap-2">
            <TextField
                label="Tag"
                path={`exclusions[${index}].tag`}
                errors={errors}
                value={rule.tag}
                placeholder="Hard"
                disabled={disabled}
                onChange={tag => onChange({ ...rule, tag })}
            />
            <NumberField
                label="From pre-cup seed"
                path={`exclusions[${index}].min_pre_cup_seed`}
                errors={errors}
                value={rule.min_pre_cup_seed}
                min={1}
                nullable
                disabled={disabled}
                onChange={min_pre_cup_seed => onChange({ ...rule, min_pre_cup_seed })}
            />
            <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                aria-label={`Remove the ${rule.tag.trim() || 'blank'} exclusion rule`}
                className="mt-[1.125rem] size-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-red-300 hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
                <Trash2 className="size-3.5" />
            </button>
        </div>
    )
}

export function PickBanSequenceSettings({ stage, draft, errors, disabled, onChange }: PickBanSequenceSettingsProps) {
    const storedCustom = stage.pick_ban && stage.pick_ban.preset_id === null ? stage.pick_ban.sequence : null
    const options = [
        ...PICK_BAN_PRESET_IDS.map(id => ({ value: id, label: PRESET_LABELS[id] })),
        ...(storedCustom ? [{ value: CUSTOM_SEQUENCE, label: 'Custom sequence' }] : []),
    ]
    const selected = draft.presetId ?? (draft.sequence ? CUSTOM_SEQUENCE : '')

    const choose = (value: string) => {
        if (disabled) return
        if (value === CUSTOM_SEQUENCE) {
            if (storedCustom) onChange({ ...draft, presetId: null, sequence: storedCustom })
            return
        }
        onChange(withPreset(draft, value as PickBanPresetId))
    }

    const setRule = (index: number, rule: PickBanExclusionDraft) => {
        onChange({ ...draft, exclusions: draft.exclusions.map((current, at) => (at === index ? rule : current)) })
    }

    return (
        <div className="flex flex-col gap-4 min-w-0">
            <SubCard title="Sequence">
                <Field label="Preset" path="sequence" errors={errors}>
                    <AdminSelect
                        value={selected}
                        onChange={choose}
                        options={options}
                        placeholder="Choose a preset…"
                        ariaLabel={`${stage.name} sequence preset`}
                        className={cn('h-8 w-full text-xs', errors.sequence && 'border-red-500/50')}
                    />
                </Field>
                {presetDrifted(draft) && (
                    <p className="text-[11px] leading-snug text-amber-300">
                        These steps come from an older version of this preset. Saving keeps them as a custom sequence;
                        choose the preset again to take its current steps.
                    </p>
                )}
                {draft.sequence && <SequencePreview sequence={draft.sequence} />}
            </SubCard>

            <SubCard title="Pacing (seconds)">
                <div className="grid grid-cols-2 gap-2">
                    {PICK_BAN_PACING_KEYS.map(key => (
                        <NumberField
                            key={key}
                            label={PACING_LABELS[key]}
                            path={`pacing.${key}`}
                            errors={errors}
                            value={draft.pacing[key]}
                            min={0}
                            max={PICK_BAN_PACING_MAX_SECONDS}
                            disabled={disabled}
                            onChange={value => onChange({ ...draft, pacing: { ...draft.pacing, [key]: value } })}
                        />
                    ))}
                </div>
            </SubCard>

            <SubCard
                title="Exclusion rule"
                action={
                    <button
                        type="button"
                        onClick={() => onChange({ ...draft, exclusions: [...draft.exclusions, { tag: '', min_pre_cup_seed: null }] })}
                        disabled={disabled}
                        className="inline-flex items-center gap-1 h-8 px-2 rounded-md text-[11px] font-medium text-accent-300 hover:text-accent-200 hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Plus className="size-3.5" /> Add rule
                    </button>
                }
            >
                {errors.exclusions && <p className="text-[11px] text-red-300">{errors.exclusions}</p>}
                {draft.exclusions.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No rule. Every match draws from the whole pool.</p>
                ) : (
                    <>
                        {draft.exclusions.map((rule, index) => (
                            <ExclusionRow
                                key={index}
                                rule={rule}
                                index={index}
                                errors={errors}
                                disabled={disabled}
                                onChange={next => setRule(index, next)}
                                onRemove={() => onChange({ ...draft, exclusions: draft.exclusions.filter((_, at) => at !== index) })}
                            />
                        ))}
                        <p className="text-[11px] text-muted-foreground leading-snug">
                            When either team&apos;s pre-cup seed is at or past the threshold, maps carrying the tag leave that match&apos;s pool for both teams.
                        </p>
                    </>
                )}
            </SubCard>
        </div>
    )
}
