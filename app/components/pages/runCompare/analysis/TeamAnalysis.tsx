import { useCallback, useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
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
import type { DifferentRouteCard, PairSide, RouteAnchorRow, TeamAnalysisModel, TeamSplitCell, TeamSplitRow } from '../model/teamAnalysisModel'
import type { TeamRow } from '../model/teamModel'
import { SPAWN_ANCHOR } from '../model/teamVersus'
import type { PlaybackController } from '../playback/playbackController'
import { TeamLabel } from '../stage/TeamLabel'
import type { CueSync } from '../transport/useCueSync'
import { runName, RunIdentity } from './RunIdentity'
import { AnalysisPanels } from './RunAnalysis'
import './analysis.css'

const ZONE_COLUMN = 'zone'
const ZONE_WIDTH = '4rem'
const TEAM_WIDTH = '6rem'
const ANCHOR_WIDTH = '4rem'
const TIME_WIDTH = '4.5rem'

interface TeamAnalysisProps {
    analysis: TeamAnalysisModel
    controller: PlaybackController | null
    cueSync: CueSync
    onSpeedRun: (capId: string) => void
}

type Jump = (cue: CuePoint | null, atMs: number) => void

function SplitCell({ cell }: { cell: TeamSplitCell | null }) {
    if (!cell) return null
    return (
        <span className="run-compare-team-split">
            <span className="run-compare-matrix-value font-mono tabular-nums">
                <span className="text-foreground">{cell.time}</span>
                {cell.delta && <span className={TONE_TEXT[cell.delta.tone]}>{cell.delta.label}</span>}
            </span>
            {cell.member && <RunIdentity run={cell.member} />}
        </span>
    )
}

function splitAction(row: TeamSplitRow): string {
    return row.cue ? `Cue ${row.label}` : 'Seek to the cap'
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
                <div role="group" aria-label="Splits team" className="run-compare-matrix-pick">
                    {teams.filter(team => !team.reference).map(team => (
                        <button
                            key={team.teamCapId}
                            type="button"
                            aria-pressed={team.teamCapId === picked?.teamCapId}
                            aria-label={`Show ${team.label}`}
                            className="run-compare-speed-run"
                            onClick={() => setPick(team.teamCapId)}
                        >
                            <span className="run-compare-swatch" style={{ background: team.colour }} />
                            <TeamLabel row={team} className="min-w-0" />
                        </button>
                    ))}
                </div>
            )}
            <DataTableShell className="!bg-transparent !border-0 !rounded-none" responsive={{ columns, onResolve, tableOnly: true }}>
                <DataTableHeaderRow>
                    <DataTableHeaderCell width={ZONE_WIDTH}>Zone</DataTableHeaderCell>
                    {teams.map((team, i) => shown[i] && (
                        <DataTableHeaderCell key={team.teamCapId} width={TEAM_WIDTH} align="right">
                            <span className="run-compare-matrix-run">
                                <span className="run-compare-swatch" style={{ background: team.colour }} />
                                <TeamLabel row={team} className="min-w-0" />
                                {team.reference && <span className="run-compare-badge is-reference">REF</span>}
                            </span>
                        </DataTableHeaderCell>
                    ))}
                </DataTableHeaderRow>
                <tbody>
                    {rows.map(row => (
                        <DataTableRow
                            key={row.key}
                            className={cn('run-compare-matrix-row', row.kind === 'cap' && 'is-group-start', row.cue && row.cue.key === activeCue && 'is-active')}
                            onClick={() => onJump(row.cue, row.atMs)}
                        >
                            <DataTableCell>
                                <button type="button" aria-label={splitAction(row)} className="run-compare-matrix-label run-compare-team-zone">{row.label}</button>
                            </DataTableCell>
                            {row.cells.map((cell, i) => shown[i] && (
                                <DataTableCell key={teams[i].teamCapId} align="right">
                                    <SplitCell cell={cell} />
                                </DataTableCell>
                            ))}
                        </DataTableRow>
                    ))}
                </tbody>
            </DataTableShell>
        </div>
    )
}

function PairTitle({ runner, reference }: { runner: PairSide; reference: PairSide }) {
    return (
        <span className="run-compare-pair-title">
            <span className="run-compare-swatch" style={{ background: runner.colour }} />
            <RunIdentity run={runner.run} />
            <span className="text-muted-foreground">vs</span>
            <span className="run-compare-swatch" style={{ background: reference.colour }} />
            <RunIdentity run={reference.run} />
        </span>
    )
}

