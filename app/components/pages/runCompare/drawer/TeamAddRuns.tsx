import { useCallback, useMemo, useState } from 'react'
import type { ReplayVideo, TeamLeaderboardEntry } from '@/app/utils/api'
import { Spinner } from '@/app/components/ui/spinner'
import { cn } from '@/lib/utils'
import { RunIdentity } from '../analysis/RunIdentity'
import { NO_FILTERS, type AddRunsFilters } from '../model/addRuns'
import { SIDE_TAGS } from '../model/laneModel'
import type { LoadedVideos } from '../model/raceModel'
import { addTeamRunsEdit, listedTeamEntries, teamAddRunsModel, toggleTeamRunEdit, type TeamAddRow } from '../model/teamAddRuns'
import { TEAM_JOIN } from '../model/teamModel'
import { NoteTags, OlderVideoTag, SideTag } from '../stage/Tags'
import { ADD_RUNS_PAGE, AddRunsControls, selectionEdits, ToggleRun, VideoMark, type AddRunsProps } from './AddRuns'
import { useRowVideoReads } from './rowVideos'
import { useTeamMapRuns } from './teamMapRuns'

interface TeamLeaderboardRowProps {
    row: TeamAddRow
    mixed: boolean
    onToggle: () => void
    selecting: boolean
    full: boolean
}

function TeamLeaderboardRow({ row, mixed, onToggle, selecting, full }: TeamLeaderboardRowProps) {
    const name = row.members.map(({ member }) => member.alias?.trim() || String(member.user)).join(TEAM_JOIN)
    return (
        <li className={cn('run-compare-add-row is-team', row.inComparison && 'is-in')}>
            <span className="run-compare-rank font-mono tabular-nums">#{row.rank}</span>
            <ul aria-label="Members" className="run-compare-add-members">
                {row.members.map(({ capId, member, video, older, side, badges }) => (
                    <li key={capId} className="run-compare-add-member">
                        <div className="run-compare-roster-who is-inline">
                            <RunIdentity run={{ user: String(member.user), alias: member.alias, title: member.active_title ?? null }} withTitle={false} />
                            <span className="run-compare-roster-tags">
                                <SideTag side={side} label={mixed && side !== null ? SIDE_TAGS[side] : null} />
                                <OlderVideoTag shown={older} />
                                <NoteTags notes={badges} />
                            </span>
                        </div>
                        <VideoMark video={video} />
                    </li>
                ))}
            </ul>
            <span className="run-compare-roster-time font-mono tabular-nums">{row.time}</span>
            <ToggleRun name={name} inComparison={row.inComparison} onToggle={onToggle} selecting={selecting} disabled={full && !row.inComparison} />
        </li>
    )
}

function TeamAddRunsList({ model, entries, userId, onChange, selection }: Omit<AddRunsProps, 'accessToken'> & { entries: readonly TeamLeaderboardEntry[] }) {
    const [filters, setFilters] = useState<AddRunsFilters>(NO_FILTERS)
    const [shown, setShown] = useState(ADD_RUNS_PAGE)
    const listed = useMemo(() => listedTeamEntries(entries), [entries])
    const [videos, setVideos] = useState<LoadedVideos>(() => new Map())
    const picked = selection?.picked
    const view = useMemo(() => teamAddRunsModel({ entries: listed, model, videos, userId, filters, picked }), [listed, model, videos, userId, filters, picked])
    const select = selectionEdits(selection)
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
            <AddRunsControls
                chips={view.chips}
                onChip={chip => (select ? select.add(chip.capIds) : onChange?.(addTeamRunsEdit(model, chip.capIds, listed, videos)))}
                filters={filters}
                onFilters={updateFilters}
                mixed={view.mixed}
            />
            {view.rows.length === 0 ? (
                <p className="run-compare-add-empty">
                    {listed.length === 0 ? 'No team runs on this map yet' : 'No team runs match these filters'}
                </p>
            ) : (
                <ol aria-label="Leaderboard" className="run-compare-roster">
                    {visible.map(row => (
                        <TeamLeaderboardRow
                            key={row.teamCapId}
                            row={row}
                            mixed={view.mixed}
                            onToggle={() => (select ? select.toggle(row.teamCapId) : onChange?.(toggleTeamRunEdit(model, row.teamCapId, listed, videos)))}
                            selecting={select !== null}
                            full={select?.full ?? false}
                        />
                    ))}
                </ol>
            )}
            {view.rows.length > shown && (
                <button type="button" className="run-compare-chip run-compare-show-more" onClick={() => setShown(shown + ADD_RUNS_PAGE)}>
                    Show More
                </button>
            )}
        </>
    )
}

export function TeamAddRuns({ model, accessToken, userId, onChange, selection }: AddRunsProps) {
    const runs = useTeamMapRuns(model.map, accessToken)
    return (
        <div className="run-compare-add">
            <h3 className="run-compare-section-label">{selection ? 'Select Team Runs' : 'Add Team Runs'}</h3>
            {runs.status === 'loading' ? (
                <div className="run-compare-add-empty">
                    <Spinner className="size-4" /> Loading leaderboard…
                </div>
            ) : (
                <TeamAddRunsList model={model} entries={runs.entries} userId={userId} onChange={onChange} selection={selection} />
            )}
        </div>
    )
}
