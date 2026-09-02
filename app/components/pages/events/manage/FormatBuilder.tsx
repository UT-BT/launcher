import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, GripVertical, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EVENT_TIEBREAKERS } from '@/app/utils/api'
import type {
    EventElimConfig, EventFormatSpec, EventGroupsConfig, EventMatchDefaults, EventPointsRow,
    EventStageKind, EventStageSpec, EventSwissConfig, EventTiebreaker,
} from '@/app/utils/api'
import { teamInputClass } from '@/app/components/pages/teams/teamsShared'
import {
    CheckField, NumberField, SelectField, STAGE_KIND_LABELS, STAGE_KIND_OPTIONS, STAGE_KIND_STYLES,
    SubCard, TextField, TIEBREAKER_LABELS, defaultConfigFor, defaultPointsTable,
    effectiveDefaults, newStage, syncPointsTable, withSyncedPoints,
} from './formatFields'

interface BuilderProps {
    spec: EventFormatSpec
    onChange: (spec: EventFormatSpec) => void
    errors?: Record<string, string>
    disabled?: boolean
}

function nextKeyNumber(prefix: string, taken: string[]): number {
    let number = taken.length + 1
    while (taken.includes(`${prefix}${number}`)) number += 1
    return number
}

function withCurrent(options: Array<{ value: string; label: string }>, value: string) {
    return !value || options.some(option => option.value === value)
        ? options
        : [...options, { value, label: `${value} (unavailable)` }]
}

function retargetStage(stage: EventStageSpec, from: string, to: string): EventStageSpec {
    const advancement = stage.advancement.map(rule => (rule.to_stage === from ? { ...rule, to_stage: to } : rule))
    if (stage.kind !== 'single_elim') return { ...stage, advancement }

    const config = stage.config as EventElimConfig
    return {
        ...stage,
        advancement,
        config: {
            ...config,
            pots: config.pots.map(pot => ({
                ...pot,
                sources: pot.sources.map(source => (source.stage === from ? { ...source, stage: to } : source)),
            })),
        },
    }
}

function replaceStage(spec: EventFormatSpec, index: number, stage: EventStageSpec): EventFormatSpec {
    const stages = spec.stages.map((entry, at) => (at === index ? stage : entry))
    const previous = spec.stages[index].key

    return previous === stage.key
        ? { ...spec, stages }
        : { ...spec, stages: stages.map(entry => retargetStage(entry, previous, stage.key)) }
}

function IconButton({ icon: Icon, title, onClick, disabled, tone = 'muted' }: {
    icon: typeof Plus
    title: string
    onClick: () => void
    disabled?: boolean
    tone?: 'muted' | 'red'
}) {
    return (
        <button
            type="button"
            title={title}
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'p-1 rounded-md transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed',
                tone === 'red'
                    ? 'text-red-300 hover:bg-red-500/10'
                    : 'text-muted-foreground hover:text-white hover:bg-white/5',
            )}
        >
            <Icon className="size-3.5" />
        </button>
    )
}

function RowList({ label, onAdd, addLabel, disabled, children }: {
    label: string
    onAdd: () => void
    addLabel: string
    disabled?: boolean
    children: React.ReactNode
}) {
    return (
        <SubCard
            title={label}
            action={
                <button
                    type="button"
                    onClick={onAdd}
                    disabled={disabled}
                    className="inline-flex items-center gap-1 text-[11px] text-accent-300 hover:text-accent-200 cursor-pointer disabled:opacity-40"
                >
                    <Plus className="size-3" /> {addLabel}
                </button>
            }
        >
            {children}
        </SubCard>
    )
}

