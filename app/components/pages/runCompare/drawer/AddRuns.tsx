import { lazy, useCallback, useMemo, useState } from 'react'
import { Check, ChevronDown, Info, Plus, Search, SlidersHorizontal, Video, VideoOff } from 'lucide-react'
import type { LeaderboardEntry, ReplayVideo } from '@/app/utils/api'
import { LazyModalGate } from '@/app/components/shared/LazyModalGate'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/app/components/ui/dropdown-menu'
import { Spinner } from '@/app/components/ui/spinner'
import { cn } from '@/lib/utils'
import { RunIdentity } from '../analysis/RunIdentity'
import { SIDE_TAGS } from '../model/laneModel'
import {
    activeFilters,
    addRunsEdit,
    addRunsModel,
    DATA_FILTERS,
    listedEntries,
    NO_FILTERS,
    toggleRunEdit,
    VIDEO_FILTERS,
    type AddChip,
    type AddRow,
    type AddRunsFilters,
    type DataFilter,
    type RowVideo,
    type SetChange,
    type TeamColour,
    type VideoFilter,
} from '../model/addRuns'
import type { CompareModel } from '../model/compareModel'
import type { LoadedVideos } from '../model/raceModel'
import { NoteTags, OlderVideoTag, SideTag } from '../stage/Tags'
import { addPicks, togglePick } from '../start/startModel'
import { useMapRuns } from './mapRuns'
import { useRowVideoReads } from './rowVideos'

const CompareHelpModal = lazy(() => import('./CompareHelpModal'))

export const ADD_RUNS_PAGE = 25
export const FILTERS = 'Filters'
export const ABOUT_RUNS = 'About these runs'

const COLOURS: { value: TeamColour; label: string; className?: string }[] = [
    { value: 'any', label: 'Both' },
    { value: 'red', label: SIDE_TAGS[0], className: 'is-red' },
    { value: 'blue', label: SIDE_TAGS[1], className: 'is-blue' },
]

export interface RunSelection {
    picked: readonly string[]
    limit: number
    onPick: (picked: string[]) => void
}

export interface AddRunsProps {
    model: CompareModel
    accessToken: string
    userId: string | null
    onChange?: (change: SetChange) => void
    selection?: RunSelection
}

export function selectionEdits(selection: RunSelection | undefined) {
    if (!selection) return null
    return {
        add: (capIds: readonly string[]) => selection.onPick(addPicks(selection.picked, capIds, selection.limit)),
        toggle: (capId: string) => selection.onPick(togglePick(selection.picked, capId, selection.limit)),
        full: selection.picked.length >= selection.limit,
    }
}

