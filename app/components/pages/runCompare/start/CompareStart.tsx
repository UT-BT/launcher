import { useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowLeftRight, ArrowRight, History, Pencil, Search, Trophy, X, type LucideIcon } from 'lucide-react'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { useNavState } from '@/app/components/navigation/useNavState'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { Spinner } from '@/app/components/ui/spinner'
import { displayMapName } from '@/app/utils/format'
import { RunIdentity } from '../analysis/RunIdentity'
import { AddRuns, CompareHelpButton, type RunSelection } from '../drawer/AddRuns'
import { useMapRuns } from '../drawer/mapRuns'
import { TeamAddRuns } from '../drawer/TeamAddRuns'
import type { CompareModel } from '../model/compareModel'
import { formatRaceTime } from '../model/raceModel'
import { MAX_TEAM_RUNS } from '../model/teamModel'
import { MAX_COMPARE_RUNS } from '../url/compareUrl'
import { RECENT_NAME_MAX, recentLabel, useRecentCompares, type RecentCompare, type RecentCompares } from './recentCompares'
import { useLatestRecords, useMapSearch, type MapSearch } from './startData'
import { mapQuery, pickedQuery, RECORDS_SHOWN, searchTermOf, type MapPick, type RecordPick } from './startModel'
import './compareStart.css'

export const PICK_A_MAP = 'Pick a Map'
export const LATEST_RECORDS = 'Latest World Records'
export const RECENT_COMPARISONS = 'Recent Comparisons'
export const CHANGE_MAP = 'Change Map'
export const HOW_IT_WORKS = 'How it works'

interface CompareStartProps {
    model: CompareModel
    accessToken: string
    userId: string | null
}

function MapResult({ map, onPick }: { map: MapPick; onPick: (map: string) => void }) {
    return (
        <li>
            <button type="button" className="compare-start-result" onClick={() => onPick(map.name)}>
                <MapThumbnail mapName={map.name} version={map.version} alt="" className="compare-start-result-thumb" />
                <span className="compare-start-result-name">{displayMapName(map.name)}</span>
                {map.team && <span className="run-compare-note">{map.team}</span>}
            </button>
        </li>
    )
}

function MapResults({ found, term, onPick }: { found: MapSearch; term: string | null; onPick: (map: string) => void }) {
    if (found.status === 'idle') return null
    if (found.status === 'searching') {
        return <p className="compare-start-empty"><Spinner className="size-4" /> Searching…</p>
    }
    if (found.maps.length === 0) return <p className="compare-start-empty">No maps match “{term}”</p>
    return (
        <ul aria-label="Maps" className="compare-start-results">
            {found.maps.map(map => <MapResult key={map.name} map={map} onPick={onPick} />)}
        </ul>
    )
}

function RecordCard({ record, onPick }: { record: RecordPick; onPick: (map: string) => void }) {
    return (
        <li>
            <button type="button" className="compare-start-card" onClick={() => onPick(record.map)}>
                <MapThumbnail mapName={record.map} size="card" alt="" className="compare-start-card-thumb" />
                <span className="compare-start-card-body">
                    <span className="compare-start-card-top">
                        <span className="compare-start-card-name">{displayMapName(record.map)}</span>
                        {record.team && <span className="run-compare-note">{record.team}</span>}
                    </span>
                    <span className="compare-start-card-meta">
                        <span className="compare-start-holders">
                            {record.holders.map(holder => <RunIdentity key={holder.user} run={holder} withTitle={false} />)}
                            {record.more > 0 && <span className="text-muted-foreground">+{record.more}</span>}
                        </span>
                        <span className="compare-start-time font-mono tabular-nums">{formatRaceTime(record.seconds)}</span>
                    </span>
                </span>
            </button>
        </li>
    )
}