function MatchFormatEditor({ defaults, onChange, base, errors, disabled, needsAWinner }: {
    defaults: EventMatchDefaults
    onChange: (defaults: EventMatchDefaults) => void
    base: string
    errors?: Record<string, string>
    disabled?: boolean
    needsAWinner?: boolean
}) {
    const set = (patch: Partial<EventMatchDefaults>) => onChange({ ...defaults, ...patch })
    const lengths = needsAWinner ? [1, 3, 5, 7] : [1, 2, 3, 4, 5, 6, 7]

    return (
        <>
            <div className="grid gap-3 sm:grid-cols-3">
                <SelectField
                    label="Match runs"
                    value={defaults.mode}
                    onChange={mode => set({
                        mode,
                        decider: mode === 'all_maps' ? null : defaults.decider,
                    })}
                    options={[
                        { value: 'first_to' as const, label: 'Until it is won' },
                        { value: 'all_maps' as const, label: 'Every map is played' },
                    ]}
                    hint={needsAWinner
                        ? 'This stage needs a winner, so a level series stays open.'
                        : 'A level series is a draw.'}
                    path={`${base}.mode`}
                    errors={errors}
                    disabled={disabled}
                />
                <SelectField
                    label="Maps per match"
                    value={String(defaults.best_of)}
                    onChange={value => set({ best_of: Number(value) })}
                    options={lengths.map(n => ({
                        value: String(n),
                        label: defaults.mode === 'all_maps'
                            ? `${n} map${n === 1 ? '' : 's'}`
                            : `Best of ${n} — first to ${Math.floor(n / 2) + 1}`,
                    }))}
                    path={`${base}.best_of`}
                    errors={errors}
                    disabled={disabled}
                />
                <NumberField label="Caps to win a map" value={defaults.caps_to_win_map} min={1}
                    onChange={value => set({ caps_to_win_map: value })}
                    path={`${base}.caps_to_win_map`} errors={errors} disabled={disabled} />
            </div>

            {defaults.mode === 'first_to' && (
                <CheckField
                    label="Decider on the last map"
                    hint="A tied series ends on a separate round-based decider."
                    checked={!!defaults.decider}
                    disabled={disabled}
                    onChange={value => set({ decider: value ? { kind: 'time_attack', rounds_to_win: 5, max_rounds: 9 } : null })}
                />
            )}

            {defaults.mode === 'first_to' && defaults.decider && (
                <div className="grid gap-3 sm:grid-cols-2">
                    <NumberField label="Rounds to win" value={defaults.decider.rounds_to_win} min={1}
                        onChange={value => set({ decider: { ...defaults.decider!, rounds_to_win: value } })}
                        path={`${base}.decider.rounds_to_win`} errors={errors} disabled={disabled} />
                    <NumberField label="Maximum rounds" value={defaults.decider.max_rounds} min={1}
                        onChange={value => set({ decider: { ...defaults.decider!, max_rounds: value } })}
                        path={`${base}.decider.max_rounds`} errors={errors} disabled={disabled} />
                </div>
            )}
        </>
    )
}

function TiebreakerList({ value, onChange, path, errors, disabled }: {
    value: EventTiebreaker[]
    onChange: (value: EventTiebreaker[]) => void
    path: string
    errors?: Record<string, string>
    disabled?: boolean
}) {
    const unused = EVENT_TIEBREAKERS.filter(name => !value.includes(name))

    const move = (index: number, delta: number) => {
        const next = [...value]
        const target = index + delta
        if (target < 0 || target >= next.length) return
        ;[next[index], next[target]] = [next[target], next[index]]
        onChange(next)
    }

    return (
        <SubCard title="Tiebreakers (applied in order)">
            <div className="space-y-1">
                {value.map((name, index) => (
                    <div key={name} className="flex items-center gap-1.5 min-w-0">
                        <GripVertical className="size-3 text-muted-foreground/40 shrink-0" />
                        <span className="w-4 shrink-0 text-[11px] tabular-nums text-muted-foreground/70">{index + 1}</span>
                        <span className="min-w-0 truncate text-xs text-foreground">{TIEBREAKER_LABELS[name] ?? name}</span>
                        <div className="ml-auto flex items-center shrink-0">
                            <IconButton icon={ArrowUp} title="Move up" onClick={() => move(index, -1)} disabled={disabled || index === 0} />
                            <IconButton icon={ArrowDown} title="Move down" onClick={() => move(index, 1)} disabled={disabled || index === value.length - 1} />
                            <IconButton
                                icon={Trash2}
                                title="Remove"
                                tone="red"
                                onClick={() => onChange(value.filter(entry => entry !== name))}
                                disabled={disabled || name === 'seed'}
                            />
                        </div>
                    </div>
                ))}
            </div>

            {errors?.[path] && <p className="text-[11px] text-red-300">{errors[path]}</p>}

            {unused.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1 border-t border-white/5">
                    {unused.map(name => (
                        <button
                            key={name}
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange([...value.filter(entry => entry !== 'seed'), name, ...(value.includes('seed') ? ['seed' as EventTiebreaker] : [])])}
                            className="px-1.5 py-0.5 rounded border border-white/10 text-[11px] text-muted-foreground hover:text-white hover:border-white/20 cursor-pointer disabled:opacity-40"
                        >
                            + {TIEBREAKER_LABELS[name] ?? name}
                        </button>
                    ))}
                </div>
            )}
            <p className="text-[11px] text-muted-foreground/70">
                Overall deaths only applies when every tied team has deaths recorded; seeding always settles what nothing else can.
            </p>
        </SubCard>
    )
}

