import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import {
    DataTableCell, DataTableHeaderCell, DataTableHeaderRow, DataTableRow, DataTableShell,
} from '@/app/components/shared/DataTable'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import type { EventStatsMap } from '@/app/utils/api'
import { EMPTY_STAT, mapTableView, type BarCell, type MapTableRowView, type MapTableView } from './statsView'
import type { OverviewTeam } from './StatsOverview'
import { OverviewTeamLink } from './OverviewTeamLink'
import './overviewStats.css'

export interface MapStatsRowView extends MapTableRowView {
    fastestSeconds: number | null
    fastestTeam: OverviewTeam | null
}

export interface MapStatsView extends Omit<MapTableView, 'rows'> {
    rows: MapStatsRowView[]
}

export function mapStatsView(
    maps: readonly EventStatsMap[],
    teams: Record<string, OverviewTeam>,
    table: MapTableView = mapTableView(maps),
): MapStatsView {
    return {
        ...table,
        rows: table.rows.map((row, index) => ({
            ...row,
            fastestSeconds: maps[index].fastest_run?.team_time_seconds ?? null,
            fastestTeam: (row.fastest && teams[row.fastest.teamId]) ?? null,
        })),
    }
}

const NUMBER = 'font-mono tabular-nums text-foreground'

function CountBar({ cell, pick }: { cell: BarCell; pick?: boolean }) {
    return (
        <span className="map-stat-bar">
            <i aria-hidden className={pick ? 'text-emerald-400' : 'text-red-400'} style={{ '--share': `${cell.share * 100}%` } as CSSProperties} />
            <span className={cn('text-right', NUMBER)}>{cell.value}</span>
        </span>
    )
}

export function MapName({ map, name, wrap, className }: { map: string; name: string; wrap?: boolean; className?: string }) {
    return (
        <span className={cn('flex min-w-0 items-center gap-2.5', className)}>
            <MapThumbnail mapName={map} alt="" className="size-8 shrink-0 rounded-md" />
            <span className={cn('font-semibold text-foreground', wrap ? 'line-clamp-2 break-all leading-tight' : 'truncate')} title={name}>{name}</span>
        </span>
    )
}

function CompactStat({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className={cn('text-sm font-semibold', NUMBER)}>{children}</div>
        </div>
    )
}

function FastestRun({ row, eventSlug }: { row: MapStatsRowView; eventSlug: string }) {
    const run = row.fastest?.run
    if (!run || row.fastestSeconds === null) return <span className="text-muted-foreground">{EMPTY_STAT}</span>

    return (
        <span className="flex min-w-0 flex-col">
            <CapTimeLink
                teamCapId={run.teamCapId}
                capId={run.members[0]?.capId}
                seconds={row.fastestSeconds}
                className="font-mono font-semibold tabular-nums text-foreground"
            />
            <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                {row.fastestTeam && <OverviewTeamLink team={row.fastestTeam} eventSlug={eventSlug} />}
                {run.members.map((member, index) => (
                    <span key={member.capId} className="flex min-w-0 items-center gap-x-1.5">
                        <span aria-hidden>{index ? '+' : '·'}</span>
                        <PlayerInfo userId={member.user} alias={member.alias} size="sm" presentation="name" />
                    </span>
                ))}
            </span>
        </span>
    )
}

export function MapStatsTable({ maps, teams, eventSlug }: {
    maps: readonly EventStatsMap[]
    teams: Record<string, OverviewTeam>
    eventSlug: string
}) {
    const table = useMemo(() => mapTableView(maps), [maps])
    const view = mapStatsView(maps, teams, table)
    const [resolved, setResolved] = useState<Set<string> | null>(null)
    const shows = (id: string) => resolved?.has(id) ?? true
    const widths = Object.fromEntries(view.columns.map(column => [column.id, column.width]))

    if (view.rows.length === 0) {
        return (
            <p className="rounded-xl border border-hairline/5 bg-card/30 px-4 py-8 text-center text-sm text-muted-foreground">
                {view.emptyText}
            </p>
        )
    }

    const compact = view.rows.map(row => (
        <div key={row.map} role="listitem" className="flex flex-col gap-2 border-b border-hairline/5 px-3 py-3 last:border-b-0">
            <MapName map={row.map} name={row.displayName} />
            <FastestRun row={row} eventSlug={eventSlug} />
            <div className="grid grid-cols-3 gap-x-3 gap-y-1.5">
                <CompactStat label="Played">{row.played}</CompactStat>
                <CompactStat label="Picks"><CountBar cell={row.picks} pick /></CompactStat>
                <CompactStat label="Bans"><CountBar cell={row.bans} /></CompactStat>
                <CompactStat label="1st bans">{row.firstBans}</CompactStat>
                <CompactStat label="Picker wins">{row.pickerRate}</CompactStat>
                {view.hasDeciders && <CompactStat label="Deciders">{row.deciders}</CompactStat>}
            </div>
        </div>
    ))
    const header = (id: string, label: string, right?: boolean) => shows(id) && (
        <DataTableHeaderCell width={widths[id]} align={right ? 'right' : undefined}>{label}</DataTableHeaderCell>
    )
    const number = (id: string, value: string) => shows(id) && <DataTableCell align="right" className={NUMBER}>{value}</DataTableCell>

    return (
        <DataTableShell
            className="flex-none"
            responsive={{ columns: view.columns, nameFloorRem: 12, compactContent: compact, compactAriaLabel: 'Maps', onResolve: setResolved }}
        >
            <DataTableHeaderRow>
                {header('map', 'Map')}
                {header('played', 'Played', true)}
                {header('picks', 'Picks')}
                {header('bans', 'Bans')}
                {header('firstBans', '1st bans', true)}
                {view.hasDeciders && header('deciders', 'Deciders', true)}
                {header('picker', 'Picker wins', true)}
                {header('fastest', 'Fastest cup run')}
            </DataTableHeaderRow>
            <tbody>
                {view.rows.map(row => (
                    <DataTableRow key={row.map}>
                        <DataTableCell><MapName map={row.map} name={row.displayName} /></DataTableCell>
                        {number('played', row.played)}
                        {shows('picks') && <DataTableCell><CountBar cell={row.picks} pick /></DataTableCell>}
                        {shows('bans') && <DataTableCell><CountBar cell={row.bans} /></DataTableCell>}
                        {number('firstBans', row.firstBans)}
                        {view.hasDeciders && number('deciders', row.deciders)}
                        {shows('picker') && (
                            <DataTableCell align="right" className="whitespace-nowrap">
                                <span className={NUMBER}>{row.pickerRate}</span>{' '}
                                <span className="text-xs text-muted-foreground">{row.pickerRecord}</span>
                            </DataTableCell>
                        )}
                        <DataTableCell><FastestRun row={row} eventSlug={eventSlug} /></DataTableCell>
                    </DataTableRow>
                ))}
            </tbody>
        </DataTableShell>
    )
}
