import { Fragment, useId, useMemo } from 'react'
import { Clapperboard } from 'lucide-react'
import { Button } from '@/app/components/ui/button'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useNavState } from '@/app/components/navigation/useNavState'
import { CapTimeLink, openCap, openTeamCap } from '@/app/components/shared/CapTimeLink'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { Segmented } from '@/app/components/shared/Segmented'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { teamRunsView, type RunView, type TeamRunRowView } from '@/app/components/pages/events/stats/statsView'
import { useDisplayTimezone } from '@/app/utils/timezone'
import type { EventTeamStats } from '@/app/utils/api'
import {
    COMPACT_RUN_SORTS, DEFAULT_TEAM_RUN_SORT, nextTeamRunSort, runDateText, sortTeamRuns, teamRunsPage,
    type TeamRunSort, type TeamRunSortKey,
} from './teamTablesView'
import { TeamLink, useTeamPage } from './teamShared'
import { MapName, TeamTable, type TeamTableHeader } from './TeamTable'

const HEADERS: Record<string, TeamTableHeader<TeamRunSortKey>> = {
    map: { label: 'Map', align: 'left', sort: 'map' },
    time: { label: 'Time', align: 'right', sort: 'time' },
    players: { label: 'Run', align: 'left', required: true },
    opponent: { label: 'Opponent', align: 'left', sort: 'opponent' },
    stage: { label: 'Stage', align: 'left', sort: 'stage' },
    date: { label: 'Date', align: 'left', sort: 'date' },
    replay: { label: 'Replay', align: 'center', hiddenLabel: true },
}

interface RunEntry {
    key: string
    row: TeamRunRowView
    seconds: number
    date: string
}

function ReplayLink({ run }: { run: RunView }) {
    const { teamCapId } = run
    const capId = run.members[0]?.capId
    if (!run.replay || (!teamCapId && !capId)) return null

    return (
        <NavLink
            view={teamCapId ? 'team-cap-detail' : 'cap-detail'}
            params={teamCapId ? { teamCapId } : { capId: capId! }}
            onActivate={() => (teamCapId ? openTeamCap(teamCapId) : openCap(capId!))}
            title={run.replay === 'demo' ? 'Demo available' : 'Ghost available'}
            ariaLabel="Watch replay"
            className="inline-flex cursor-pointer text-yellow-300 hover:opacity-80"
        >
            <Clapperboard className="size-4" aria-hidden />
        </NavLink>
    )
}

function RunTime({ entry }: { entry: RunEntry }) {
    const { run } = entry.row
    return (
        <CapTimeLink
            teamCapId={run.teamCapId}
            capId={run.members[0]?.capId}
            seconds={entry.seconds}
            className="font-mono font-semibold tabular-nums text-foreground"
        />
    )
}

function RunPlayers({ run }: { run: RunView }) {
    return (
        <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            {run.members.map((member, index) => (
                <Fragment key={member.capId}>
                    {index > 0 && <span aria-hidden className="text-xs text-muted-foreground">+</span>}
                    <span className="min-w-0">
                        <PlayerInfo userId={member.user} alias={member.alias} size="sm" presentation="name" />
                    </span>
                </Fragment>
            ))}
        </span>
    )
}

function Opponent({ row }: { row: TeamRunRowView }) {
    const { accentOf } = useTeamPage()
    return (
        <TeamLink teamId={row.opponentId} className="font-semibold" style={{ color: accentOf(row.opponentId) }}>
            {row.opponentLabel}
        </TeamLink>
    )
}

function cellContent(id: string, entry: RunEntry) {
    const { row } = entry
    switch (id) {
        case 'map': return <MapName row={row} />
        case 'time': return <RunTime entry={entry} />
        case 'players': return <RunPlayers run={row.run} />
        case 'opponent': return <Opponent row={row} />
        case 'stage': return <span className="text-muted-foreground">{row.stageName}</span>
        case 'date': return <span className="tabular-nums text-muted-foreground">{entry.date}</span>
        case 'replay': return <ReplayLink run={row.run} />
        default: return null
    }
}

function CompactSortSwitch({ sort, onChange }: { sort: TeamRunSort; onChange: (sort: TeamRunSort) => void }) {
    const labelId = useId()
    return (
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span id={labelId}>Sort</span>
            <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
                {COMPACT_RUN_SORTS.map(option => (
                    <Segmented
                        key={option.key}
                        active={sort.key === option.key}
                        label={option.label}
                        onClick={() => onChange({ key: option.key, dir: 'asc' })}
                    />
                ))}
            </div>
        </div>
    )
}

function CompactRun({ entry }: { entry: RunEntry }) {
    const { row } = entry
    return (
        <div role="listitem" className="flex items-center gap-3 border-b border-hairline/5 p-3 last:border-0">
            <MapThumbnail mapName={row.map} alt="" className="size-10 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-foreground">{row.displayName}</div>
                <div className="truncate text-xs text-muted-foreground">
                    vs <Opponent row={row} /> · {entry.date}
                </div>
            </div>
            <span className="flex shrink-0 items-center gap-2">
                <RunTime entry={entry} />
                <ReplayLink run={row.run} />
            </span>
        </div>
    )
}

export function TeamRunsTable({ stats }: { stats: EventTeamStats }) {
    const timezone = useDisplayTimezone()
    const [sort, setSort] = useNavState<TeamRunSort>('teamRuns.sort', DEFAULT_TEAM_RUN_SORT)
    const [showAll, setShowAll] = useNavState('teamRuns.showAll', false)

    const { view, entries } = useMemo(() => {
        const sorted = sortTeamRuns(stats, sort)
        const runs = teamRunsView({ ...stats, runs: sorted })
        const rows = runs.rows.map((row, index): RunEntry => {
            const run = sorted[index]
            return {
                key: run.team_run_id ?? run.team_cap_id ?? run.members.map(member => member.cap_id).join('+'),
                row,
                seconds: run.team_time_seconds,
                date: runDateText(row.completedAt, timezone),
            }
        })
        return { view: runs, entries: rows }
    }, [stats, sort, timezone])
    const page = teamRunsPage(entries, showAll)

    return (
        <TeamTable
            id="team-runs"
            title="All runs"
            caption={entries.length > 0 && `${entries.length} linked run${entries.length === 1 ? '' : 's'}`}
            emptyText={view.emptyText}
            columns={view.columns}
            headers={HEADERS}
            rows={entries}
            rowKey={entry => entry.key}
            cell={cellContent}
            compactRows={page.rows.map(entry => <CompactRun key={entry.key} entry={entry} />)}
            compactTop={<CompactSortSwitch sort={sort} onChange={setSort} />}
            compactBottom={page.showAllLabel && (
                <Button variant="secondary" size="sm" className="w-fit" onClick={() => setShowAll(true)}>{page.showAllLabel}</Button>
            )}
            sort={sort}
            onSort={key => setSort(nextTeamRunSort(sort, key))}
        />
    )
}