function PointsTable({ table, defaults, onChange, base, errors, disabled }: {
    table: EventPointsRow[]
    defaults: EventMatchDefaults
    onChange: (table: EventPointsRow[]) => void
    base: string
    errors?: Record<string, string>
    disabled?: boolean
}) {
    const rows = syncPointsTable(table, defaults)

    return (
        <SubCard title="Points per result">
            <div className="space-y-1.5">
                {rows.map((row, index) => {
                    const drawn = row.maps_won === row.maps_lost

                    return (
                        <div key={`${row.maps_won}-${row.maps_lost}`} className="flex items-center gap-3">
                            <span className={cn(
                                'w-20 shrink-0 text-xs tabular-nums',
                                drawn ? 'text-amber-300' : row.maps_won > row.maps_lost ? 'text-foreground' : 'text-muted-foreground',
                            )}>
                                {row.maps_won}–{row.maps_lost}
                            </span>
                            <span className="w-12 shrink-0 text-[11px] uppercase tracking-wider text-muted-foreground/70">
                                {drawn ? 'draw' : row.maps_won > row.maps_lost ? 'win' : 'loss'}
                            </span>
                            <input
                                type="number"
                                min={0}
                                value={row.points}
                                disabled={disabled}
                                onChange={event => onChange(rows.map((entry, at) => (
                                    at === index ? { ...entry, points: Number(event.target.value) } : entry
                                )))}
                                className={cn(
                                    teamInputClass, 'h-8 w-20 py-1 text-xs tabular-nums disabled:opacity-50',
                                    errors?.[`${base}[${index}].points`] && 'border-red-500/50',
                                )}
                            />
                            <span className="text-[11px] text-muted-foreground">
                                {row.points === 1 ? 'point' : 'points'}
                                {drawn && ' — to both teams'}
                            </span>
                        </div>
                    )
                })}
            </div>

            {errors?.[base] && <p className="text-[11px] text-red-300">{errors[base]}</p>}

            <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                <p className="text-[11px] text-muted-foreground/70 min-w-0">
                    {'A map the time limit ended is played but won by nobody, so a series can '
                        + 'finish on any of these. A level one pays both teams the same.'}
                </p>
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(defaultPointsTable(defaults))}
                    className="ml-auto shrink-0 text-[11px] text-muted-foreground hover:text-white cursor-pointer disabled:opacity-40"
                >
                    Reset
                </button>
            </div>
        </SubCard>
    )
}

function GroupsEditor({ config, onChange, base, defaults, errors, disabled }: {
    config: EventGroupsConfig
    onChange: (config: EventGroupsConfig) => void
    base: string
    defaults: EventMatchDefaults
    errors?: Record<string, string>
    disabled?: boolean
}) {
    const set = <K extends keyof EventGroupsConfig>(key: K, value: EventGroupsConfig[K]) =>
        onChange({ ...config, [key]: value })

    return (
        <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
                <NumberField label="Groups" value={config.group_count} min={1} onChange={value => set('group_count', value)}
                    path={`${base}.group_count`} errors={errors} disabled={disabled} />
                <NumberField label="Teams per group" value={config.group_size} min={2} onChange={value => set('group_size', value)}
                    path={`${base}.group_size`} errors={errors} disabled={disabled} />
                <SelectField
                    label="Seeding"
                    value={config.seeding}
                    onChange={value => set('seeding', value)}
                    options={[
                        { value: 'tiered', label: 'Tiered (one per tier)' },
                        { value: 'snake', label: 'Snake' },
                        { value: 'random', label: 'Random' },
                        { value: 'manual', label: 'Manual' },
                    ]}
                    path={`${base}.seeding`}
                    errors={errors}
                    disabled={disabled}
                />
            </div>

            <CheckField
                label="Double round robin"
                hint="Every pair meets twice instead of once."
                checked={config.double_round_robin}
                onChange={value => set('double_round_robin', value)}
                disabled={disabled}
            />

            <PointsTable
                table={config.points}
                defaults={defaults}
                onChange={value => set('points', value)}
                base={`${base}.points`}
                errors={errors}
                disabled={disabled}
            />

            <TiebreakerList
                value={config.tiebreakers}
                onChange={value => set('tiebreakers', value)}
                path={`${base}.tiebreakers`}
                errors={errors}
                disabled={disabled}
            />
        </div>
    )
}

