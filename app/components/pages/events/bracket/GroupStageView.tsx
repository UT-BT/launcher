import { useCallback, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
    DataTableCell, DataTableEmpty, DataTableHeaderCell, DataTableHeaderRow, DataTableRow, DataTableShell,
    type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import type {
    EventBracketGroup, EventBracketStage, EventGroupsConfig, EventStageSpec, EventStandingRow,
} from '@/app/utils/api'
import { MatchCard, stageRounds } from './bracketShared'
import { TeamName } from '../TeamRoster'

const COLUMNS: ResponsiveColumn[] = [
    { id: 'rank', width: '3rem', required: true },
    { id: 'team', width: '12rem', required: true },
    { id: 'points', width: '4rem', required: true },
    { id: 'record', width: '5rem', priority: 90 },
    { id: 'maps', width: '5.5rem', priority: 80 },
    { id: 'diff', width: '4rem', priority: 70 },
    { id: 'caps', width: '5.5rem', priority: 60 },
]

function advancementBands(specStage: EventStageSpec | null): Map<number, string> {
    const bands = new Map<number, string>()

    for (const rule of specStage?.advancement ?? []) {
        const from = rule.from_rank ?? 1
        const to = rule.to_rank ?? from
        for (let rank = from; rank <= to; rank += 1) {
            bands.set(rank, rule.label || rule.to_stage)
        }
    }

    return bands
}

function recordOf(row: EventStandingRow, drawsPossible: boolean): string {
    return drawsPossible ? `${row.wins}–${row.draws}–${row.losses}` : `${row.wins}–${row.losses}`
}

function StandingsTable({ rows, bands, drawsPossible }: {
    rows: EventStandingRow[]
    bands: Map<number, string>
    drawsPossible: boolean
}) {
    const [visible, setVisible] = useState<Set<string>>(() => new Set(COLUMNS.map(column => column.id)))
    const onResolve = useCallback((ids: Set<string>) => setVisible(ids), [])
    const shows = (id: string) => visible.has(id)

    const compact = (
        <div className="divide-y divide-hairline/5">
            {rows.map(row => (
                <div key={row.team_id} role="listitem" className="px-3 py-2 flex items-center gap-3">
                    <span className="w-5 shrink-0 tabular-nums text-muted-foreground text-sm">{row.rank}</span>
                    <div className="min-w-0 flex-1">
                        <TeamName teamId={row.team_id} className="block truncate text-sm text-foreground">
                            {row.team?.name ?? '—'}
                        </TeamName>
                        <div className="text-[11px] text-muted-foreground tabular-nums">
                            {recordOf(row, drawsPossible)} · maps {row.maps_won}–{row.maps_lost} · caps {row.caps_for}
                        </div>
                    </div>
                    <span className="shrink-0 tabular-nums text-sm font-semibold text-foreground">{row.points}</span>
                </div>
            ))}
        </div>
    )

    return (
        <DataTableShell
            className="flex-none"
            responsive={{ columns: COLUMNS, nameFloorRem: 12, compactContent: compact, compactAriaLabel: 'Group standings', onResolve }}
        >
            <DataTableHeaderRow>
                <DataTableHeaderCell width="3rem" align="right">#</DataTableHeaderCell>
                <DataTableHeaderCell width="12rem">Team</DataTableHeaderCell>
                <DataTableHeaderCell width="4rem" align="right">Pts</DataTableHeaderCell>
                {shows('record') && <DataTableHeaderCell width="5rem" align="right">{drawsPossible ? 'W–D–L' : 'W–L'}</DataTableHeaderCell>}
                {shows('maps') && <DataTableHeaderCell width="5.5rem" align="right">Maps</DataTableHeaderCell>}
                {shows('diff') && <DataTableHeaderCell width="4rem" align="right">Diff</DataTableHeaderCell>}
                {shows('caps') && <DataTableHeaderCell width="5.5rem" align="right">Caps</DataTableHeaderCell>}
            </DataTableHeaderRow>
            <tbody>
                {rows.length === 0 ? (
                    <DataTableEmpty
                        colSpan={3 + ['record', 'maps', 'diff', 'caps'].filter(shows).length}
                        message="No teams in this group yet."
                    />
                ) : rows.map(row => {
                    const band = bands.get(row.rank)
                    return (
                        <DataTableRow key={row.team_id}>
                            <DataTableCell align="right" className="tabular-nums text-muted-foreground">
                                <span className={cn(band && 'text-accent-300 font-medium')}>{row.rank}</span>
                            </DataTableCell>
                            <DataTableCell>
                                <div className="min-w-0">
                                    <TeamName teamId={row.team_id} className="block truncate text-foreground">
                                        {row.team?.name ?? '—'}
                                    </TeamName>
                                    {band && <div className="text-[10px] text-accent-300/80 truncate">{band}</div>}
                                </div>
                            </DataTableCell>
                            <DataTableCell align="right" className="tabular-nums font-semibold text-foreground">{row.points}</DataTableCell>
                            {shows('record') && <DataTableCell align="right" className="tabular-nums text-muted-foreground">{recordOf(row, drawsPossible)}</DataTableCell>}
                            {shows('maps') && <DataTableCell align="right" className="tabular-nums text-muted-foreground">{row.maps_won}–{row.maps_lost}</DataTableCell>}
                            {shows('diff') && (
                                <DataTableCell align="right" className={cn(
                                    'tabular-nums',
                                    row.map_diff > 0 ? 'text-emerald-300' : row.map_diff < 0 ? 'text-red-300' : 'text-muted-foreground',
                                )}>
                                    {row.map_diff > 0 ? `+${row.map_diff}` : row.map_diff}
                                </DataTableCell>
                            )}
                            {shows('caps') && <DataTableCell align="right" className="tabular-nums text-muted-foreground">{row.caps_for}–{row.caps_against}</DataTableCell>}
                        </DataTableRow>
                    )
                })}
            </tbody>
        </DataTableShell>
    )
}

export function GroupStageView({ stage, specStage, onMapSelect }: {
    stage: EventBracketStage
    specStage: EventStageSpec | null
    onMapSelect?: (mapName: string) => void
}) {
    const bands = useMemo(() => advancementBands(specStage), [specStage])
    const rounds = useMemo(() => stageRounds(stage), [stage])

    if (stage.groups.length === 0) {
        return <p className="text-sm text-muted-foreground">This stage has not been drawn yet.</p>
    }

    const config = stage.config as EventGroupsConfig | null
    const points = config?.points ?? []
    const drawsPossible = points.some(row => row.maps_won === row.maps_lost)

    return (
        <div className="space-y-6">
            {points.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                    {points.map(row => `${row.maps_won}–${row.maps_lost} ${row.points} pt${row.points === 1 ? '' : 's'}`).join(' · ')}
                </p>
            )}

            {stage.groups.map(group => (
                <GroupPanel key={group.id} stage={stage} group={group} bands={bands} rounds={rounds}
                    drawsPossible={drawsPossible} onMapSelect={onMapSelect} />
            ))}
        </div>
    )
}

