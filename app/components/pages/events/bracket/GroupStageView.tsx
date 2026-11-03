import { Fragment, useCallback, useMemo, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    DataTableCell, DataTableEmpty, DataTableHeaderCell, DataTableHeaderRow, DataTableRow, DataTableShell,
    type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import type {
    EventBracketGroup, EventBracketStage, EventGroupsConfig, EventMatch, EventStageSpec, EventStandingRow,
} from '@/app/utils/api'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { MatchCard, matchOrder, schedulerEligible } from './bracketShared'
import { TeamName } from '../TeamRoster'

type StandingColumnId = 'rank' | 'team' | 'points' | 'record' | 'maps' | 'diff' | 'caps'

const COLUMNS: (ResponsiveColumn & { id: StandingColumnId })[] = [
    { id: 'rank', width: '3rem', required: true, tier: 'essential', label: 'Rank' },
    { id: 'team', width: '12rem', required: true, tier: 'essential', label: 'Team' },
    { id: 'points', width: '4rem', required: true, tier: 'essential', label: 'Points' },
    { id: 'record', width: '5rem', priority: 90, tier: 'essential', label: 'Record' },
    { id: 'maps', width: '5.5rem', priority: 80, tier: 'detail', label: 'Maps' },
    { id: 'diff', width: '4rem', priority: 70, tier: 'detail', label: 'Diff' },
    { id: 'caps', width: '5.5rem', priority: 60, tier: 'detail', label: 'Caps' },
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

function recordLabel(drawsPossible: boolean): string {
    return drawsPossible ? 'W–D–L' : 'W–L'
}

function recordOf(row: EventStandingRow, drawsPossible: boolean): string {
    return drawsPossible ? `${row.wins}–${row.draws}–${row.losses}` : `${row.wins}–${row.losses}`
}

function matchesFor(matches: EventMatch[], teamId: string): EventMatch[] {
    return matches.filter(match => match.team_a?.id === teamId || match.team_b?.id === teamId)
}

function TeamMatches({ matches, now, onMapSelect, onScheduleMatch, eventSlug, myTeamId }: {
    matches: EventMatch[]
    now: number
    onMapSelect?: (mapName: string) => void
    onScheduleMatch?: (matchId: string) => void
    eventSlug?: string
    myTeamId?: string | null
}) {
    if (matches.length === 0) {
        return <p className="text-[11px] text-muted-foreground">No matches drawn for this team yet.</p>
    }

    return (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {matches.map(match => (
                <MatchCard key={match.id} match={match} now={now} onMapSelect={onMapSelect} eventSlug={eventSlug} myTeamId={myTeamId}
                    onClick={onScheduleMatch && schedulerEligible(match) ? () => onScheduleMatch(match.id) : undefined} />
            ))}
        </div>
    )
}

function StandingsTable({ rows, matches, bands, drawsPossible, now, onMapSelect, onScheduleMatch, eventSlug, myTeamId }: {
    rows: EventStandingRow[]
    matches: EventMatch[]
    bands: Map<number, string>
    drawsPossible: boolean
    now: number
    onMapSelect?: (mapName: string) => void
    onScheduleMatch?: (matchId: string) => void
    eventSlug?: string
    myTeamId?: string | null
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

    const { navigate } = useNavigation()

    const cell = (id: StandingColumnId, row: EventStandingRow): ReactNode => {
        const band = bands.get(row.rank)
        switch (id) {
            case 'rank': return <span className={cn(band && 'text-accent-300 font-medium')}>{row.rank}</span>
            case 'team': {
                const open = expanded.has(row.team_id)
                return (
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
                )
            }
            case 'points': return row.points
            case 'record': return recordOf(row, drawsPossible)
            case 'maps': return <>{row.maps_won}–{row.maps_lost}</>
            case 'diff': return row.map_diff > 0 ? `+${row.map_diff}` : row.map_diff
            case 'caps': return <>{row.caps_for}–{row.caps_against}</>
        }
    }

    const teamMatches = (row: EventStandingRow) => (
        <TeamMatches matches={matchesFor(matches, row.team_id)} now={now} onMapSelect={onMapSelect} onScheduleMatch={onScheduleMatch} eventSlug={eventSlug} myTeamId={myTeamId} />
    )

    const matchesPanel = (row: EventStandingRow) => (
        <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Matches</p>
            {teamMatches(row)}
        </div>
    )

    const columns: ResponsiveColumn<EventStandingRow>[] = COLUMNS.map(column => ({
        ...column,
        label: column.id === 'record' ? recordLabel(drawsPossible) : column.label,
        cell: row => cell(column.id, row),
    }))

    const face = (row: EventStandingRow) => {
        const band = bands.get(row.rank)
        return (
            <div className="flex items-center gap-3">
                <span className={cn('w-5 shrink-0 tabular-nums text-sm', band ? 'text-accent-300 font-medium' : 'text-muted-foreground')}>{row.rank}</span>
                <div className="min-w-0 flex-1">
                    <TeamName teamId={row.team_id} className="block truncate text-sm text-foreground">
                        {row.team?.name ?? '—'}
                    </TeamName>
                    {band && <div className="text-[10px] text-accent-300/80 truncate">{band}</div>}
                </div>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{recordOf(row, drawsPossible)}</span>
                <span className="shrink-0 tabular-nums text-sm font-semibold text-foreground">
                    {row.points}<span className="text-[11px] font-normal text-muted-foreground"> pts</span>
                </span>
            </div>
        )
    }

    const columnCount = 3 + ['record', 'maps', 'diff', 'caps'].filter(shows).length

    return (
        <DataTableShell
            className="flex-none"
            responsive={{
                columns,
                nameFloorRem: 12,
                compactAriaLabel: 'Group standings',
                onResolve,
                cards: {
                    rows,
                    rowKey: row => row.team_id,
                    face,
                    onOpen: eventSlug ? row => navigate('event-team', { eventSlug, eventTeamId: row.team_id }) : undefined,
                    panel: matchesPanel,
                    placeholder: rows.length === 0 && (
                        <p className="px-4 py-8 text-center text-sm text-muted-foreground">No teams in this group yet.</p>
                    ),
                },
            }}
        >
            <DataTableHeaderRow>
                <DataTableHeaderCell width="3rem" align="right">#</DataTableHeaderCell>
                <DataTableHeaderCell width="12rem">Team</DataTableHeaderCell>
                <DataTableHeaderCell width="4rem" align="right">Pts</DataTableHeaderCell>
                {shows('record') && <DataTableHeaderCell width="5rem" align="right">{recordLabel(drawsPossible)}</DataTableHeaderCell>}
                {shows('maps') && <DataTableHeaderCell width="5.5rem" align="right">Maps</DataTableHeaderCell>}
                {shows('diff') && <DataTableHeaderCell width="4rem" align="right">Diff</DataTableHeaderCell>}
                {shows('caps') && <DataTableHeaderCell width="5.5rem" align="right">Caps</DataTableHeaderCell>}
            </DataTableHeaderRow>
            <tbody>
                {rows.length === 0 ? (
                    <DataTableEmpty colSpan={columnCount} message="No teams in this group yet." />
                ) : rows.map(row => {
                    const open = expanded.has(row.team_id)

                    return (
                        <Fragment key={row.team_id}>
                            <DataTableRow
                                onClick={() => toggle(row.team_id)}
                                aria-expanded={open}
                                className="cursor-pointer"
                            >
                                <DataTableCell align="right" className="tabular-nums text-muted-foreground">{cell('rank', row)}</DataTableCell>
                                <DataTableCell>{cell('team', row)}</DataTableCell>
                                <DataTableCell align="right" className="tabular-nums font-semibold text-foreground">{cell('points', row)}</DataTableCell>
                                {shows('record') && <DataTableCell align="right" className="tabular-nums text-muted-foreground">{cell('record', row)}</DataTableCell>}
                                {shows('maps') && <DataTableCell align="right" className="tabular-nums text-muted-foreground">{cell('maps', row)}</DataTableCell>}
                                {shows('diff') && (
                                    <DataTableCell align="right" className={cn(
                                        'tabular-nums',
                                        row.map_diff > 0 ? 'text-emerald-300' : row.map_diff < 0 ? 'text-red-300' : 'text-muted-foreground',
                                    )}>
                                        {cell('diff', row)}
                                    </DataTableCell>
                                )}
                                {shows('caps') && <DataTableCell align="right" className="tabular-nums text-muted-foreground">{cell('caps', row)}</DataTableCell>}
                            </DataTableRow>
                            {open && (
                                <tr className="border-b border-hairline/5">
                                    <td colSpan={columnCount} className="px-4 py-3 bg-hairline/[0.02]">
                                        {teamMatches(row)}
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

export function GroupStageView({ stage, specStage, now, onMapSelect, onScheduleMatch, eventSlug, myTeamId }: {
    stage: EventBracketStage
    specStage: EventStageSpec | null
    now: number
    onMapSelect?: (mapName: string) => void
    onScheduleMatch?: (matchId: string) => void
    eventSlug?: string
    myTeamId?: string | null
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
                    drawsPossible={drawsPossible} now={now} onMapSelect={onMapSelect} onScheduleMatch={onScheduleMatch}
                    eventSlug={eventSlug} myTeamId={myTeamId} />
            ))}
        </div>
    )
}

function GroupPanel({ matches, group, bands, drawsPossible, now, onMapSelect, onScheduleMatch, eventSlug, myTeamId }: {
    matches: EventMatch[]
    group: EventBracketGroup
    bands: Map<number, string>
    drawsPossible: boolean
    now: number
    onMapSelect?: (mapName: string) => void
    onScheduleMatch?: (matchId: string) => void
    eventSlug?: string
    myTeamId?: string | null
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
                drawsPossible={drawsPossible} now={now} onMapSelect={onMapSelect} onScheduleMatch={onScheduleMatch}
                eventSlug={eventSlug} myTeamId={myTeamId} />
        </section>
    )
}
