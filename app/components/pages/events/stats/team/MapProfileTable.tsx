import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import { EMPTY_STAT, mapProfileView, type MapProfileRowView, type MapRankView } from '@/app/components/pages/events/stats/statsView'
import type { EventRun, EventTeamMapProfileRow } from '@/app/utils/api'
import { wdlBarSegments } from './teamTablesView'
import { RESULT_FILLS, SECTION_LABEL } from './teamShared'
import { MapName, TeamTable, type TeamTableHeader } from './TeamTable'

const HEADERS: Record<string, TeamTableHeader> = {
    map: { align: 'left' },
    picked: { align: 'right' },
    bannedBy: { align: 'right' },
    bannedAgainst: { align: 'right' },
    played: { align: 'right' },
    wdl: { align: 'left', required: true },
    caps: { align: 'right' },
    best: { align: 'right' },
    rank: { align: 'right' },
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

function Rank({ rank }: { rank: MapRankView | null }) {
    if (!rank) return <span className="text-muted-foreground">{EMPTY_STAT}</span>

    return (
        <span className="inline-flex items-baseline gap-1 whitespace-nowrap">
            <span className={cn('font-bold tabular-nums', rank.top ? 'text-yellow-300' : 'text-foreground')}>{rank.position}</span>
            <span className="text-xs tabular-nums text-muted-foreground">{rank.of}</span>
        </span>
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
        case 'rank': return <Rank rank={row.rank} />
        default: return null
    }
}

function ProfileFace({ entry }: { entry: ProfileEntry }) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1"><MapName row={entry.row} /></span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                    <BestTime run={entry.best} />
                    {entry.row.rank && <Rank rank={entry.row.rank} />}
                </span>
            </div>
            <div className="flex items-center gap-3">
                <span className={SECTION_LABEL}>W-D-L</span>
                <span className="w-28"><WdlCell row={entry.row} /></span>
            </div>
        </div>
    )
}

export function MapProfileTable({ rows, teamName }: { rows: EventTeamMapProfileRow[]; teamName: string }) {
    const view = useMemo(() => mapProfileView(rows), [rows])
    const entries = view.rows.map((row, index): ProfileEntry => ({ row, best: rows[index].best_run }))
    const { navigate } = useNavigation()

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
            face={entry => <ProfileFace entry={entry} />}
            onOpen={entry => navigate('maps-detail', { mapName: entry.row.map })}
        />
    )
}
