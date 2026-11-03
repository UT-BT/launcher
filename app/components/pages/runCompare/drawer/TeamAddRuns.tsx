import { useCallback, useMemo, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import type { ReplayVideo, TeamLeaderboardEntry } from '@/app/utils/api'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { Spinner } from '@/app/components/ui/spinner'
import { cn } from '@/lib/utils'
import { IN_COMPARISON, NO_FILTERS, type AddRunsFilters } from '../model/addRuns'
import type { LoadedVideos } from '../model/raceModel'
import { addTeamRunsEdit, listedTeamEntries, teamAddRunsModel, toggleTeamRunEdit, type TeamAddRow } from '../model/teamAddRuns'
import { ADD_RUNS_PAGE, AddRunsControls, type AddRunsProps } from './AddRuns'
import { useRowVideoReads } from './rowVideos'
import { useTeamMapRuns } from './teamMapRuns'

function TeamLeaderboardRow({ row, onToggle }: { row: TeamAddRow; onToggle: () => void }) {
    return (
        <li className={cn('run-compare-roster-row run-compare-add-team', row.inComparison && 'is-in')}>
            <div className="run-compare-add-line">
                <div className="run-compare-roster-badges">
                    <span className="font-mono tabular-nums text-foreground">{row.time}</span>
                    {row.reference && <span className="run-compare-badge is-reference">REF</span>}
                    {row.inComparison && <span className="run-compare-badge">{IN_COMPARISON}</span>}
                </div>
                <button type="button" className="run-compare-roster-action" onClick={onToggle}>
                    {row.inComparison ? <Minus className="size-4" /> : <Plus className="size-4" />}
                    <span>{row.inComparison ? 'Remove' : 'Add'}</span>
                </button>
            </div>
            <ul aria-label="Members" className="run-compare-add-members">
                {row.members.map(({ capId, member, badges }) => (
                    <li key={capId} className="run-compare-add-member">
                        <PlayerInfo userId={member.user} alias={member.alias} title={member.active_title ?? null} size="sm" interactive={false} className="min-w-0" />
                        <div className="run-compare-roster-badges">
                            {badges.map(badge => <span key={badge} className="run-compare-badge">{badge}</span>)}
                        </div>
                    </li>
                ))}
            </ul>
        </li>
    )
}

function TeamAddRunsList({ model, entries, userId, onChange }: Omit<AddRunsProps, 'accessToken'> & { entries: readonly TeamLeaderboardEntry[] }) {
    const [filters, setFilters] = useState<AddRunsFilters>(NO_FILTERS)
    const [shown, setShown] = useState(ADD_RUNS_PAGE)
    const listed = useMemo(() => listedTeamEntries(entries), [entries])
    const [videos, setVideos] = useState<LoadedVideos>(() => new Map())
    const view = useMemo(() => teamAddRunsModel({ entries: listed, model, videos, userId, filters }), [listed, model, videos, userId, filters])
    const visible = view.rows.slice(0, shown)
    const order = useMemo(
        () => [...visible.flatMap(row => row.members.map(member => member.capId)), ...listed.flatMap(entry => entry.members.map(member => member.cap_id))],
        [visible, listed],
    )
    const onRead = useCallback((capId: string, video: ReplayVideo | null) => {
        setVideos(previous => new Map(previous).set(capId, video))
    }, [])
    useRowVideoReads(order, onRead)

    const updateFilters = (change: Partial<AddRunsFilters>) => {
        setFilters(previous => ({ ...previous, ...change }))
        setShown(ADD_RUNS_PAGE)
    }

    return (
        <>
            <AddRunsControls chips={view.chips} onChip={chip => onChange(addTeamRunsEdit(model, chip.capIds, listed, videos))} filters={filters} onFilters={updateFilters} />
            {view.rows.length === 0 ? (
                <p className="run-compare-add-empty">
                    {listed.length === 0 ? 'No team runs on this map yet' : 'No team runs match these filters'}
                </p>
            ) : (
                <ol aria-label="Leaderboard" className="run-compare-roster">
                    {visible.map(row => (
                        <TeamLeaderboardRow key={row.teamCapId} row={row} onToggle={() => onChange(toggleTeamRunEdit(model, row.teamCapId, listed, videos))} />
                    ))}
                </ol>
            )}
            {view.rows.length > shown && (
                <button type="button" className="run-compare-roster-action run-compare-show-more" onClick={() => setShown(shown + ADD_RUNS_PAGE)}>
                    Show More
                </button>
            )}
        </>
    )
}

export function TeamAddRuns({ model, accessToken, userId, onChange }: AddRunsProps) {
    const runs = useTeamMapRuns(model.map, accessToken)
    return (
        <div className="run-compare-add">
            <h3 className="text-sm font-semibold text-foreground">Add Team Runs</h3>
            {runs.status === 'loading' ? (
                <div className="run-compare-add-empty">
                    <Spinner className="size-4" /> Loading leaderboard…
                </div>
            ) : (
                <TeamAddRunsList model={model} entries={runs.entries} userId={userId} onChange={onChange} />
            )}
        </div>
    )
}
