import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EVENT_TIEBREAKERS } from '@/app/utils/api'
import type {
    EventElimConfig, EventFormatSpec, EventGroupsConfig, EventStageKind, EventStageSpec,
    EventSwissConfig, EventTiebreaker,
} from '@/app/utils/api'
import {
    CheckField, NumberField, SelectField, STAGE_KIND_OPTIONS, SubCard, TextField,
    TIEBREAKER_LABELS, defaultConfigFor, newStage,
} from './formatFields'

interface BuilderProps {
    spec: EventFormatSpec
    onChange: (spec: EventFormatSpec) => void
    errors?: Record<string, string>
    disabled?: boolean
}

function replaceStage(spec: EventFormatSpec, index: number, stage: EventStageSpec): EventFormatSpec {
    return { ...spec, stages: spec.stages.map((entry, at) => (at === index ? stage : entry)) }
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

// ------------------------------------------------------------------ groups

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

function GroupsEditor({ config, onChange, base, errors, disabled }: {
    config: EventGroupsConfig
    onChange: (config: EventGroupsConfig) => void
    base: string
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

            <SubCard title="Points per result">
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
                    <NumberField label="2–0 win" value={config.points.win_2_0} min={0} onChange={value => set('points', { ...config.points, win_2_0: value })}
                        path={`${base}.points.win_2_0`} errors={errors} disabled={disabled} />
                    <NumberField label="2–1 win" value={config.points.win_2_1} min={0} onChange={value => set('points', { ...config.points, win_2_1: value })}
                        path={`${base}.points.win_2_1`} errors={errors} disabled={disabled} />
                    <NumberField label="1–2 loss" value={config.points.loss_1_2} min={0} onChange={value => set('points', { ...config.points, loss_1_2: value })}
                        path={`${base}.points.loss_1_2`} errors={errors} disabled={disabled} />
                    <NumberField label="0–2 loss" value={config.points.loss_0_2} min={0} onChange={value => set('points', { ...config.points, loss_0_2: value })}
                        path={`${base}.points.loss_0_2`} errors={errors} disabled={disabled} />
                </div>
                <p className="text-[11px] text-muted-foreground/70">
                    In longer series a win with no maps dropped pays the 2–0 rate, any other win the 2–1 rate.
                </p>
            </SubCard>

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

// ------------------------------------------------------------------ swiss

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

// ------------------------------------------------------------------ single elim

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
                onAdd={() => set('pots', [...config.pots, { key: `pot${config.pots.length + 1}`, label: null, sources: [] }])}
            >
                {config.pots.map((pot, index) => {
                    const potBase = `${base}.pots[${index}]`
                    const setPot = (patch: Partial<typeof pot>) =>
                        set('pots', config.pots.map((entry, at) => (at === index ? { ...entry, ...patch } : entry)))

                    return (
                        <div key={index} className="rounded-md border border-white/5 bg-card/20 p-2.5 space-y-2">
                            <div className="grid gap-2 grid-cols-2 sm:grid-cols-[6rem_1fr_auto] items-end">
                                <TextField label="Key" value={pot.key} onChange={value => setPot({ key: value })}
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
                                            options={stageOptions} path={`${sourceBase}.stage`} errors={errors} disabled={disabled} />
                                        <NumberField label="Finished" value={source.rank} min={1} onChange={value => setSource({ rank: value, qualified_round: null })}
                                            path={`${sourceBase}.rank`} errors={errors} disabled={disabled} />
                                        <NumberField label="Qualified in round" value={source.qualified_round} min={1}
                                            onChange={value => setSource({ qualified_round: value, rank: null })}
                                            path={`${sourceBase}.qualified_round`} errors={errors} disabled={disabled} />
                                        <NumberField label="Take at most" value={source.limit} min={1} onChange={value => setSource({ limit: value })}
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
                        })} options={potOptions} path={`${base}.draw.byes[${index}].pot`} errors={errors} disabled={disabled} />
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
                                options={potOptions} path={`${base}.draw.matchups[${index}].a_pot`} errors={errors} disabled={disabled} />
                            <SelectField label="Versus pot" value={matchup.b_pot} onChange={value => setMatchup({ b_pot: value })}
                                options={potOptions} path={`${base}.draw.matchups[${index}].b_pot`} errors={errors} disabled={disabled} />
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

// ------------------------------------------------------------------ stage

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
        return <p className="text-[11px] text-muted-foreground">This is the final stage — its winner takes the event.</p>
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
                        options={later} path={`${base}[${at}].to_stage`} errors={errors} disabled={disabled} />
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

    const changeKind = (kind: EventStageKind) =>
        onChange({ ...stage, kind, config: defaultConfigFor(kind), advancement: [] })

    return (
        <section className="rounded-xl border border-white/10 bg-card/40 p-3.5 space-y-3">
            <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Stage {index + 1}</span>
                <div className="ml-auto flex items-center">
                    <IconButton icon={ArrowUp} title="Move up" onClick={() => onMove(-1)} disabled={disabled || index === 0} />
                    <IconButton icon={ArrowDown} title="Move down" onClick={() => onMove(1)} disabled={disabled || index === spec.stages.length - 1} />
                    <IconButton icon={Trash2} title="Remove stage" tone="red" onClick={onRemove} disabled={disabled || spec.stages.length === 1} />
                </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
                <TextField label="Name" value={stage.name} onChange={value => onChange({ ...stage, name: value })}
                    placeholder="Group Stage" path={`${base}.name`} errors={errors} disabled={disabled} />
                <TextField label="Key" value={stage.key} onChange={value => onChange({ ...stage, key: value })}
                    placeholder="groups" hint="Used by later stages to refer to this one."
                    path={`${base}.key`} errors={errors} disabled={disabled} />
                <SelectField label="Kind" value={stage.kind} onChange={changeKind} options={STAGE_KIND_OPTIONS}
                    path={`${base}.kind`} errors={errors} disabled={disabled} />
            </div>

            {stage.kind === 'groups' && (
                <GroupsEditor config={stage.config as EventGroupsConfig} base={`${base}.config`} errors={errors} disabled={disabled}
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
        </section>
    )
}

export function FormatBuilder({ spec, onChange, errors, disabled }: BuilderProps) {
    const defaults = spec.match_defaults
    const setDefaults = (patch: Partial<typeof defaults>) =>
        onChange({ ...spec, match_defaults: { ...defaults, ...patch } })

    const move = (index: number, delta: number) => {
        const target = index + delta
        if (target < 0 || target >= spec.stages.length) return
        const stages = [...spec.stages]
        ;[stages[index], stages[target]] = [stages[target], stages[index]]
        onChange({ ...spec, stages })
    }

    return (
        <div className="space-y-4">
            <SubCard title="Match format">
                <div className="grid gap-3 sm:grid-cols-2">
                    <SelectField
                        label="Maps per match"
                        value={String(defaults.best_of)}
                        onChange={value => setDefaults({ best_of: Number(value) })}
                        options={[1, 3, 5, 7].map(n => ({ value: String(n), label: `Best of ${n}` }))}
                        path="match_defaults.best_of"
                        errors={errors}
                        disabled={disabled}
                    />
                    <NumberField label="Caps to win a map" value={defaults.caps_to_win_map} min={1}
                        onChange={value => setDefaults({ caps_to_win_map: value })}
                        path="match_defaults.caps_to_win_map" errors={errors} disabled={disabled} />
                </div>

                <CheckField
                    label="Decider on the last map"
                    hint="A tied series ends on a separate round-based decider."
                    checked={!!defaults.decider}
                    disabled={disabled}
                    onChange={value => setDefaults({ decider: value ? { kind: 'time_attack', rounds_to_win: 5, max_rounds: 9 } : null })}
                />

                {defaults.decider && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <NumberField label="Rounds to win" value={defaults.decider.rounds_to_win} min={1}
                            onChange={value => setDefaults({ decider: { ...defaults.decider!, rounds_to_win: value } })}
                            path="match_defaults.decider.rounds_to_win" errors={errors} disabled={disabled} />
                        <NumberField label="Maximum rounds" value={defaults.decider.max_rounds} min={1}
                            onChange={value => setDefaults({ decider: { ...defaults.decider!, max_rounds: value } })}
                            path="match_defaults.decider.max_rounds" errors={errors} disabled={disabled} />
                    </div>
                )}
            </SubCard>

            {errors?.stages && <p className="text-[11px] text-red-300">{errors.stages}</p>}

            {spec.stages.map((stage, index) => (
                <StageCard
                    key={index}
                    stage={stage}
                    index={index}
                    spec={spec}
                    errors={errors}
                    disabled={disabled}
                    onChange={next => onChange(replaceStage(spec, index, next))}
                    onMove={delta => move(index, delta)}
                    onRemove={() => onChange({ ...spec, stages: spec.stages.filter((_, at) => at !== index) })}
                />
            ))}

            <button
                type="button"
                disabled={disabled}
                onClick={() => onChange({ ...spec, stages: [...spec.stages, newStage(`stage${spec.stages.length + 1}`, `Stage ${spec.stages.length + 1}`, 'single_elim')] })}
                className="w-full py-2 rounded-lg border border-dashed border-white/15 text-xs text-muted-foreground hover:text-white hover:border-white/25 transition-colors cursor-pointer disabled:opacity-40"
            >
                <Plus className="inline size-3.5 mr-1" /> Add stage
            </button>
        </div>
    )
}
