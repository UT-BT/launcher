import { useCallback, useMemo, useState } from 'react'
import { Minus, Plus, Search } from 'lucide-react'
import type { LeaderboardEntry, ReplayVideo } from '@/app/utils/api'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { Spinner } from '@/app/components/ui/spinner'
import { cn } from '@/lib/utils'
import { addRunsEdit, addRunsModel, listedEntries, NO_FILTERS, toggleRunEdit, type AddChip, type AddRow, type AddRunsFilters, type SetChange, type TeamColour } from '../model/addRuns'
import type { CompareModel } from '../model/compareModel'
import type { LoadedVideos } from '../model/raceModel'
import { useMapRuns } from './mapRuns'
import { useRowVideoReads } from './rowVideos'

export const ADD_RUNS_PAGE = 25

const COLOURS: { value: TeamColour; label: string }[] = [
    { value: 'any', label: 'Any side' },
    { value: 'red', label: 'Red' },
    { value: 'blue', label: 'Blue' },
]

export interface AddRunsProps {
    model: CompareModel
    accessToken: string
    userId: string | null
    onChange: (change: SetChange) => void
}

function FilterToggle({ pressed, onPress, children }: { pressed: boolean; onPress: () => void; children: string }) {
    return (
        <button type="button" aria-pressed={pressed} className="run-compare-roster-action run-compare-filter" onClick={onPress}>
            {children}
        </button>
    )
}

interface AddRunsControlsProps {
    chips: readonly AddChip[]
    onChip: (chip: AddChip) => void
    filters: AddRunsFilters
    onFilters: (change: Partial<AddRunsFilters>) => void
}

export function AddRunsControls({ chips, onChip, filters, onFilters }: AddRunsControlsProps) {
    return (
        <>
            <div role="group" aria-label="Quick Add" className="run-compare-chips">
                {chips.map(chip => (
                    <button
                        key={chip.id}
                        type="button"
                        disabled={chip.disabled}
                        className="run-compare-roster-action run-compare-chip"
                        onClick={() => onChip(chip)}
                    >
                        {chip.label}
                    </button>
                ))}
            </div>
            <div className="run-compare-search-field">
                <Search className="run-compare-search-icon" />
                <input
                    type="search"
                    aria-label="Search Players"
                    placeholder="Search players"
                    value={filters.search}
                    onChange={event => onFilters({ search: event.target.value })}
                    className="run-compare-search"
                />
            </div>
            <div role="group" aria-label="Filters" className="run-compare-filters">
                <FilterToggle pressed={filters.hasVideo} onPress={() => onFilters({ hasVideo: !filters.hasVideo })}>Has video</FilterToggle>
                <FilterToggle pressed={filters.hasReplay} onPress={() => onFilters({ hasReplay: !filters.hasReplay })}>Has replay</FilterToggle>
                <div role="group" aria-label="Team Colour" className="run-compare-filters">
                    {COLOURS.map(colour => (
                        <FilterToggle key={colour.value} pressed={filters.colour === colour.value} onPress={() => onFilters({ colour: colour.value })}>
                            {colour.label}
                        </FilterToggle>
                    ))}
                </div>
            </div>
        </>
    )
}

function LeaderboardRow({ row, onToggle }: { row: AddRow; onToggle: () => void }) {
    const { entry } = row
    return (
        <li className={cn('run-compare-roster-row', row.inComparison && 'is-in')}>
            <div className="run-compare-roster-who run-compare-row">
                <PlayerInfo userId={entry.user} alias={entry.alias} title={entry.active_title ?? null} size="sm" interactive={false} className="min-w-0" />
                <span className="font-mono tabular-nums text-foreground">{row.time}</span>
            </div>
            <div className="run-compare-add-line">
                <div className="run-compare-roster-badges">
                    {row.reference && <span className="run-compare-badge is-reference">REF</span>}
                    {row.badges.map(badge => <span key={badge} className="run-compare-badge">{badge}</span>)}
                </div>
                <button type="button" className="run-compare-roster-action" onClick={onToggle}>
                    {row.inComparison ? <Minus className="size-4" /> : <Plus className="size-4" />}
                    <span>{row.inComparison ? 'Remove' : 'Add'}</span>
                </button>
            </div>
        </li>
    )
}

function AddRunsList({ model, entries, userId, onChange }: Omit<AddRunsProps, 'accessToken'> & { entries: readonly LeaderboardEntry[] }) {
    const [filters, setFilters] = useState<AddRunsFilters>(NO_FILTERS)
    const [shown, setShown] = useState(ADD_RUNS_PAGE)
    const listed = useMemo(() => listedEntries(entries), [entries])
    const [videos, setVideos] = useState<LoadedVideos>(() => new Map())
    const view = useMemo(() => addRunsModel({ entries: listed, model, videos, userId, filters }), [listed, model, videos, userId, filters])
    const visible = view.rows.slice(0, shown)
    const order = useMemo(() => [...visible.map(row => row.capId), ...listed.map(entry => entry.id)], [visible, listed])
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
            <AddRunsControls chips={view.chips} onChip={chip => onChange(addRunsEdit(model, chip.capIds, videos))} filters={filters} onFilters={updateFilters} />
            {view.rows.length === 0 ? (
                <p className="run-compare-add-empty">
                    {listed.length === 0 ? 'No runs on this map yet' : 'No runs match these filters'}
                </p>
            ) : (
                <ol aria-label="Leaderboard" className="run-compare-roster">
                    {visible.map(row => (
                        <LeaderboardRow key={row.capId} row={row} onToggle={() => onChange(toggleRunEdit(model, row.capId, videos))} />
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

export function AddRuns({ model, accessToken, userId, onChange }: AddRunsProps) {
    const runs = useMapRuns(model.map, accessToken)
    if (runs.status === 'team') return null
    return (
        <div className="run-compare-add">
            <h3 className="text-sm font-semibold text-foreground">Add Runs</h3>
            {runs.status === 'loading' ? (
                <div className="run-compare-add-empty">
                    <Spinner className="size-4" /> Loading leaderboard…
                </div>
            ) : (
                <AddRunsList model={model} entries={runs.entries} userId={userId} onChange={onChange} />
            )}
        </div>
    )
}