function GroupPanel({ stage, group, bands, rounds, drawsPossible, onMapSelect }: {
    stage: EventBracketStage
    group: EventBracketGroup
    bands: Map<number, string>
    rounds: number[]
    drawsPossible: boolean
    onMapSelect?: (mapName: string) => void
}) {
    const [showMatches, setShowMatches] = useState(false)
    const matches = stage.matches.filter(match => match.group_id === group.id)

    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">{group.name}</h3>
                {matches.length > 0 && (
                    <button
                        type="button"
                        onClick={() => setShowMatches(value => !value)}
                        className="text-[11px] text-muted-foreground hover:text-white transition-colors cursor-pointer"
                    >
                        {showMatches ? 'Hide' : 'Show'} {matches.length} match{matches.length === 1 ? '' : 'es'}
                    </button>
                )}
            </div>

            <StandingsTable rows={group.standings} bands={bands} drawsPossible={drawsPossible} />

            {showMatches && (
                <div className="space-y-3">
                    {rounds.map(round => {
                        const inRound = matches
                            .filter(match => match.round_no === round)
                            .sort((a, b) => a.ordinal - b.ordinal)
                        if (inRound.length === 0) return null

                        return (
                            <div key={round} className="space-y-1.5">
                                <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground">Round {round}</h4>
                                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                    {inRound.map(match => (
                                        <MatchCard key={match.id} match={match} onMapSelect={onMapSelect} />
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </section>
    )
}