function RecordCards({ records, onPick }: { records: RecordPick[] | null; onPick: (map: string) => void }) {
    const [shown, setShown] = useState(RECORDS_SHOWN)
    if (records === null) return <p className="compare-start-empty"><Spinner className="size-4" /> Loading records…</p>
    if (records.length === 0) return <p className="compare-start-empty">No recent records to show</p>
    return (
        <>
            <ul aria-label={LATEST_RECORDS} className="compare-start-cards">
                {records.slice(0, shown).map(record => <RecordCard key={record.map} record={record} onPick={onPick} />)}
            </ul>
            {records.length > shown && (
                <button type="button" className="run-compare-chip compare-start-more" onClick={() => setShown(shown + RECORDS_SHOWN)}>
                    Show More Records
                </button>
            )}
        </>
    )
}

function RecentName({ entry, onSave, onCancel }: { entry: RecentCompare; onSave: (name: string) => void; onCancel: () => void }) {
    const [draft, setDraft] = useState(entry.name ?? '')
    const onKey = (event: KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') onSave(draft)
        if (event.key === 'Escape') onCancel()
    }
    return (
        <input
            autoFocus
            aria-label="Comparison name"
            placeholder={recentLabel({ ...entry, name: null }, displayMapName(entry.map))}
            maxLength={RECENT_NAME_MAX}
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={onKey}
            onBlur={() => onSave(draft)}
            className="compare-start-rename"
        />
    )
}

function RecentTile({ entry, recent, onOpen }: { entry: RecentCompare; recent: RecentCompares; onOpen: (query: string) => void }) {
    const [editing, setEditing] = useState(false)
    const mapName = displayMapName(entry.map)
    const label = recentLabel(entry, mapName)
    const meta = `${mapName} · ${entry.runs} ${entry.team ? 'team runs' : 'runs'}`
    return (
        <li className="compare-start-recent-item">
            {editing ? (
                <div className="compare-start-result is-recent is-editing">
                    <MapThumbnail mapName={entry.map} alt="" className="compare-start-result-thumb" />
                    <span className="compare-start-recent-text">
                        <RecentName
                            entry={entry}
                            onSave={name => {
                                recent.rename(entry.key, name)
                                setEditing(false)
                            }}
                            onCancel={() => setEditing(false)}
                        />
                        <span className="compare-start-recent-meta">{meta}</span>
                    </span>
                </div>
            ) : (
                <button type="button" className="compare-start-result is-recent" onClick={() => onOpen(entry.query)}>
                    <MapThumbnail mapName={entry.map} alt="" className="compare-start-result-thumb" />
                    <span className="compare-start-recent-text">
                        <span className="compare-start-result-name">{label}</span>
                        <span className="compare-start-recent-meta">{entry.name ? `${entry.title} · ${entry.runs} ${entry.team ? 'team runs' : 'runs'}` : meta}</span>
                    </span>
                </button>
            )}
            {!editing && (
                <span className="compare-start-recent-actions">
                    <button type="button" aria-label={`Rename ${label}`} className="run-compare-icon-button" onClick={() => setEditing(true)}>
                        <Pencil className="size-3.5" />
                    </button>
                    <button type="button" aria-label={`Remove ${label}`} className="run-compare-icon-button" onClick={() => recent.remove(entry.key)}>
                        <X className="size-4" />
                    </button>
                </span>
            )}
        </li>
    )
}

function SectionHead({ id, icon: Icon, title, children }: { id: string; icon: LucideIcon; title: string; children?: ReactNode }) {
    return (
        <div className="compare-start-section-head">
            <Icon aria-hidden className="size-4 text-muted-foreground" />
            <h2 id={id} className="compare-start-title">{title}</h2>
            {children}
        </div>
    )
}