function SwissEditor({ config, onChange, base, errors, disabled }: {
    config: EventSwissConfig
    onChange: (config: EventSwissConfig) => void
    base: string
    errors?: Record<string, string>
    disabled?: boolean
}) {
    const set = <K extends keyof EventSwissConfig>(key: K, value: EventSwissConfig[K]) =>
        onChange({ ...config, [key]: value })

    const setEntry = (index: number, patch: Partial<EventSwissConfig['entry_records'][number]>) =>
        set('entry_records', config.entry_records.map((entry, at) => (at === index ? { ...entry, ...patch } : entry)))

    return (
        <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
                <NumberField label="Wins to qualify" value={config.wins_to_qualify} min={1} onChange={value => set('wins_to_qualify', value)}
                    path={`${base}.wins_to_qualify`} errors={errors} disabled={disabled} />
                <NumberField label="Losses to eliminate" value={config.losses_to_eliminate} min={1} onChange={value => set('losses_to_eliminate', value)}
                    path={`${base}.losses_to_eliminate`} errors={errors} disabled={disabled} />
            </div>

            <RowList
                label="Entry records by group finish"
                addLabel="Add finish"
                disabled={disabled}
                onAdd={() => set('entry_records', [...config.entry_records, {
                    group_rank: (config.entry_records.at(-1)?.group_rank ?? 0) + 1,
                    wins: 0,
                    losses: 0,
                    entry_round: 1,
                }])}
            >
                {config.entry_records.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">Everyone enters at 0–0 in round 1.</p>
                ) : config.entry_records.map((entry, index) => (
                    <div key={index} className="grid gap-2 grid-cols-2 sm:grid-cols-5 items-end">
                        <NumberField label="Finished" value={entry.group_rank} min={1} onChange={value => setEntry(index, { group_rank: value })}
                            path={`${base}.entry_records[${index}].group_rank`} errors={errors} disabled={disabled} />
                        <NumberField label="Wins" value={entry.wins} min={0} onChange={value => setEntry(index, { wins: value })}
                            path={`${base}.entry_records[${index}].wins`} errors={errors} disabled={disabled} />
                        <NumberField label="Losses" value={entry.losses} min={0} onChange={value => setEntry(index, { losses: value })}
                            path={`${base}.entry_records[${index}].losses`} errors={errors} disabled={disabled} />
                        <NumberField label="First round" value={entry.entry_round} min={1} onChange={value => setEntry(index, { entry_round: value })}
                            path={`${base}.entry_records[${index}].entry_round`} errors={errors} disabled={disabled} />
                        <div className="flex justify-end pb-1">
                            <IconButton
                                icon={Trash2}
                                title="Remove"
                                tone="red"
                                disabled={disabled}
                                onClick={() => set('entry_records', config.entry_records.filter((_, at) => at !== index))}
                            />
                        </div>
                    </div>
                ))}
                <p className="text-[11px] text-muted-foreground/70">
                    A head start often means sitting out early rounds — set the first round a finish plays in.
                </p>
            </RowList>

            <SubCard title="Pairing">
                <SelectField
                    label="Method"
                    value={config.pairing.method}
                    onChange={value => set('pairing', { ...config.pairing, method: value })}
                    options={[
                        { value: 'fold', label: 'Fold (best vs worst)' },
                        { value: 'adjacent', label: 'Adjacent (best vs next)' },
                        { value: 'random', label: 'Random' },
                    ]}
                    path={`${base}.pairing.method`}
                    errors={errors}
                    disabled={disabled}
                />
                <div className="space-y-2">
                    <CheckField label="Avoid repeat matchups" checked={config.pairing.avoid_rematch}
                        onChange={value => set('pairing', { ...config.pairing, avoid_rematch: value })} disabled={disabled} />
                    <CheckField label="Avoid identical match histories" checked={config.pairing.avoid_same_history}
                        onChange={value => set('pairing', { ...config.pairing, avoid_same_history: value })} disabled={disabled} />
                    <CheckField label="Avoid teams from the same group" hint="Stops an instant replay of a group-stage match."
                        checked={config.pairing.avoid_same_group}
                        onChange={value => set('pairing', { ...config.pairing, avoid_same_group: value })} disabled={disabled} />
                </div>
            </SubCard>
        </div>
    )
}

