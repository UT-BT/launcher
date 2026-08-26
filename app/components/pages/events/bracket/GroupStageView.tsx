import { Fragment, useCallback, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    DataTableCell, DataTableEmpty, DataTableHeaderCell, DataTableHeaderRow, DataTableRow, DataTableShell,
    type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import type {
    EventBracketGroup, EventBracketStage, EventGroupsConfig, EventMatch, EventStageSpec, EventStandingRow,
} from '@/app/utils/api'
import { MatchCard, matchOrder } from './bracketShared'
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

/** Every match the team is in, played or still to come, earliest round first. */
function matchesFor(matches: EventMatch[], teamId: string): EventMatch[] {
    return matches.filter(match => match.team_a?.id === teamId || match.team_b?.id === teamId)
}

function TeamMatches({ matches, onMapSelect }: {
    matches: EventMatch[]
    onMapSelect?: (mapName: string) => void
}) {
    if (matches.length === 0) {
        return <p className="text-[11px] text-muted-foreground">No matches drawn for this team yet.</p>
    }

    return (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {matches.map(match => (
                <MatchCard key={match.id} match={match} onMapSelect={onMapSelect} />
            ))}
        </div>
    )
}

function StandingsTable({ rows, matches, bands, drawsPossible, onMapSelect }: {
    rows: EventStandingRow[]
    matches: EventMatch[]
    bands: Map<number, string>
    drawsPossible: boolean
    onMapSelect?: (mapName: string) => void
}) {
    const [visible, setVisible] = useState<Set<string>>(() => new Set(COLUMNS.map(column => column.id)))
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
    const onResolve = useCallback((ids: Set<string>) => setVisible(ids), [])
    const shows = (id: string) => visible.has(id)

    const toggle = (teamId: string) => setExpanded(current => {
        const next = new Set(current)
        if (!next.delete(teamId)) next.add(teamId)
        return next
    })

    const compact = (
        <div className="divide-y divide-hairline/5">
            {rows.map(row => {
                const open = expanded.has(row.team_id)
                return (
                    <div key={row.team_id} role="listitem" className="px-3 py-2">
                        {/* A div, not a button: TeamName's tooltip wraps its child in a
                            div, which a button may not contain. */}
                        <div
                            role="button"
                            tabIndex={0}
                            aria-expanded={open}
                            onClick={() => toggle(row.team_id)}
                            onKeyDown={event => {
                                if (event.key !== 'Enter' && event.key !== ' ') return
                                event.preventDefault()
                                toggle(row.team_id)
                            }}
                            className="w-full flex items-center gap-3 text-left cursor-pointer rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60"
                        >
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
                            {open
                                ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                                : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />}
                        </div>
                        {open && (
                            <div className="pt-2">
                                <TeamMatches matches={matchesFor(matches, row.team_id)} onMapSelect={onMapSelect} />
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )

    const columnCount = 3 + ['record', 'maps', 'diff', 'caps'].filter(shows).length

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
                    <DataTableEmpty colSpan={columnCount} message="No teams in this group yet." />
                ) : rows.map(row => {
                    const band = bands.get(row.rank)
                    const open = expanded.has(row.team_id)

                    return (
                        <Fragment key={row.team_id}>
                            <DataTableRow
                                onClick={() => toggle(row.team_id)}
                                aria-expanded={open}
                                className="cursor-pointer"
                            >
                                <DataTableCell align="right" className="tabular-nums text-muted-foreground">
                                    <span className={cn(band && 'text-accent-300 font-medium')}>{row.rank}</span>
                                </DataTableCell>
                                <DataTableCell>
                                    <div className="min-w-0 flex items-center gap-1.5">
                                        {open
                                            ? <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                                            : <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/50 group-hover:text-muted-foreground" />}
                                        <div className="min-w-0">
                                            <TeamName teamId={row.team_id} className="block truncate text-foreground">
                                                {row.team?.name ?? '—'}
                                            </TeamName>
                                            {band && <div className="text-[10px] text-accent-300/80 truncate">{band}</div>}
                                        </div>
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
                            {open && (
                                <tr className="border-b border-hairline/5">
                                    <td colSpan={columnCount} className="px-4 py-3 bg-hairline/[0.02]">
                                        <TeamMatches matches={matchesFor(matches, row.team_id)} onMapSelect={onMapSelect} />
                                    </td>
                                </tr>
                            )}
                        </Fragment>
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
    const ordered = useMemo(
        () => [...stage.matches].sort(matchOrder(stage.groups)),
        [stage.matches, stage.groups],
    )

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
                <GroupPanel key={group.id} matches={ordered} group={group} bands={bands}
                    drawsPossible={drawsPossible} onMapSelect={onMapSelect} />
            ))}
        </div>
    )
}

function GroupPanel({ matches, group, bands, drawsPossible, onMapSelect }: {
    matches: EventMatch[]
    group: EventBracketGroup
    bands: Map<number, string>
    drawsPossible: boolean
    onMapSelect?: (mapName: string) => void
}) {
    const inGroup = useMemo(
        () => matches.filter(match => match.group_id === group.id),
        [matches, group.id],
    )

    return (
        <section className="space-y-3">
            <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">{group.name}</h3>
                <span className="text-[11px] text-muted-foreground">Pick a team to see its matches</span>
            </div>

            <StandingsTable rows={group.standings} matches={inGroup} bands={bands}
                drawsPossible={drawsPossible} onMapSelect={onMapSelect} />
        </section>
    )
}
