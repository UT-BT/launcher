import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExternalLink, Pencil, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
    DataTableEmpty, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { Button } from '@/app/components/ui/button'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { useNavState } from '@/app/components/navigation/useNavState'
import { AdminSelect, type SelectOption } from '@/app/components/pages/admin/components/controls'
import { ErrorBanner, teamInputClass } from '@/app/components/pages/teams/teamsShared'
import { formatSlotTime, useDisplayTimezone } from '@/app/utils/timezone'
import { ROLE_LABELS } from '@/app/utils/roles'
import {
    eventErrorMessage, fetchEventBracket, fetchEventMatchAdmins, fetchEventStreamers, setMatchAdmin, setMatchStreamer,
    type EventBracket, type EventMatchAdmin, type EventStreamer,
} from '@/app/utils/api'
import { Chip, MatchStatusChip } from '../../bracket/bracketShared'
import { matchAdminName, streamerName } from '../../eventsShared'
import { streamerListNote } from '../../streamerRoster'
import { MatchEditorModal } from '../MatchEditorModal'
import { StaffPicker } from '../StaffPicker'
import {
    ALL_STAGES, DEFAULT_MATCHES_FILTER, filterMatchRows, matchRows, matchesSummary, staffChoices, withMatchStaff,
    type MatchRow, type MatchStaffFilter, type MatchStatusFilter, type MatchesFilter,
} from './matchesTable'

type StaffKind = 'streamer' | 'match_admin'

const COLUMNS: ResponsiveColumn[] = [
    { id: 'match', width: '14rem', priority: 70, required: true },
    { id: 'stage', width: '10rem', priority: 40 },
    { id: 'scheduled', width: '9rem', priority: 50 },
    { id: 'status', width: '7rem', priority: 65, required: true },
    { id: 'admin', width: '11rem', priority: 60 },
    { id: 'streamer', width: '11rem', priority: 55 },
    { id: 'actions', width: '12rem', priority: 62, required: true },
]

const STATUS_OPTIONS: SelectOption[] = [
    { value: 'open', label: 'Open matches' },
    { value: 'finished', label: 'Finished matches' },
    { value: 'all', label: 'All matches' },
]

const STAFF_OPTIONS: SelectOption[] = [
    { value: 'all', label: 'Any staffing' },
    { value: 'needs_admin', label: 'Needs a match admin' },
    { value: 'needs_streamer', label: 'Needs a streamer' },
]

const ADMIN_EMPTY_TEXT = 'No staff or event managers found.'
const ADMIN_FAILED_TEXT = 'The match admin list could not be loaded.'

function adminListNote(failed: boolean, loading: boolean): string {
    if (failed) return ADMIN_FAILED_TEXT
    if (loading) return 'Loading match admins…'
    return ADMIN_EMPTY_TEXT
}

const EVENT_MANAGER_BADGE = { label: 'Event Manager', className: 'bg-sky-500/15 border-sky-500/40 text-sky-300' }
const NOT_ELIGIBLE_BADGE = { label: 'Not Eligible', className: 'bg-white/5 text-muted-foreground border-white/10' }

function RoleBadge({ admin }: { admin: EventMatchAdmin }) {
    const badge = ROLE_LABELS[admin.role] ?? (admin.event_manager ? EVENT_MANAGER_BADGE : NOT_ELIGIBLE_BADGE)

    return <Chip className={badge.className}>{badge.label}</Chip>
}

function usePeopleList<T>(load: (token: string, slug: string, signal?: AbortSignal) => Promise<T[]>, accessToken: string, slug: string) {
    const [people, setPeople] = useState<T[] | null>(null)
    const [failed, setFailed] = useState(false)
    const tokenRef = useRef(accessToken)
    tokenRef.current = accessToken

    const reload = useCallback(async (signal?: AbortSignal) => {
        try {
            setPeople(await load(tokenRef.current, slug, signal))
            setFailed(false)
        } catch {
            if (!signal?.aborted) setFailed(true)
        }
    }, [load, slug])

    useEffect(() => {
        const controller = new AbortController()
        void reload(controller.signal)
        return () => controller.abort()
    }, [reload])

    return { people, failed, reload }
}

interface MatchesPanelProps {
    accessToken: string
    slug: string
    bracket: EventBracket | null
    onBracketChange: (bracket: EventBracket) => void
}

