import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { AdminSelect } from '@/app/components/pages/admin/components/controls'
import { teamInputClass } from '@/app/components/pages/teams/teamsShared'
import type {
    EventElimConfig, EventFormatSpec, EventGroupsConfig, EventMatchDefaults, EventPointsRow,
    EventStageKind, EventStageSpec, EventSwissConfig,
} from '@/app/utils/api'

const FIELD_PATH = /^[a-z_]+(\[\d+\])?(\.[a-z_]+(\[\d+\])?)*$/

export function parseSpecErrors(message: string): Record<string, string> {
    const errors: Record<string, string> = {}

    for (const entry of message.split(';')) {
        const at = entry.indexOf(':')
        if (at < 0) continue

        const path = entry.slice(0, at).trim()
        const reason = entry.slice(at + 1).trim()
        if (path && reason && FIELD_PATH.test(path) && !errors[path]) errors[path] = reason
    }

    return errors
}

export interface FieldProps {
    label: string
    path?: string
    errors?: Record<string, string>
    hint?: string
    className?: string
}

export function Field({ label, path, errors, hint, className, children }: FieldProps & { children: ReactNode }) {
    const error = path ? errors?.[path] : undefined

    return (
        <div className={cn('space-y-1 min-w-0', className)}>
            <label className="block text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</label>
            {children}
            {error
                ? <p className="text-[11px] text-red-300">{error}</p>
                : hint ? <p className="text-[11px] text-muted-foreground/70">{hint}</p> : null}
        </div>
    )
}

export function TextField({ value, onChange, placeholder, disabled, ...field }: FieldProps & {
    value: string
    onChange: (value: string) => void
    placeholder?: string
    disabled?: boolean
}) {
    const invalid = field.path ? !!field.errors?.[field.path] : false

    return (
        <Field {...field}>
            <input
                value={value}
                disabled={disabled}
                onChange={event => onChange(event.target.value)}
                placeholder={placeholder}
                className={cn(teamInputClass, 'w-full h-8 py-1 text-xs disabled:opacity-50', invalid && 'border-red-500/50')}
            />
        </Field>
    )
}

type NumberFieldProps = FieldProps & {
    value: number | null
    min?: number
    max?: number
    disabled?: boolean
} & (
    | { nullable: true; onChange: (value: number | null) => void }
    | { nullable?: false; onChange: (value: number) => void }
)

export function NumberField(props: NumberFieldProps) {
    const { value, min, max, disabled } = props
    const field: FieldProps = {
        label: props.label,
        path: props.path,
        errors: props.errors,
        hint: props.hint,
        className: props.className,
    }
    const invalid = field.path ? !!field.errors?.[field.path] : false
    const [text, setText] = useState(value == null ? '' : String(value))

    useEffect(() => { setText(value == null ? '' : String(value)) }, [value])

    return (
        <Field {...field}>
            <input
                type="number"
                value={text}
                min={min}
                max={max}
                disabled={disabled}
                onChange={event => {
                    const next = event.target.value
                    setText(next)
                    if (next === '') {
                        if (props.nullable) props.onChange(null)
                        return
                    }
                    const parsed = Number(next)
                    if (!Number.isNaN(parsed)) props.onChange(parsed)
                }}
                onBlur={() => setText(value == null ? '' : String(value))}
                className={cn(teamInputClass, 'w-full h-8 py-1 text-xs tabular-nums disabled:opacity-50', invalid && 'border-red-500/50')}
            />
        </Field>
    )
}

export function SelectField<T extends string>({ value, onChange, options, disabled, ...field }: FieldProps & {
    value: T
    onChange: (value: T) => void
    options: Array<{ value: T; label: string }>
    disabled?: boolean
}) {
    return (
        <Field {...field}>
            <AdminSelect
                value={value}
                onChange={next => { if (!disabled) onChange(next as T) }}
                options={options}
                ariaLabel={field.label}
                className="h-8 w-full text-xs"
            />
        </Field>
    )
}

export function CheckField({ checked, onChange, label, hint, disabled }: {
    checked: boolean
    onChange: (value: boolean) => void
    label: string
    hint?: string
    disabled?: boolean
}) {
    return (
        <label className={cn('flex items-start gap-2 cursor-pointer select-none', disabled && 'opacity-50 cursor-not-allowed')}>
            <input
                type="checkbox"
                checked={checked}
                disabled={disabled}
                onChange={event => onChange(event.target.checked)}
                style={{ colorScheme: 'dark' }}
                className="mt-0.5 size-3.5 accent-accent-500 cursor-pointer"
            />
            <span className="min-w-0">
                <span className="block text-xs text-foreground leading-tight">{label}</span>
                {hint && <span className="block text-[11px] text-muted-foreground/70 leading-tight">{hint}</span>}
            </span>
        </label>
    )
}