function ElimEditor({ config, onChange, base, stageKeys, errors, disabled }: {
    config: EventElimConfig
    onChange: (config: EventElimConfig) => void
    base: string
    stageKeys: string[]
    errors?: Record<string, string>
    disabled?: boolean
}) {
    const set = <K extends keyof EventElimConfig>(key: K, value: EventElimConfig[K]) =>
        onChange({ ...config, [key]: value })

    const potOptions = config.pots.map(pot => ({ value: pot.key, label: pot.label || pot.key }))
    const stageOptions = stageKeys.map(key => ({ value: key, label: key }))

    const renamePot = (at: number, key: string) => {
        const previous = config.pots[at].key
        const pots = config.pots.map((entry, index) => (index === at ? { ...entry, key } : entry))

        if (previous === key) {
            onChange({ ...config, pots })
            return
        }

        onChange({
            ...config,
            pots,
            draw: {
                ...config.draw,
                byes: config.draw.byes.map(bye => (bye.pot === previous ? { ...bye, pot: key } : bye)),
                matchups: config.draw.matchups.map(matchup => ({
                    ...matchup,
                    a_pot: matchup.a_pot === previous ? key : matchup.a_pot,
                    b_pot: matchup.b_pot === previous ? key : matchup.b_pot,
                })),
            },
        })
    }

    return (
        <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
                <NumberField label="Teams" value={config.size} min={2} onChange={value => set('size', value)}
                    path={`${base}.size`} errors={errors} disabled={disabled} />
                <div className="space-y-2 pt-5">
                    <CheckField label="Third place match" checked={config.third_place_match}
                        onChange={value => set('third_place_match', value)} disabled={disabled} />
                    <CheckField label="Avoid repeat matchups" hint="Never redraw a pairing from an earlier stage."
                        checked={config.avoid_rematch} onChange={value => set('avoid_rematch', value)} disabled={disabled} />
                </div>
            </div>

            <RowList
                label="Qualification pots"
                addLabel="Add pot"
                disabled={disabled}
                onAdd={() => set('pots', [...config.pots, {
                    key: `pot${nextKeyNumber('pot', config.pots.map(entry => entry.key))}`,
                    label: null,
                    sources: [],
                }])}
            >
                {config.pots.map((pot, index) => {
                    const potBase = `${base}.pots[${index}]`
                    const setPot = (patch: Partial<typeof pot>) =>
                        set('pots', config.pots.map((entry, at) => (at === index ? { ...entry, ...patch } : entry)))

                    return (
                        <div key={index} className="rounded-md border border-white/5 bg-card/20 p-2.5 space-y-2">
                            <div className="grid gap-2 grid-cols-2 sm:grid-cols-[6rem_1fr_auto] items-end">
                                <TextField label="Key" value={pot.key} onChange={value => renamePot(index, value)}
                                    path={`${potBase}.key`} errors={errors} disabled={disabled} />
                                <TextField label="Label" value={pot.label ?? ''} onChange={value => setPot({ label: value || null })}
                                    placeholder="Group winners" path={`${potBase}.label`} errors={errors} disabled={disabled} />
                                <div className="flex justify-end pb-1">
                                    <IconButton icon={Trash2} title="Remove pot" tone="red" disabled={disabled}
                                        onClick={() => set('pots', config.pots.filter((_, at) => at !== index))} />
                                </div>
                            </div>

                            {pot.sources.map((source, sourceIndex) => {
                                const sourceBase = `${potBase}.sources[${sourceIndex}]`
                                const setSource = (patch: Partial<typeof source>) =>
                                    setPot({ sources: pot.sources.map((entry, at) => (at === sourceIndex ? { ...entry, ...patch } : entry)) })

                                return (
                                    <div key={sourceIndex} className="grid gap-2 grid-cols-2 sm:grid-cols-5 items-end pl-2 border-l border-white/5">
                                        <SelectField label="From stage" value={source.stage} onChange={value => setSource({ stage: value })}
                                            options={withCurrent(stageOptions, source.stage)} path={`${sourceBase}.stage`} errors={errors} disabled={disabled} />
                                        <NumberField label="Finished" value={source.rank} min={1} nullable
                                            onChange={value => setSource({ rank: value, qualified_round: null })}
                                            path={`${sourceBase}.rank`} errors={errors} disabled={disabled} />
                                        <NumberField label="Qualified in round" value={source.qualified_round} min={1} nullable
                                            onChange={value => setSource({ qualified_round: value, rank: null })}
                                            path={`${sourceBase}.qualified_round`} errors={errors} disabled={disabled} />
                                        <NumberField label="Take at most" value={source.limit} min={1} nullable
                                            hint="Empty means no limit."
                                            onChange={value => setSource({ limit: value })}
                                            path={`${sourceBase}.limit`} errors={errors} disabled={disabled} />
                                        <div className="flex justify-end pb-1">
                                            <IconButton icon={Trash2} title="Remove source" tone="red" disabled={disabled}
                                                onClick={() => setPot({ sources: pot.sources.filter((_, at) => at !== sourceIndex) })} />
                                        </div>
                                    </div>
                                )
                            })}

                            <button
                                type="button"
                                disabled={disabled || stageKeys.length === 0}
                                onClick={() => setPot({
                                    sources: [...pot.sources, { stage: stageKeys[0] ?? '', rank: 1, qualified_round: null, limit: null, order: 'best' }],
                                })}
                                className="inline-flex items-center gap-1 text-[11px] text-accent-300 hover:text-accent-200 cursor-pointer disabled:opacity-40"
                            >
                                <Plus className="size-3" /> Add source
                            </button>
                            {pot.sources.length === 0 && (
                                <p className="text-[11px] text-muted-foreground/70">No sources: this pot takes everyone no other pot claimed.</p>
                            )}
                        </div>
                    )
                })}
            </RowList>

            <RowList
                label="Byes"
                addLabel="Add bye"
                disabled={disabled || config.pots.length === 0}
                onAdd={() => set('draw', { ...config.draw, byes: [...config.draw.byes, { pot: config.pots[0]?.key ?? '', count: 1 }] })}
            >
                {config.draw.byes.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">Nobody skips the opening round.</p>
                ) : config.draw.byes.map((bye, index) => (
                    <div key={index} className="grid gap-2 grid-cols-2 sm:grid-cols-3 items-end">
                        <SelectField label="Pot" value={bye.pot} onChange={value => set('draw', {
                            ...config.draw,
                            byes: config.draw.byes.map((entry, at) => (at === index ? { ...entry, pot: value } : entry)),
                        })} options={withCurrent(potOptions, bye.pot)} path={`${base}.draw.byes[${index}].pot`} errors={errors} disabled={disabled} />
                        <NumberField label="Teams" value={bye.count} min={1} onChange={value => set('draw', {
                            ...config.draw,
                            byes: config.draw.byes.map((entry, at) => (at === index ? { ...entry, count: value } : entry)),
                        })} path={`${base}.draw.byes[${index}].count`} errors={errors} disabled={disabled} />
                        <div className="flex justify-end pb-1">
                            <IconButton icon={Trash2} title="Remove" tone="red" disabled={disabled}
                                onClick={() => set('draw', { ...config.draw, byes: config.draw.byes.filter((_, at) => at !== index) })} />
                        </div>
                    </div>
                ))}
            </RowList>

            <RowList
                label="Fixed opening matchups"
                addLabel="Add matchup"
                disabled={disabled || config.pots.length === 0}
                onAdd={() => set('draw', {
                    ...config.draw,
                    matchups: [...config.draw.matchups, { a_pot: config.pots[0]?.key ?? '', b_pot: config.pots.at(-1)?.key ?? '', count: 1 }],
                })}
            >
                {config.draw.matchups.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">Every opening match is drawn from the remainder.</p>
                ) : config.draw.matchups.map((matchup, index) => {
                    const setMatchup = (patch: Partial<typeof matchup>) => set('draw', {
                        ...config.draw,
                        matchups: config.draw.matchups.map((entry, at) => (at === index ? { ...entry, ...patch } : entry)),
                    })

                    return (
                        <div key={index} className="grid gap-2 grid-cols-2 sm:grid-cols-4 items-end">
                            <SelectField label="Pot" value={matchup.a_pot} onChange={value => setMatchup({ a_pot: value })}
                                options={withCurrent(potOptions, matchup.a_pot)} path={`${base}.draw.matchups[${index}].a_pot`} errors={errors} disabled={disabled} />
                            <SelectField label="Versus pot" value={matchup.b_pot} onChange={value => setMatchup({ b_pot: value })}
                                options={withCurrent(potOptions, matchup.b_pot)} path={`${base}.draw.matchups[${index}].b_pot`} errors={errors} disabled={disabled} />
                            <NumberField label="Matches" value={matchup.count} min={1} onChange={value => setMatchup({ count: value })}
                                path={`${base}.draw.matchups[${index}].count`} errors={errors} disabled={disabled} />
                            <div className="flex justify-end pb-1">
                                <IconButton icon={Trash2} title="Remove" tone="red" disabled={disabled}
                                    onClick={() => set('draw', { ...config.draw, matchups: config.draw.matchups.filter((_, at) => at !== index) })} />
                            </div>
                        </div>
                    )
                })}
            </RowList>

            <SelectField
                label="Remaining teams"
                value={config.draw.remainder}
                onChange={value => set('draw', { ...config.draw, remainder: value })}
                options={[
                    { value: 'random_pairs', label: 'Paired at random' },
                    { value: 'fold_pairs', label: 'Paired by seed (best vs worst)' },
                ]}
                path={`${base}.draw.remainder`}
                errors={errors}
                disabled={disabled}
            />
        </div>
    )
}

