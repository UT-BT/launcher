import { useCallback, useMemo, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CompareLink } from '@/app/components/shared/CompareLink'
import {
    DataTableCell,
    DataTableHeaderCell,
    DataTableHeaderRow,
    DataTableRow,
    DataTableShell,
    type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { useNavState } from '@/app/components/navigation/useNavState'
import { TONE_TEXT } from '@/app/components/pages/capDetail/runDelta/deltaStyles'
import type { CuePoint } from '../model/cueModel'
import { pairRouteNote, pairSummaries, type PairSide, type PairSummary, type TeamAnalysisModel, type TeamSplitCell, type TeamSplitRow } from '../model/teamAnalysisModel'
import type { TeamRow } from '../model/teamModel'
import type { PlaybackController } from '../playback/playbackController'
import { TeamIndex, TeamLabel } from '../stage/TeamLabel'
import type { CueSync } from '../transport/useCueSync'
import { BASELINE, FINISH, zoneLabel } from './analysisLabels'
import { runName, RunIdentity } from './RunIdentity'
import './analysis.css'

const ZONE_COLUMN = 'zone'
const ZONE_WIDTH = '5rem'
const TEAM_WIDTH = '6rem'

interface TeamAnalysisProps {
    analysis: TeamAnalysisModel
    controller: PlaybackController | null
    cueSync: CueSync
}

type Jump = (cue: CuePoint | null, atMs: number) => void

function seatOf(team: TeamRow, cell: TeamSplitCell): number | null {
    if (!cell.member) return null
    const index = team.team.members.findIndex(member => member.capId === cell.member?.capId)
    return index < 0 ? null : index + 1
}

function SplitCell({ cell, team }: { cell: TeamSplitCell | null; team: TeamRow }) {
    if (!cell) return null
    const seat = seatOf(team, cell)
    return (
        <span className="run-compare-team-split">
            {seat !== null && cell.member && (
                <span title={`${runName(cell.member)} crossed first`} className="run-compare-team-split-seat">
                    <TeamIndex index={seat} colour={team.colour} />
                    <span className="sr-only">{runName(cell.member)}</span>
                </span>
            )}
            <span className="run-compare-matrix-value font-mono tabular-nums">
                <span className="run-compare-matrix-split">{cell.time}</span>
                {cell.delta && <span className={cn('run-compare-matrix-delta', TONE_TEXT[cell.delta.tone])}>{cell.delta.label}</span>}
            </span>
        </span>
    )
}

function splitAction(row: TeamSplitRow): string {
    return row.cue ? `Cue ${row.label}` : 'Seek to the cap'
}

function splitLabel(row: TeamSplitRow): string {
    return row.kind === 'cap' ? FINISH : zoneLabel(row.label)
}

interface TeamSplitsTableProps {
    teams: readonly TeamRow[]
    rows: readonly TeamSplitRow[]
    activeCue: string | null
    onJump: Jump
}

function TeamSplitsTable({ teams, rows, activeCue, onJump }: TeamSplitsTableProps) {
    const [storedPick, setPick] = useNavState<string | null>('compare.splitsTeam', null)
    const picked = teams.find(team => team.teamCapId === storedPick && !team.reference) ?? teams.find(team => !team.reference) ?? teams[0]
    const [visible, setVisible] = useState<ReadonlySet<string> | null>(null)
    const onResolve = useCallback((ids: Set<string>) => setVisible(ids), [])
    const columns = useMemo<ResponsiveColumn[]>(() => [
        { id: ZONE_COLUMN, width: ZONE_WIDTH, required: true, tier: 'essential', label: 'Zone' },
        ...teams.map((team, i): ResponsiveColumn => ({
            id: team.teamCapId,
            width: TEAM_WIDTH,
            priority: team.teamCapId === picked?.teamCapId ? 100 : team.reference ? 95 : 90 - i,
            tier: 'essential',
            label: team.label,
        })),
    ], [teams, picked?.teamCapId])
    const shown = teams.map(team => !visible || visible.has(team.teamCapId))
    const narrowed = shown.some(isShown => !isShown)

    return (
        <div className="run-compare-matrix">
            {narrowed && (
                <div role="group" aria-label="Splits team" className="run-compare-segmented run-compare-matrix-pick">
                    {teams.filter(team => !team.reference).map(team => (
                        <button
                            key={team.teamCapId}
                            type="button"
                            aria-pressed={team.teamCapId === picked?.teamCapId}
                            aria-label={`Show ${team.label}`}
                            className="run-compare-segment"
                            onClick={() => setPick(team.teamCapId)}
                        >
                            <span className="run-compare-swatch" style={{ background: team.colour }} />
                            <TeamLabel row={team} withTitle={false} className="min-w-0" />
                        </button>
                    ))}
                </div>
            )}
            <DataTableShell className="!bg-transparent !border-0 !rounded-none" responsive={{ columns, onResolve, tableOnly: true }}>
                <DataTableHeaderRow>
                    <DataTableHeaderCell width={ZONE_WIDTH}>Zone</DataTableHeaderCell>
                    {teams.map((team, i) => shown[i] && (
                        <DataTableHeaderCell key={team.teamCapId} width={TEAM_WIDTH} align="right">
                            <span className="run-compare-matrix-run normal-case tracking-normal">
                                <span className="run-compare-swatch" style={{ background: team.colour }} />
                                <TeamLabel row={team} withTitle={false} className="min-w-0" />
                                {team.reference && <span className="run-compare-baseline-chip">{BASELINE}</span>}
                            </span>
                        </DataTableHeaderCell>
                    ))}
                </DataTableHeaderRow>
                <tbody>
                    {rows.map(row => (
                        <DataTableRow
                            key={row.key}
                            className={cn('run-compare-matrix-row', row.kind === 'cap' && 'is-group-start is-total', row.cue && row.cue.key === activeCue && 'is-active')}
                            onClick={() => onJump(row.cue, row.atMs)}
                        >
                            <DataTableCell>
                                <button type="button" aria-label={splitAction(row)} className="run-compare-matrix-label">{splitLabel(row)}</button>
                            </DataTableCell>
                            {row.cells.map((cell, i) => shown[i] && (
                                <DataTableCell key={teams[i].teamCapId} align="right">
                                    <SplitCell cell={cell} team={teams[i]} />
                                </DataTableCell>
                            ))}
                        </DataTableRow>
                    ))}
                </tbody>
            </DataTableShell>
        </div>
    )
}

function PairName({ side }: { side: PairSide }) {
    return (
        <span className="run-compare-pair-name">
            <span aria-hidden className="run-compare-swatch" style={{ background: side.colour }} />
            <RunIdentity run={side.run} withTitle={false} />
        </span>
    )
}

function MemberPairs({ pairs }: { pairs: readonly PairSummary[] }) {
    return (
        <section aria-label="Member Pairs" className="run-compare-panel">
            <div className="run-compare-panel-head">
                <h2>Member Pairs</h2>
                <p className="run-compare-legend">Teammates often split up, so each pair opens in its own comparison</p>
            </div>
            <ul aria-label="Member Pairs" className="run-compare-pairs">
                {pairs.map(pair => (
                    <li key={pair.key} className="run-compare-pairs-row">
                        <span className="run-compare-pairs-who">
                            <PairName side={pair.runner} />
                            <span className="text-muted-foreground">vs</span>
                            <PairName side={pair.reference} />
                        </span>
                        <span className={cn('run-compare-pairs-route', pair.route !== 'same' && 'is-apart')}>{pairRouteNote(pair)}</span>
                        <CompareLink runs={[pair.runner.run.capId, pair.reference.run.capId]} className="run-compare-chip run-compare-pairs-open">
                            Compare Pair
                            <ArrowRight aria-hidden className="size-3.5" />
                        </CompareLink>
                    </li>
                ))}
            </ul>
        </section>
    )
}

export default function TeamAnalysis({ analysis, controller, cueSync }: TeamAnalysisProps) {
    const { cue, active } = cueSync
    const onJump = useCallback<Jump>((point, atMs) => {
        if (point) cue(point)
        else controller?.seek(atMs / 1000)
    }, [cue, controller])
    const pairs = useMemo(() => pairSummaries(analysis), [analysis])

    return (
        <section aria-label="Analysis" className="run-compare-analysis">
            <section aria-label="Team Splits" className="run-compare-panel">
                <div className="run-compare-panel-head">
                    <h2>Team Splits</h2>
                    <p className="run-compare-legend">Each zone’s time comes from the team’s first member across it, marked by role</p>
                </div>
                <TeamSplitsTable teams={analysis.teams} rows={analysis.splits} activeCue={active} onJump={onJump} />
            </section>
            {pairs.length > 0 && <MemberPairs pairs={pairs} />}
        </section>
    )
}
