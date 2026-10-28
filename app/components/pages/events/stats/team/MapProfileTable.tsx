import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import { EMPTY_STAT, mapProfileView, type MapProfileRowView } from '@/app/components/pages/events/stats/statsView'
import type { EventRun, EventTeamMapProfileRow } from '@/app/utils/api'
import { wdlBarSegments } from './teamTablesView'
import { RESULT_FILLS, SECTION_LABEL } from './teamShared'
import { MapName, TeamTable, type TeamTableHeader } from './TeamTable'

const HEADERS: Record<string, TeamTableHeader> = {
    map: { label: 'Map', align: 'left' },
    picked: { label: 'Picked', align: 'right' },
    bannedBy: { label: 'Banned', align: 'right' },
    bannedAgainst: { label: 'Banned vs', align: 'right' },
    played: { label: 'Played', align: 'right' },
    wdl: { label: 'W-D-L', align: 'left', required: true },
    caps: { label: 'Caps', align: 'right' },
    best: { label: 'Best time', align: 'right' },
}

interface ProfileEntry {
    row: MapProfileRowView
    best: EventRun | null
}

function WdlCell({ row }: { row: MapProfileRowView }) {
    if (!row.wdl) return <span className="text-muted-foreground">{EMPTY_STAT}</span>

    return (
        <span className="flex flex-col gap-1">
            <span className="font-mono tabular-nums text-foreground">{row.wdl}</span>
            <span aria-hidden className="flex h-1.5 overflow-hidden rounded-full bg-hairline/10">
                {wdlBarSegments(row.wdlShares).map(segment => (
                    <span key={segment.result} className={RESULT_FILLS[segment.result]} style={{ width: segment.width }} />
                ))}
            </span>
        </span>
    )
}

function BestTime({ run }: { run: EventRun | null }) {
    if (!run) return <span className="text-muted-foreground">{EMPTY_STAT}</span>

    return (
        <CapTimeLink
            teamCapId={run.team_cap_id}
            capId={run.members[0]?.cap_id}
            seconds={run.team_time_seconds}
            className="font-mono font-semibold tabular-nums text-foreground"
        />
    )
}

function Count({ value }: { value: string }) {
    return <span className={cn('font-mono tabular-nums', value === '0' ? 'text-muted-foreground' : 'text-foreground')}>{value}</span>
}

function cellContent(id: string, { row, best }: ProfileEntry) {
    switch (id) {
        case 'map': return <MapName row={row} />
        case 'picked': return <Count value={row.picked} />
        case 'bannedBy': return <Count value={row.bannedBy} />
        case 'bannedAgainst': return <Count value={row.bannedAgainst} />
        case 'played': return <Count value={row.played} />
        case 'wdl': return <WdlCell row={row} />
        case 'caps': return <span className="font-mono tabular-nums text-foreground">{row.caps}</span>
        case 'best': return <BestTime run={best} />
        default: return null
    }
}

function CompactProfileRow({ entry }: { entry: ProfileEntry }) {
    return (
        <div role="listitem" className="flex flex-col gap-3 border-b border-hairline/5 p-3 last:border-0">
            <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1"><MapName row={entry.row} /></span>
                <BestTime run={entry.best} />
            </div>
            <div className="grid grid-cols-3 gap-2">
                {entry.row.compact.map(cell => (
                    <div key={cell.label} className="min-w-0">
                        <div className={SECTION_LABEL}>{cell.label}</div>
                        {cell.label === HEADERS.wdl.label
                            ? <WdlCell row={entry.row} />
                            : <div className="font-mono text-sm tabular-nums text-foreground">{cell.value}</div>}
                    </div>
                ))}
            </div>
        </div>
    )
}

export function MapProfileTable({ rows, teamName }: { rows: EventTeamMapProfileRow[]; teamName: string }) {
    const view = useMemo(() => mapProfileView(rows), [rows])
    const entries = view.rows.map((row, index): ProfileEntry => ({ row, best: rows[index].best_run }))

    return (
        <TeamTable
            id="team-map-profile"
            title="Map profile"
            caption={`Banned = by ${teamName} · Banned vs = by their opponents`}
            emptyText={view.emptyText}
            columns={view.columns}
            headers={HEADERS}
            rows={entries}
            rowKey={entry => entry.row.map}
            cell={cellContent}
            compactRows={entries.map(entry => <CompactProfileRow key={entry.row.map} entry={entry} />)}
        />
    )
}