function AdvancementEditor({ stage, index, spec, onChange, errors, disabled }: {
    stage: EventStageSpec
    index: number
    spec: EventFormatSpec
    onChange: (stage: EventStageSpec) => void
    errors?: Record<string, string>
    disabled?: boolean
}) {
    const base = `stages[${index}].advancement`
    const later = spec.stages.slice(index + 1).map(entry => ({ value: entry.key, label: entry.name || entry.key }))

    if (later.length === 0) {
        return (
            <div className="space-y-1.5">
                <p className="text-[11px] text-muted-foreground">This is the final event stage. This will determine the event winner.</p>
                {stage.advancement.length > 0 && (
                    <p className="text-[11px] text-amber-300">
                        It still sends teams to{' '}
                        {stage.advancement.map(rule => rule.to_stage).join(', ')} —{' '}
                        <button
                            type="button"
                            disabled={disabled}
                            onClick={() => onChange({ ...stage, advancement: [] })}
                            className="underline cursor-pointer disabled:opacity-40"
                        >
                            drop those rules
                        </button>.
                    </p>
                )}
            </div>
        )
    }

    const setRule = (at: number, patch: Partial<EventStageSpec['advancement'][number]>) =>
        onChange({ ...stage, advancement: stage.advancement.map((rule, i) => (i === at ? { ...rule, ...patch } : rule)) })

    return (
        <RowList
            label="Who advances"
            addLabel="Add rule"
            disabled={disabled}
            onAdd={() => onChange({
                ...stage,
                advancement: [...stage.advancement, stage.kind === 'groups'
                    ? { from_rank: 1, to_rank: 1, to_stage: later[0].value, label: null }
                    : { outcome: 'qualified', to_stage: later[0].value, label: null }],
            })}
        >
            {stage.advancement.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">Nobody advances from this stage yet.</p>
            ) : stage.advancement.map((rule, at) => (
                <div key={at} className="grid gap-2 grid-cols-2 sm:grid-cols-5 items-end">
                    {stage.kind === 'groups' ? (
                        <>
                            <NumberField label="From place" value={rule.from_rank ?? 1} min={1} onChange={value => setRule(at, { from_rank: value })}
                                path={`${base}[${at}].from_rank`} errors={errors} disabled={disabled} />
                            <NumberField label="To place" value={rule.to_rank ?? rule.from_rank ?? 1} min={1} onChange={value => setRule(at, { to_rank: value })}
                                path={`${base}[${at}].to_rank`} errors={errors} disabled={disabled} />
                        </>
                    ) : (
                        <div className="sm:col-span-2 text-xs text-muted-foreground pb-2">Every qualifier</div>
                    )}
                    <SelectField label="Goes to" value={rule.to_stage} onChange={value => setRule(at, { to_stage: value })}
                        options={withCurrent(later, rule.to_stage)} path={`${base}[${at}].to_stage`} errors={errors} disabled={disabled} />
                    <TextField label="Shown as" value={rule.label ?? ''} onChange={value => setRule(at, { label: value || null })}
                        placeholder="Playoff Stage" path={`${base}[${at}].label`} errors={errors} disabled={disabled} />
                    <div className="flex justify-end pb-1">
                        <IconButton icon={Trash2} title="Remove" tone="red" disabled={disabled}
                            onClick={() => onChange({ ...stage, advancement: stage.advancement.filter((_, i) => i !== at) })} />
                    </div>
                </div>
            ))}
        </RowList>
    )
}

