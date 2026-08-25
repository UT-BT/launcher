import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import type { EventBracketEntrant, EventBracketStage, EventSwissConfig } from '@/app/utils/api'
import { Chip, ENTRANT_STATUS_STYLES, MatchCard, stageRounds } from './bracketShared'
import { TeamName } from '../TeamRoster'

interface Column {
    key: string
    label: string
    hint: string | null
    entrants: EventBracketEntrant[]
    tone: string
}

function buildColumns(stage: EventBracketStage, config: EventSwissConfig | null): Column[] {
    const qualifiedAt = config?.wins_to_qualify ?? 2
    const eliminatedAt = config?.losses_to_eliminate ?? 2

    const live = new Map<string, EventBracketEntrant[]>()
    const qualified: EventBracketEntrant[] = []
    const eliminated: EventBracketEntrant[] = []

    for (const entrant of stage.entrants) {
        if (entrant.status === 'qualified') qualified.push(entrant)
        else if (entrant.status === 'eliminated') eliminated.push(entrant)
        else {
            const key = `${entrant.wins}-${entrant.losses}`
            live.set(key, [...(live.get(key) ?? []), entrant])
        }
    }

    const ordered = [...live.keys()].sort((a, b) => {
        const [aw, al] = a.split('-').map(Number)
        const [bw, bl] = b.split('-').map(Number)
        return bw - aw || al - bl
    })

    const columns: Column[] = ordered.map(key => ({
        key,
        label: `${key} bracket`,
        hint: null,
        entrants: live.get(key) ?? [],
        tone: 'border-white/10',
    }))

    if (qualified.length) {
        columns.unshift({
            key: 'qualified',
            label: 'Qualified',
            hint: `${qualifiedAt} win${qualifiedAt === 1 ? '' : 's'}`,
            entrants: qualified.sort((a, b) => (a.qualified_round ?? 0) - (b.qualified_round ?? 0)),
            tone: 'border-emerald-500/30',
        })
    }

    if (eliminated.length) {
        columns.push({
            key: 'eliminated',
            label: 'Eliminated',
            hint: `${eliminatedAt} loss${eliminatedAt === 1 ? '' : 'es'}`,
            entrants: eliminated,
            tone: 'border-red-500/20',
        })
    }

    return columns
}

function EntrantRow({ entrant, showRound }: { entrant: EventBracketEntrant; showRound: boolean }) {
    return (
        <div className="flex items-center gap-2 py-1 min-w-0">
            <TeamName teamId={entrant.team_id} className="truncate text-sm text-foreground">
                {entrant.team?.name ?? '—'}
            </TeamName>
            {entrant.source_rank != null && (
                <span className="shrink-0 text-[10px] text-muted-foreground/70">from {ordinal(entrant.source_rank)}</span>
            )}
            {showRound && entrant.qualified_round != null && (
                <span className="ml-auto shrink-0 text-[10px] text-emerald-300/80">R{entrant.qualified_round}</span>
            )}
        </div>
    )
}

function ordinal(value: number): string {
    const suffix = value % 100 >= 11 && value % 100 <= 13 ? 'th'
        : value % 10 === 1 ? 'st'
            : value % 10 === 2 ? 'nd'
                : value % 10 === 3 ? 'rd' : 'th'
    return `${value}${suffix}`
}

export function SwissStageView({ stage, onMapSelect }: {
    stage: EventBracketStage
    onMapSelect?: (mapName: string) => void
}) {
    const config = stage.config as EventSwissConfig | null
    const columns = useMemo(() => buildColumns(stage, config), [stage, config])
    const rounds = useMemo(() => stageRounds(stage), [stage])

    if (stage.entrants.length === 0) {
        return <p className="text-sm text-muted-foreground">This stage has not been drawn yet.</p>
    }

    return (
        <div className="space-y-6">
            {config && (
                <p className="text-[11px] text-muted-foreground">
                    {`${config.wins_to_qualify} wins qualify · ${config.losses_to_eliminate} losses eliminate`}
                    {config.entry_records.length > 0 && ' · teams enter on the record their group finish earned them'}
                </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {columns.map(column => (
                    <div key={column.key} className={cn('rounded-lg border bg-card/30 p-3 space-y-1', column.tone)}>
                        <div className="flex items-baseline justify-between gap-2">
                            <h3 className="text-sm font-semibold text-foreground">{column.label}</h3>
                            <span className="text-[10px] text-muted-foreground">
                                {column.hint ?? `${column.entrants.length} team${column.entrants.length === 1 ? '' : 's'}`}
                            </span>
                        </div>
                        <div className="divide-y divide-white/5">
                            {column.entrants.map(entrant => (
                                <EntrantRow key={entrant.team_id} entrant={entrant} showRound={column.key === 'qualified'} />
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            {rounds.map(round => {
                const inRound = stage.matches
                    .filter(match => match.round_no === round)
                    .sort((a, b) => a.ordinal - b.ordinal)
                if (inRound.length === 0) return null

                const labels = [...new Set(inRound.map(match => match.round_label).filter(Boolean))]

                return (
                    <section key={round} className="space-y-2">
                        <div className="flex flex-wrap items-baseline gap-2">
                            <h3 className="text-sm font-semibold text-foreground">Round {round}</h3>
                            {labels.map(label => (
                                <Chip key={label} className={ENTRANT_STATUS_STYLES.active}>{label}</Chip>
                            ))}
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {inRound.map(match => (
                                <MatchCard key={match.id} match={match} onMapSelect={onMapSelect} />
                            ))}
                        </div>
                    </section>
                )
            })}
        </div>
    )
}