function FilterMenu({ filters, onFilters }: { filters: AddRunsFilters; onFilters: (change: Partial<AddRunsFilters>) => void }) {
    const count = activeFilters(filters)
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" className={cn('run-compare-chip run-compare-filter', count > 0 && 'is-active')}>
                    <SlidersHorizontal className="size-4" />
                    {count > 0 ? `${FILTERS} · ${count}` : FILTERS}
                    <ChevronDown className="size-3.5" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="run-compare-menu">
                <DropdownMenuLabel>Video</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={filters.video} onValueChange={value => onFilters({ video: value as VideoFilter })}>
                    {VIDEO_FILTERS.map(option => (
                        <DropdownMenuRadioItem key={option.value} value={option.value} onSelect={event => event.preventDefault()}>
                            {option.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Run Data</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={filters.data} onValueChange={value => onFilters({ data: value as DataFilter })}>
                    {DATA_FILTERS.map(option => (
                        <DropdownMenuRadioItem key={option.value} value={option.value} onSelect={event => event.preventDefault()}>
                            {option.label}
                        </DropdownMenuRadioItem>
                    ))}
                </DropdownMenuRadioGroup>
                {count > 0 && (
                    <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onSelect={() => onFilters({ video: 'any', data: 'any' })}>Clear Filters</DropdownMenuItem>
                    </>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

export function CompareHelpButton({ label = ABOUT_RUNS, className }: { label?: string; className?: string }) {
    const [open, setOpen] = useState(false)
    return (
        <>
            <button type="button" aria-label={label} aria-haspopup="dialog" className={cn('run-compare-icon-button', className)} onClick={() => setOpen(true)}>
                <Info className="size-4" />
            </button>
            <LazyModalGate open={open}>
                <CompareHelpModal isOpen={open} onClose={() => setOpen(false)} />
            </LazyModalGate>
        </>
    )
}

interface AddRunsControlsProps {
    chips: readonly AddChip[]
    onChip: (chip: AddChip) => void
    filters: AddRunsFilters
    onFilters: (change: Partial<AddRunsFilters>) => void
    mixed: boolean
}

export function AddRunsControls({ chips, onChip, filters, onFilters, mixed }: AddRunsControlsProps) {
    return (
        <>
            <div role="group" aria-label="Quick Add" className="run-compare-chips">
                {chips.map(chip => (
                    <button key={chip.id} type="button" disabled={chip.disabled} className="run-compare-chip" onClick={() => onChip(chip)}>
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
                <span className="run-compare-filter-start">
                    <FilterMenu filters={filters} onFilters={onFilters} />
                    <CompareHelpButton />
                </span>
                {mixed && (
                    <div role="group" aria-label="Side" className="run-compare-segmented is-small">
                        {COLOURS.map(colour => (
                            <button key={colour.value} type="button" aria-pressed={filters.colour === colour.value} className={cn('run-compare-segment', colour.className)} onClick={() => onFilters({ colour: colour.value })}>
                                {colour.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </>
    )
}

export function VideoMark({ video }: { video: RowVideo }) {
    if (video === 'pending') return <span className="run-compare-video-mark" />
    return video === 'video'
        ? <span role="img" aria-label="Has video" className="run-compare-video-mark"><Video aria-hidden className="size-4" /></span>
        : <span role="img" aria-label="No video" className="run-compare-video-mark is-none"><VideoOff aria-hidden className="size-4" /></span>
}

interface ToggleRunProps {
    name: string
    inComparison: boolean
    onToggle: () => void
    selecting?: boolean
    disabled?: boolean
}

export function ToggleRun({ name, inComparison, onToggle, selecting = false, disabled = false }: ToggleRunProps) {
    const action = selecting ? 'Select' : inComparison ? 'Remove' : 'Add'
    return (
        <button
            type="button"
            aria-label={`${action} ${name}`}
            aria-pressed={inComparison}
            disabled={disabled}
            className={cn('run-compare-toggle-run', inComparison && 'is-in', selecting && 'is-select')}
            onClick={onToggle}
        >
            {inComparison ? <Check className="size-4" /> : !selecting && <Plus className="size-4" />}
        </button>
    )
}

interface LeaderboardRowProps {
    row: AddRow
    mixed: boolean
    onToggle: () => void
    selecting: boolean
    full: boolean
}

function LeaderboardRow({ row, mixed, onToggle, selecting, full }: LeaderboardRowProps) {
    const { entry } = row
    const run = { user: entry.user, alias: entry.alias, title: entry.active_title ?? null }
    return (
        <li className={cn('run-compare-add-row', row.inComparison && 'is-in')}>
            <span className="run-compare-rank font-mono tabular-nums">#{row.rank}</span>
            <div className="run-compare-roster-who">
                <RunIdentity run={run} presentation="full" withTitle={false} />
                <span className="run-compare-roster-tags">
                    <SideTag side={row.side} label={mixed && row.side !== null ? SIDE_TAGS[row.side] : null} />
                    <OlderVideoTag shown={row.older} />
                    <NoteTags notes={row.badges} />
                </span>
            </div>
            <span className="run-compare-roster-time font-mono tabular-nums">{row.time}</span>
            <VideoMark video={row.video} />
            <ToggleRun
                name={entry.alias?.trim() || String(entry.user)}
                inComparison={row.inComparison}
                onToggle={onToggle}
                selecting={selecting}
                disabled={full && !row.inComparison}
            />
        </li>
    )
}

function AddRunsList({ model, entries, userId, onChange, selection }: Omit<AddRunsProps, 'accessToken'> & { entries: readonly LeaderboardEntry[] }) {
    const [filters, setFilters] = useState<AddRunsFilters>(NO_FILTERS)
    const [shown, setShown] = useState(ADD_RUNS_PAGE)
    const listed = useMemo(() => listedEntries(entries), [entries])
    const [videos, setVideos] = useState<LoadedVideos>(() => new Map())
    const picked = selection?.picked
    const view = useMemo(() => addRunsModel({ entries: listed, model, videos, userId, filters, picked }), [listed, model, videos, userId, filters, picked])
    const select = selectionEdits(selection)
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
            <AddRunsControls
                chips={view.chips}
                onChip={chip => (select ? select.add(chip.capIds) : onChange?.(addRunsEdit(model, chip.capIds, videos)))}
                filters={filters}
                onFilters={updateFilters}
                mixed={view.mixed}
            />
            {view.rows.length === 0 ? (
                <p className="run-compare-add-empty">
                    {listed.length === 0 ? 'No runs on this map yet' : 'No runs match these filters'}
                </p>
            ) : (
                <ol aria-label="Leaderboard" className="run-compare-roster">
                    {visible.map(row => (
                        <LeaderboardRow
                            key={row.capId}
                            row={row}
                            mixed={view.mixed}
                            onToggle={() => (select ? select.toggle(row.capId) : onChange?.(toggleRunEdit(model, row.capId, videos)))}
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

export function AddRuns({ model, accessToken, userId, onChange, selection }: AddRunsProps) {
    const runs = useMapRuns(model.map, accessToken)
    if (runs.status === 'team') return null
    return (
        <div className="run-compare-add">
            <h3 className="run-compare-section-label">{selection ? 'Select Runs' : 'Add Runs'}</h3>
            {runs.status === 'loading' ? (
                <div className="run-compare-add-empty">
                    <Spinner className="size-4" /> Loading leaderboard…
                </div>
            ) : (
                <AddRunsList model={model} entries={runs.entries} userId={userId} onChange={onChange} selection={selection} />
            )}
        </div>
    )
}