function MapStep({ accessToken }: { accessToken: string }) {
    const { navigate } = useNavigation()
    const [search, setSearch] = useState('')
    const term = searchTermOf(search)
    const found = useMapSearch(term, accessToken)
    const records = useLatestRecords(accessToken)
    const recent = useRecentCompares()
    const pick = (map: string) => navigate('run-compare', { compare: mapQuery(map) })
    const open = (query: string) => navigate('run-compare', { compare: query })

    return (
        <div className="compare-start">
            <section aria-labelledby="compare-start-maps" className="compare-start-hero">
                <div className="compare-start-hero-head">
                    <h2 id="compare-start-maps" className="compare-start-hero-title">{PICK_A_MAP}</h2>
                    <CompareHelpButton label={HOW_IT_WORKS} className="compare-start-help" />
                </div>
                <div className="run-compare-search-field compare-start-search">
                    <Search className="run-compare-search-icon" />
                    <input
                        type="search"
                        aria-label="Search Maps"
                        placeholder="Search maps"
                        value={search}
                        onChange={event => setSearch(event.target.value)}
                        className="run-compare-search"
                    />
                </div>
                <MapResults found={found} term={term} onPick={pick} />
            </section>
            {recent.list.length > 0 && (
                <section aria-labelledby="compare-start-recent" className="compare-start-section">
                    <SectionHead id="compare-start-recent" icon={History} title={RECENT_COMPARISONS}>
                        <button type="button" className="compare-start-clear" onClick={recent.clear}>Clear All</button>
                    </SectionHead>
                    <ul aria-label={RECENT_COMPARISONS} className="compare-start-recent">
                        {recent.list.map(entry => <RecentTile key={entry.key} entry={entry} recent={recent} onOpen={open} />)}
                    </ul>
                </section>
            )}
            <section aria-labelledby="compare-start-records" className="compare-start-section">
                <SectionHead id="compare-start-records" icon={Trophy} title={LATEST_RECORDS} />
                <RecordCards records={records} onPick={pick} />
            </section>
        </div>
    )
}

function SelectionTray({ picked, limit, team, onClear, onCompare }: { picked: number; limit: number; team: boolean; onClear: () => void; onCompare: () => void }) {
    const noun = team ? 'team runs' : 'runs'
    return (
        <div role="region" aria-label="Selected Runs" className="compare-start-tray">
            <span aria-live="polite" className="compare-start-tray-count">
                {picked === 0 ? `Select up to ${limit} ${noun} to compare` : `${picked} of ${limit} ${noun} selected`}
            </span>
            {picked > 0 && <button type="button" className="compare-start-clear" onClick={onClear}>Clear</button>}
            <button type="button" disabled={picked === 0} className="compare-start-go" onClick={onCompare}>
                Compare
                <ArrowRight className="size-4" />
            </button>
        </div>
    )
}

function RunsStep({ model, map, accessToken, userId }: CompareStartProps & { map: string }) {
    const { navigate } = useNavigation()
    const runs = useMapRuns(map, accessToken)
    const [stored, setPicked] = useNavState<string[]>('compare.picked', [])
    const team = runs.status === 'team'
    const limit = team ? MAX_TEAM_RUNS : MAX_COMPARE_RUNS
    const picked = stored.slice(0, limit)
    const selection: RunSelection = { picked, limit, onPick: setPicked }
    return (
        <div className="compare-start is-runs">
            <section aria-label="Map" className="compare-start-map">
                <MapThumbnail mapName={map} size="card" alt="" className="compare-start-map-thumb" />
                <div className="compare-start-map-text">
                    <h2 className="compare-start-title">Pick Runs</h2>
                    <p className="compare-start-lead">Select the runs you want to watch, then press Compare. You can add more later.</p>
                </div>
                <button type="button" className="run-compare-header-button compare-start-change" onClick={() => navigate('run-compare', {})}>
                    <ArrowLeftRight className="size-4" />
                    <span>{CHANGE_MAP}</span>
                </button>
            </section>
            <section aria-label="Map Runs" className="compare-start-board">
                {team
                    ? <TeamAddRuns model={model} accessToken={accessToken} userId={userId} selection={selection} />
                    : <AddRuns model={model} accessToken={accessToken} userId={userId} selection={selection} />}
                <SelectionTray
                    picked={picked.length}
                    limit={limit}
                    team={team}
                    onClear={() => setPicked([])}
                    onCompare={() => navigate('run-compare', { compare: pickedQuery(picked) })}
                />
            </section>
        </div>
    )
}

export default function CompareStart(props: CompareStartProps) {
    const { map } = props.model
    return map ? <RunsStep {...props} map={map} /> : <MapStep accessToken={props.accessToken} />
}