function StageCard({ stage, index, spec, onChange, onMove, onRemove, errors, disabled }: {
    stage: EventStageSpec
    index: number
    spec: EventFormatSpec
    onChange: (stage: EventStageSpec) => void
    onMove: (delta: number) => void
    onRemove: () => void
    errors?: Record<string, string>
    disabled?: boolean
}) {
    const base = `stages[${index}]`
    const earlierKeys = spec.stages.slice(0, index).map(entry => entry.key)
    const defaults = effectiveDefaults(spec, stage)
    const knockout = stage.kind === 'swiss' || stage.kind === 'single_elim'
    const tone = STAGE_KIND_STYLES[stage.kind] ?? STAGE_KIND_STYLES.groups
    const [open, setOpen] = useState(spec.stages.length === 1)
    const problems = Object.keys(errors ?? {}).filter(path => path.startsWith(`${base}.`)).length

    const changeKind = (kind: EventStageKind) =>
        onChange({ ...stage, kind, config: defaultConfigFor(kind), advancement: [] })

    return (
        <section className="relative overflow-hidden rounded-xl border border-white/10 bg-card/40 p-3.5 pl-4 space-y-3">
            <span className={cn('absolute left-0 inset-y-0 w-1', tone.stripe)} />

            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => setOpen(value => !value)}
                    aria-expanded={open}
                    className="min-w-0 flex-1 basis-56 flex items-center gap-2 cursor-pointer rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60"
                >
                    <ChevronRight className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
                    <span className={cn(
                        'shrink-0 size-5 rounded-md border inline-flex items-center justify-center text-[10px] font-bold tabular-nums',
                        tone.badge,
                    )}>
                        {index + 1}
                    </span>
                    <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                        {stage.name || `Stage ${index + 1}`}
                    </span>
                    <span className={cn(
                        'shrink-0 whitespace-nowrap text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border',
                        tone.chip,
                    )}>
                        {STAGE_KIND_LABELS[stage.kind] ?? stage.kind}
                    </span>
                    {problems > 0 && (
                        <span className="shrink-0 text-[10px] font-medium text-red-300">
                            {problems} problem{problems === 1 ? '' : 's'}
                        </span>
                    )}
                </button>
                <div className="ml-auto flex items-center shrink-0">
                    <IconButton icon={ArrowUp} title="Move up" onClick={() => onMove(-1)} disabled={disabled || index === 0} />
                    <IconButton icon={ArrowDown} title="Move down" onClick={() => onMove(1)} disabled={disabled || index === spec.stages.length - 1} />
                    <IconButton icon={Trash2} title="Remove stage" tone="red" onClick={onRemove} disabled={disabled || spec.stages.length === 1} />
                </div>
            </div>

            {!open ? null : (
            <>
            <div className="grid gap-3 sm:grid-cols-3">
                <TextField label="Name" value={stage.name} onChange={value => onChange({ ...stage, name: value })}
                    placeholder="Group Stage" path={`${base}.name`} errors={errors} disabled={disabled} />
                <TextField label="Key" value={stage.key} onChange={value => onChange({ ...stage, key: value })}
                    placeholder="groups" hint="Used by later stages to refer to this one."
                    path={`${base}.key`} errors={errors} disabled={disabled} />
                <SelectField label="Kind" value={stage.kind} onChange={changeKind} options={STAGE_KIND_OPTIONS}
                    path={`${base}.kind`} errors={errors} disabled={disabled} />
            </div>

            <SubCard title="Match format">
                <CheckField
                    label="This stage plays a different match format"
                    hint={knockout
                        ? 'A knockout stage always needs a winner, so it cannot play an even number of maps.'
                        : 'Otherwise it uses the format-wide setting above.'}
                    checked={!!stage.match_defaults}
                    disabled={disabled}
                    onChange={value => onChange({
                        ...stage,
                        match_defaults: value ? { ...defaults } : null,
                    })}
                />

                {stage.match_defaults && (
                    <MatchFormatEditor
                        defaults={stage.match_defaults}
                        onChange={match_defaults => onChange({ ...stage, match_defaults })}
                        base={`${base}.match_defaults`}
                        errors={errors}
                        disabled={disabled}
                        needsAWinner={stage.kind !== 'groups'}
                    />
                )}
            </SubCard>

            {stage.kind === 'groups' && (
                <GroupsEditor config={stage.config as EventGroupsConfig} base={`${base}.config`} defaults={defaults}
                    errors={errors} disabled={disabled}
                    onChange={config => onChange({ ...stage, config })} />
            )}
            {stage.kind === 'swiss' && (
                <SwissEditor config={stage.config as EventSwissConfig} base={`${base}.config`} errors={errors} disabled={disabled}
                    onChange={config => onChange({ ...stage, config })} />
            )}
            {stage.kind === 'single_elim' && (
                <ElimEditor config={stage.config as EventElimConfig} base={`${base}.config`} stageKeys={earlierKeys}
                    errors={errors} disabled={disabled} onChange={config => onChange({ ...stage, config })} />
            )}

            <AdvancementEditor stage={stage} index={index} spec={spec} onChange={onChange} errors={errors} disabled={disabled} />
            </>
            )}
        </section>
    )
}