export function SubCard({ title, action, children, className }: {
    title: string
    action?: ReactNode
    children: ReactNode
    className?: string
}) {
    return (
        <div className={cn('rounded-lg border border-white/10 bg-card/30 p-3 space-y-2.5', className)}>
            <div className="flex items-center justify-between gap-2">
                <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{title}</h4>
                {action}
            </div>
            {children}
        </div>
    )
}

export const STAGE_KIND_OPTIONS: Array<{ value: EventStageKind; label: string }> = [
    { value: 'groups', label: 'Group stage' },
    { value: 'swiss', label: 'Swiss bracket' },
    { value: 'single_elim', label: 'Single elimination' },
]

export const TIEBREAKER_LABELS: Record<string, string> = {
    points: 'Total points',
    map_diff: 'Map differential',
    head_to_head: 'Direct confrontation',
    caps_for: 'Total caps made',
    caps_diff: 'Cap differential',
    maps_won: 'Total maps won',
    common_opponents: 'Common opponents',
    deaths: 'Overall deaths',
    seed: 'Tournament seeding',
}

export const DEFAULT_MATCH_DEFAULTS: EventMatchDefaults = {
    best_of: 3,
    caps_to_win_map: 4,
    mode: 'first_to',
    decider: null,
}

export function allowsDraws(defaults: EventMatchDefaults): boolean {
    return defaults.mode === 'all_maps' && defaults.best_of % 2 === 0
}

export function scorelinesFor(defaults: EventMatchDefaults): Array<[number, number]> {
    const length = Math.max(1, defaults.best_of)
    let lines: Array<[number, number]>

    if (defaults.mode === 'all_maps') {
        lines = Array.from({ length: length + 1 }, (_, index): [number, number] => [length - index, index])
    } else {
        const needed = Math.floor(length / 2) + 1
        lines = [
            ...Array.from({ length: needed }, (_, lost): [number, number] => [needed, lost]),
            ...Array.from({ length: needed }, (_, index): [number, number] => [needed - 1 - index, needed]),
        ]
    }

    return lines.sort((a, b) => (a[1] - a[0]) - (b[1] - b[0]) || b[0] - a[0])
}

export function defaultPointsTable(defaults: EventMatchDefaults): EventPointsRow[] {
    const lines = scorelinesFor(defaults)

    return lines.map(([maps_won, maps_lost], index) => ({
        maps_won,
        maps_lost,
        points: lines.length - 1 - index,
    }))
}

export function syncPointsTable(table: EventPointsRow[], defaults: EventMatchDefaults): EventPointsRow[] {
    const existing = new Map((table ?? []).map(row => [`${row.maps_won}-${row.maps_lost}`, row.points]))

    return defaultPointsTable(defaults).map(row => ({
        ...row,
        points: existing.get(`${row.maps_won}-${row.maps_lost}`) ?? row.points,
    }))
}

export function effectiveDefaults(spec: EventFormatSpec, stage: EventStageSpec): EventMatchDefaults {
    return stage.match_defaults ?? spec.match_defaults ?? DEFAULT_MATCH_DEFAULTS
}

export function withSyncedPoints(spec: EventFormatSpec): EventFormatSpec {
    return {
        ...spec,
        stages: spec.stages.map(stage => {
            if (stage.kind !== 'groups') return stage

            const config = stage.config as EventGroupsConfig

            return {
                ...stage,
                config: { ...config, points: syncPointsTable(config.points, effectiveDefaults(spec, stage)) },
            }
        }),
    }
}

export function defaultGroupsConfig(): EventGroupsConfig {
    return {
        group_count: 2,
        group_size: 4,
        seeding: 'tiered',
        double_round_robin: false,
        points: defaultPointsTable(DEFAULT_MATCH_DEFAULTS),
        tiebreakers: ['points', 'map_diff', 'head_to_head', 'caps_for', 'seed'],
    }
}

export function defaultSwissConfig(): EventSwissConfig {
    return {
        wins_to_qualify: 2,
        losses_to_eliminate: 2,
        entry_records: [],
        pairing: { method: 'fold', avoid_rematch: true, avoid_same_history: true, avoid_same_group: false },
    }
}

export function defaultElimConfig(): EventElimConfig {
    return {
        size: 8,
        third_place_match: false,
        avoid_rematch: true,
        seeding: 'pots',
        pots: [{ key: 'all', label: 'All qualifiers', sources: [] }],
        draw: { byes: [], matchups: [], remainder: 'fold_pairs' },
    }
}

export function defaultConfigFor(kind: EventStageKind) {
    if (kind === 'groups') return defaultGroupsConfig()
    if (kind === 'swiss') return defaultSwissConfig()
    return defaultElimConfig()
}

export function emptySpec(): EventFormatSpec {
    return {
        version: 1,
        match_defaults: { ...DEFAULT_MATCH_DEFAULTS },
        stages: [newStage('bracket', 'Bracket', 'single_elim')],
    }
}

export function newStage(key: string, name: string, kind: EventStageKind): EventStageSpec {
    return { key, name, kind, config: defaultConfigFor(kind), advancement: [], match_defaults: null }
}