function pairLabel(runner: PairSide, reference: PairSide): string {
    return `${runName(runner.run)} vs ${runName(reference.run)}`
}

function anchorAction(anchor: RouteAnchorRow): string {
    return anchor.label === SPAWN_ANCHOR ? 'Seek to spawn' : `Cue ${anchor.label}`
}

function RouteCard({ card, activeCue, onJump }: { card: DifferentRouteCard; activeCue: string | null; onJump: Jump }) {
    const columns = useMemo<ResponsiveColumn[]>(() => [
        { id: 'anchor', width: ANCHOR_WIDTH, required: true, tier: 'essential', label: 'Anchor' },
        { id: 'runner', width: TIME_WIDTH, required: true, tier: 'essential', label: runName(card.runner.run) },
        { id: 'reference', width: TIME_WIDTH, required: true, tier: 'essential', label: runName(card.reference.run) },
        { id: 'gap', width: TIME_WIDTH, required: true, tier: 'essential', label: 'Δ' },
    ], [card.runner.run, card.reference.run])

    return (
        <section aria-label={`Different Route: ${pairLabel(card.runner, card.reference)}`} className="run-compare-panel">
            <h2>Different Route</h2>
            <PairTitle runner={card.runner} reference={card.reference} />
            <DataTableShell className="!bg-transparent !border-0 !rounded-none" responsive={{ columns, tableOnly: true }}>
                <DataTableHeaderRow>
                    <DataTableHeaderCell width={ANCHOR_WIDTH}>Anchor</DataTableHeaderCell>
                    <DataTableHeaderCell width={TIME_WIDTH} align="right"><RunIdentity run={card.runner.run} className="justify-end" /></DataTableHeaderCell>
                    <DataTableHeaderCell width={TIME_WIDTH} align="right"><RunIdentity run={card.reference.run} className="justify-end" /></DataTableHeaderCell>
                    <DataTableHeaderCell width={TIME_WIDTH} align="right">Δ</DataTableHeaderCell>
                </DataTableHeaderRow>
                <tbody>
                    {card.anchors.map(anchor => (
                        <DataTableRow
                            key={anchor.key}
                            className={cn('run-compare-matrix-row', anchor.cue && anchor.cue.key === activeCue && 'is-active')}
                            onClick={() => onJump(anchor.cue, anchor.atMs)}
                        >
                            <DataTableCell>
                                <button type="button" aria-label={anchorAction(anchor)} className="run-compare-matrix-label run-compare-team-zone">{anchor.label}</button>
                            </DataTableCell>
                            <DataTableCell align="right"><span className="font-mono tabular-nums text-foreground">{anchor.runner}</span></DataTableCell>
                            <DataTableCell align="right"><span className="font-mono tabular-nums text-foreground">{anchor.reference}</span></DataTableCell>
                            <DataTableCell align="right"><span className={cn('font-mono tabular-nums', TONE_TEXT[anchor.gap.tone])}>{anchor.gap.label}</span></DataTableCell>
                        </DataTableRow>
                    ))}
                </tbody>
            </DataTableShell>
        </section>
    )
}

export default function TeamAnalysis({ analysis, controller, cueSync, onSpeedRun }: TeamAnalysisProps) {
    const { cue, active } = cueSync
    const onJump = useCallback<Jump>((point, atMs) => {
        if (point) cue(point)
        else controller?.seek(atMs / 1000)
    }, [cue, controller])

    return (
        <section aria-label="Analysis" className="run-compare-analysis">
            <section aria-label="Team Splits" className="run-compare-panel">
                <h2>Team Splits</h2>
                <TeamSplitsTable teams={analysis.teams} rows={analysis.splits} activeCue={active} onJump={onJump} />
                <p className="run-compare-legend">Under each time, the team&apos;s first member across, and on Cap its last</p>
            </section>
            {analysis.pairs.map(pair => (
                <section key={pair.key} aria-label={pairLabel(pair.runner, pair.reference)} className="run-compare-pair">
                    <h2><PairTitle runner={pair.runner} reference={pair.reference} /></h2>
                    <AnalysisPanels analysis={pair.analysis} controller={controller} cueSync={cueSync} onSpeedRun={onSpeedRun} heading="h3" />
                </section>
            ))}
            {analysis.routes.map(card => <RouteCard key={card.key} card={card} activeCue={active} onJump={onJump} />)}
        </section>
    )
}