export function FormatBuilder({ spec, onChange, errors, disabled }: BuilderProps) {
    const update = (next: EventFormatSpec) => onChange(withSyncedPoints(next))

    const move = (index: number, delta: number) => {
        const target = index + delta
        if (target < 0 || target >= spec.stages.length) return
        const stages = [...spec.stages]
        ;[stages[index], stages[target]] = [stages[target], stages[index]]
        update({ ...spec, stages })
    }

    return (
        <div className="space-y-4">
            <SubCard title="Match format">
                <MatchFormatEditor
                    defaults={spec.match_defaults}
                    onChange={match_defaults => update({ ...spec, match_defaults })}
                    base="match_defaults"
                    errors={errors}
                    disabled={disabled}
                    needsAWinner={spec.stages.some(stage => stage.kind !== 'groups' && !stage.match_defaults)}
                />
                <p className="text-[11px] text-muted-foreground/70">
                    Applies to every stage that does not set its own.
                </p>
            </SubCard>

            {errors?.stages && <p className="text-[11px] text-red-300">{errors.stages}</p>}

            {spec.stages.map((stage, index) => (
                <div key={index} className="space-y-4">
                    {index > 0 && (
                        <div className="flex justify-center" aria-hidden="true">
                            <ChevronDown className="size-4 text-muted-foreground/40" />
                        </div>
                    )}
                    <StageCard
                        stage={stage}
                        index={index}
                        spec={spec}
                        errors={errors}
                        disabled={disabled}
                        onChange={next => update(replaceStage(spec, index, next))}
                        onMove={delta => move(index, delta)}
                        onRemove={() => update({ ...spec, stages: spec.stages.filter((_, at) => at !== index) })}
                    />
                </div>
            ))}

            <button
                type="button"
                disabled={disabled}
                onClick={() => {
                    const number = nextKeyNumber('stage', spec.stages.map(entry => entry.key))
                    update({ ...spec, stages: [...spec.stages, newStage(`stage${number}`, `Stage ${number}`, 'single_elim')] })
                }}
                className="w-full py-2 rounded-lg border border-dashed border-white/15 text-xs text-muted-foreground hover:text-white hover:border-white/25 transition-colors cursor-pointer disabled:opacity-40"
            >
                <Plus className="inline size-3.5 mr-1" /> Add stage
            </button>
        </div>
    )
}