export function MatchesPanel({ accessToken, slug, bracket, onBracketChange }: MatchesPanelProps) {
    const { navigate } = useNavigation()
    const timezone = useDisplayTimezone()
    const [filter, setFilter] = useNavState<MatchesFilter>('event.manage.matches.filter', DEFAULT_MATCHES_FILTER)
    const [saving, setSaving] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [editing, setEditing] = useState<MatchRow | null>(null)
    const [resolved, setResolved] = useState<Set<string> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => setResolved(ids), [])
    const isVisible = (id: string) => !resolved || resolved.has(id)
    const visibleCount = COLUMNS.filter(column => isVisible(column.id)).length

    const streamers = usePeopleList<EventStreamer>(fetchEventStreamers, accessToken, slug)
    const admins = usePeopleList<EventMatchAdmin>(fetchEventMatchAdmins, accessToken, slug)

    const allRows = useMemo(() => matchRows(bracket), [bracket])
    const rows = useMemo(() => filterMatchRows(allRows, filter), [allRows, filter])
    const summary = useMemo(() => matchesSummary(allRows), [allRows])
    const stageOptions = useMemo<SelectOption[]>(() => [
        { value: ALL_STAGES, label: 'All stages' },
        ...(bracket?.stages ?? []).map(stage => ({ value: stage.key, label: stage.name })),
    ], [bracket])

    const patchFilter = (patch: Partial<MatchesFilter>) => setFilter({ ...filter, ...patch })

    const refresh = useCallback(async () => {
        try {
            onBracketChange(await fetchEventBracket(accessToken, slug))
        } catch (e) {
            setError(eventErrorMessage(e))
        }
    }, [accessToken, slug, onBracketChange])

    const assign = async (row: MatchRow, kind: StaffKind, userId: string | null) => {
        const matchId = row.match.id
        setSaving(`${matchId}:${kind}`)
        setError(null)
        try {
            const patch = kind === 'streamer'
                ? { streamer: await setMatchStreamer(accessToken, slug, matchId, userId) }
                : { match_admin: await setMatchAdmin(accessToken, slug, matchId, userId) }
            if (bracket) onBracketChange(withMatchStaff(bracket, matchId, patch))
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setSaving(null)
        }
    }

    const adminPicker = (row: MatchRow) => (
        <StaffPicker
            kind="Match admin"
            noneLabel="No match admin"
            current={row.matchAdmin}
            choices={staffChoices(admins.people ?? [], row.matchAdmin)}
            emptyNote={adminListNote(admins.failed, admins.people === null)}
            saving={saving === `${row.match.id}:match_admin`}
            nameOf={matchAdminName}
            badgeOf={admin => <RoleBadge admin={admin} />}
            onOpen={() => { void admins.reload() }}
            onChange={userId => { void assign(row, 'match_admin', userId) }}
        />
    )

    const streamerPicker = (row: MatchRow) => (
        <StaffPicker
            kind="Streamer"
            noneLabel="No streamer"
            current={row.streamer}
            choices={staffChoices(streamers.people ?? [], row.streamer)}
            emptyNote={streamerListNote(streamers.failed, streamers.people === null)}
            saving={saving === `${row.match.id}:streamer`}
            nameOf={streamerName}
            onOpen={() => { void streamers.reload() }}
            onChange={userId => { void assign(row, 'streamer', userId) }}
        />
    )

    const scheduledLabel = (row: MatchRow) => (row.match.scheduled_at ? formatSlotTime(row.match.scheduled_at, timezone) : 'Unscheduled')

    const actions = (row: MatchRow) => (
        <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Button size="sm" variant="outline" onClick={() => setEditing(row)}>
                <Pencil /> Edit
            </Button>
            <Button asChild size="sm" variant="ghost">
                <NavLink
                    view="match-pickban"
                    params={{ eventSlug: slug, matchId: row.match.id }}
                    onActivate={() => navigate('match-pickban', { eventSlug: slug, matchId: row.match.id })}
                >
                    <ExternalLink /> Picks & Bans
                </NavLink>
            </Button>
        </div>
    )

    const emptyMessage = allRows.length === 0 ? 'No matches drawn yet. Draw a stage on the Bracket tab.' : 'No matches fit these filters.'

    const compactRows = rows.length === 0 ? (
        <div role="listitem" className="px-4 py-12 text-center text-sm text-muted-foreground">{emptyMessage}</div>
    ) : rows.map(row => (
        <div key={row.match.id} role="listitem" className="p-3 border-b border-hairline/5 last:border-0 flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
                <MatchTitle row={row} />
                <MatchStatusChip match={row.match} />
            </div>
            <div className="text-xs text-muted-foreground">{row.stageName} · {row.roundLabel} · {scheduledLabel(row)}</div>
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 text-xs text-muted-foreground">
                <span>Match admin</span>
                <span className="min-w-0">{adminPicker(row)}</span>
                <span>Streamer</span>
                <span className="min-w-0">{streamerPicker(row)}</span>
            </div>
            {actions(row)}
        </div>
    ))

    const editingStage = editing ? bracket?.stages.find(stage => stage.key === editing.stageKey) : undefined

    return (
        <section aria-label="Matches" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                    <h2 className="text-sm font-semibold text-foreground">Matches</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Assign a match admin and a streamer to each match, and edit results, times and links.
                    </p>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                    <SummaryPill label="Open" value={summary.open} />
                    <SummaryPill label="Without match admin" value={summary.withoutAdmin} warn={summary.withoutAdmin > 0}
                        onClick={() => patchFilter({ status: 'open', staff: 'needs_admin' })} />
                    <SummaryPill label="Without streamer" value={summary.withoutStreamer}
                        onClick={() => patchFilter({ status: 'open', staff: 'needs_streamer' })} />
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-full sm:w-64">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="search"
                        value={filter.search}
                        onChange={event => patchFilter({ search: event.target.value })}
                        placeholder="Search teams or staff…"
                        aria-label="Search matches"
                        className={cn(teamInputClass, 'h-9 w-full pl-8 py-0')}
                    />
                </div>
                <AdminSelect ariaLabel="Stage" value={filter.stage} options={stageOptions}
                    onChange={stage => patchFilter({ stage })} className="w-full sm:w-44" />
                <AdminSelect ariaLabel="Status" value={filter.status} options={STATUS_OPTIONS}
                    onChange={status => patchFilter({ status: status as MatchStatusFilter })} className="w-full sm:w-44" />
                <AdminSelect ariaLabel="Staffing" value={filter.staff} options={STAFF_OPTIONS}
                    onChange={staff => patchFilter({ staff: staff as MatchStaffFilter })} className="w-full sm:w-48" />
            </div>

            <ErrorBanner message={error} />

            <DataTableShell
                className="!flex-none"
                responsive={{
                    columns: COLUMNS,
                    onResolve: handleResolve,
                    compactContent: compactRows,
                    compactAriaLabel: 'Matches',
                }}
            >
                <DataTableHeaderRow>
                    <DataTableHeaderCell width="14rem">Match</DataTableHeaderCell>
                    {isVisible('stage') && <DataTableHeaderCell width="10rem">Stage / Round</DataTableHeaderCell>}
                    {isVisible('scheduled') && <DataTableHeaderCell width="9rem">Scheduled</DataTableHeaderCell>}
                    <DataTableHeaderCell width="7rem">Status</DataTableHeaderCell>
                    {isVisible('admin') && <DataTableHeaderCell width="11rem">Match Admin</DataTableHeaderCell>}
                    {isVisible('streamer') && <DataTableHeaderCell width="11rem">Streamer</DataTableHeaderCell>}
                    <DataTableHeaderCell align="right" width="12rem">Actions</DataTableHeaderCell>
                </DataTableHeaderRow>
                <tbody>
                    {rows.length === 0 ? (
                        <DataTableEmpty colSpan={visibleCount} message={emptyMessage} />
                    ) : rows.map(row => (
                        <DataTableRow key={row.match.id}>
                            <DataTableCell><MatchTitle row={row} /></DataTableCell>
                            {isVisible('stage') && (
                                <DataTableCell>
                                    <span className="text-foreground truncate block">{row.stageName}</span>
                                    <span className="text-xs text-muted-foreground truncate block">{row.roundLabel}</span>
                                </DataTableCell>
                            )}
                            {isVisible('scheduled') && (
                                <DataTableCell><span className="text-xs text-muted-foreground">{scheduledLabel(row)}</span></DataTableCell>
                            )}
                            <DataTableCell><MatchStatusChip match={row.match} /></DataTableCell>
                            {isVisible('admin') && <DataTableCell>{adminPicker(row)}</DataTableCell>}
                            {isVisible('streamer') && <DataTableCell>{streamerPicker(row)}</DataTableCell>}
                            <DataTableCell align="right">{actions(row)}</DataTableCell>
                        </DataTableRow>
                    ))}
                </tbody>
            </DataTableShell>

            {editing && (
                <MatchEditorModal
                    accessToken={accessToken}
                    slug={slug}
                    match={editing.match}
                    entrants={editingStage?.entrants ?? editing.entrants}
                    drawsAllowed={editing.drawsAllowed}
                    onClose={() => setEditing(null)}
                    onSaved={() => void refresh()}
                />
            )}
        </section>
    )
}

function MatchTitle({ row }: { row: MatchRow }) {
    return (
        <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground truncate">{row.teamAName} vs {row.teamBName}</div>
            {row.score && <div className="text-xs text-muted-foreground tabular-nums">{row.score}</div>}
        </div>
    )
}

function SummaryPill({ label, value, warn, onClick }: { label: string; value: number; warn?: boolean; onClick?: () => void }) {
    const className = cn(
        'rounded-full border px-2.5 py-1 tabular-nums',
        warn ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-hairline/10 bg-card/40 text-muted-foreground',
        onClick && 'cursor-pointer hover:border-hairline/25 transition-colors',
    )

    if (!onClick) return <span className={className}>{label} <b className="font-semibold text-foreground">{value}</b></span>

    return (
        <button type="button" onClick={onClick} className={className}>
            {label} <b className="font-semibold text-foreground">{value}</b>
        </button>
    )
}
