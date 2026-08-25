import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { Modal } from '@/app/components/ui/modal'
import { AdminSelect } from '@/app/components/pages/admin/components/controls'
import { ErrorBanner, teamInputClass } from '@/app/components/pages/teams/teamsShared'
import { MapSearchInput } from '@/app/components/shared/MapSearchInput'
import {
    clearEventMatchResult, deleteEventMatch, eventErrorMessage, fetchEventMatch, linkEventMatchMapCaps,
    setEventMatchResult, updateEventMatch,
    type EventBracketEntrant, type EventMatch, type EventMatchMap, type EventMatchMapInput,
    type EventMatchStatus, type EventSide,
} from '@/app/utils/api'
import {
    Chip, DRAW_STYLE, MATCH_STATUS_LABELS, MATCH_STATUS_STYLES, mapWinnerOf, seriesProgress, sideOf, toIso, toLocalInput,
} from '../bracket/bracketShared'
import { CapLinkPicker } from './CapLinkPicker'
import { Field, SubCard } from './formatFields'

const STATUS_OPTIONS: Array<{ value: EventMatchStatus; label: string }> = [
    { value: 'pending', label: 'Not played' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'live', label: 'Live' },
    { value: 'bye', label: 'Bye' },
    { value: 'cancelled', label: 'Cancelled' },
]

const DERIVED_STATUSES: EventMatchStatus[] = ['complete', 'forfeit']

interface Form {
    teamA: string
    teamB: string
    status: EventMatchStatus
    scheduledAt: string
    streamUrl: string
    notes: string
    published: boolean
}

function formFrom(match: EventMatch): Form {
    return {
        teamA: match.team_a?.id ?? '',
        teamB: match.team_b?.id ?? '',
        status: DERIVED_STATUSES.includes(match.status) ? 'pending' : match.status,
        scheduledAt: toLocalInput(match.scheduled_at),
        streamUrl: match.stream_url ?? '',
        notes: match.notes ?? '',
        published: match.published,
    }
}

function toMapInput(row: EventMatchMap): EventMatchMapInput {
    return {
        ordinal: row.ordinal,
        map: row.map,
        kind: row.kind,
        picked_by: row.picked_by,
        caps_a: row.caps_a,
        caps_b: row.caps_b,
        deaths_a: row.deaths_a,
        deaths_b: row.deaths_b,
        winner_side: row.winner_side,
        started_at: row.started_at,
        ended_at: row.ended_at,
        notes: row.notes,
    }
}

interface MatchEditorModalProps {
    accessToken: string
    slug: string
    match: EventMatch
    entrants: EventBracketEntrant[]
    onClose: () => void
    onSaved: () => void
}

export function MatchEditorModal({ accessToken, slug, match: initial, entrants, onClose, onSaved }: MatchEditorModalProps) {
    const [match, setMatch] = useState(initial)
    const [form, setForm] = useState<Form>(() => formFrom(initial))
    const [maps, setMaps] = useState<EventMatchMap[]>(initial.maps ?? [])
    const [dirty, setDirty] = useState(false)
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const syncFrom = useCallback((fresh: EventMatch) => {
        setMatch(fresh)
        setForm(formFrom(fresh))
        setMaps(fresh.maps ?? [])
        setDirty(false)
    }, [])

    const reload = useCallback(async () => {
        syncFrom(await fetchEventMatch(accessToken, slug, initial.id))
    }, [accessToken, slug, initial.id, syncFrom])

    const mergeFrom = useCallback((fresh: EventMatch, replaceOrdinal?: number) => {
        setMatch(fresh)
        const byOrdinal = new Map((fresh.maps ?? []).map(row => [row.ordinal, row]))
        setMaps(current => current.map(row => {
            const server = byOrdinal.get(row.ordinal)
            if (!server) return row
            return row.ordinal === replaceOrdinal ? server : { ...row, caps: server.caps }
        }))
    }, [])

    const dirtyRef = useRef(dirty)
    dirtyRef.current = dirty

    useEffect(() => {
        void fetchEventMatch(accessToken, slug, initial.id)
            .then(fresh => (dirtyRef.current ? mergeFrom(fresh) : syncFrom(fresh)))
            .catch(() => undefined)
    }, [accessToken, slug, initial.id, syncFrom, mergeFrom])

    const run = async (action: () => Promise<unknown>, message?: string) => {
        setBusy(true)
        setError(null)
        setNotice(null)
        try {
            await action()
            await reload()
            onSaved()
            if (message) setNotice(message)
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setBusy(false)
        }
    }

    const remove = async () => {
        setBusy(true)
        setError(null)
        setNotice(null)
        try {
            await deleteEventMatch(accessToken, slug, match.id)
            onSaved()
            onClose()
        } catch (e) {
            setError(eventErrorMessage(e))
            setBusy(false)
        }
    }

    const setField = <K extends keyof Form>(key: K, value: Form[K]) => {
        setForm(current => ({ ...current, [key]: value }))
        setDirty(true)
    }

    const setRow = (ordinal: number, patch: Partial<EventMatchMap>) => {
        setMaps(current => current.map(row => (row.ordinal === ordinal ? { ...row, ...patch } : row)))
        setDirty(true)
    }

    const teamOptions = [
        { value: '', label: 'Undecided' },
        ...entrants.map(entrant => ({ value: entrant.team_id, label: entrant.team?.name ?? entrant.team_id })),
    ]

    const teamNames: Record<EventSide, string> = {
        a: match.team_a?.name ?? 'Side A',
        b: match.team_b?.name ?? 'Side B',
    }

    const progress = useMemo(() => seriesProgress(match, maps), [match, maps])

    const recordedForfeit = match.status === 'forfeit' ? sideOf(match, match.winner_team_id) : null

    const save = (forfeit?: EventSide) => run(async () => {
        await updateEventMatch(accessToken, slug, match.id, {
            team_a_id: form.teamA || null,
            team_b_id: form.teamB || null,
            status: form.status,
            scheduled_at: toIso(form.scheduledAt),
            stream_url: form.streamUrl.trim() || null,
            notes: form.notes.trim() || null,
            published: form.published,
        })
        await setEventMatchResult(accessToken, slug, match.id, {
            maps: maps.map(toMapInput),
            forfeit_winner: forfeit ?? recordedForfeit,
        })
    }, forfeit ? 'Forfeit recorded.' : 'Saved.')

    const numberField = (
        value: number | null,
        onChange: (value: number | null) => void,
        label: string,
        max?: number,
    ) => (
        <input
            type="number"
            min={0}
            max={max}
            aria-label={label}
            value={value ?? ''}
            disabled={busy}
            onChange={event => {
                if (event.target.value === '') return onChange(null)

                const typed = Math.floor(Number(event.target.value))
                if (Number.isNaN(typed)) return

                onChange(Math.max(0, max === undefined ? typed : Math.min(typed, max)))
            }}
            className={cn(teamInputClass, 'h-8 w-16 py-1 text-xs tabular-nums disabled:opacity-50')}
        />
    )

    return (
        <Modal
            isOpen
            onClose={onClose}
            offsetSidebar
            maxWidth="52rem"
            title={`${teamNames.a} vs ${teamNames.b}`}
            leftAction={match.round_label ? (
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground shrink-0">{match.round_label}</span>
            ) : undefined}
            footer={
                <div className="p-4 border-t border-border bg-muted/50 flex flex-wrap items-center justify-end gap-2">
                    {dirty && <span className="mr-auto text-[11px] text-amber-300">Unsaved changes</span>}
                    <Button variant="outline" onClick={onClose} disabled={busy}>Close</Button>
                    <Button onClick={() => void save()} disabled={busy}>Save match</Button>
                </div>
            }
        >
            <div className="space-y-4">
                <ErrorBanner message={error} />
                {notice && <p className="text-xs text-emerald-300">{notice}</p>}

                <SubCard title="Match">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">Outcome</span>
                        {match.is_draw
                            ? <Chip className={DRAW_STYLE}>Draw</Chip>
                            : <Chip className={MATCH_STATUS_STYLES[match.status]}>{MATCH_STATUS_LABELS[match.status]}</Chip>}
                        {(match.score_a != null || match.score_b != null) && (
                            <span className="text-xs tabular-nums text-muted-foreground">
                                {match.score_a ?? 0} – {match.score_b ?? 0} on maps
                            </span>
                        )}
                        <span className="text-[11px] text-muted-foreground/70">
                            {progress.complete
                                ? 'The result is complete and counts towards the standings.'
                                : match.mode === 'all_maps'
                                    ? `${progress.remaining} more map${progress.remaining === 1 ? '' : 's'} to record — all ${match.best_of} must have a winner before this counts.`
                                    : `${progress.remaining} more map win${progress.remaining === 1 ? '' : 's'} needed to settle the match.`}
                        </span>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Side A">
                            <AdminSelect value={form.teamA} onChange={value => setField('teamA', value)} options={teamOptions}
                                ariaLabel="Side A" className="h-8 w-full text-xs" />
                        </Field>
                        <Field label="Side B">
                            <AdminSelect value={form.teamB} onChange={value => setField('teamB', value)} options={teamOptions}
                                ariaLabel="Side B" className="h-8 w-full text-xs" />
                        </Field>
                        <Field label="State" hint="Final and Forfeit are set by the result below, not here.">
                            <AdminSelect value={form.status} onChange={value => setField('status', value as EventMatchStatus)}
                                options={STATUS_OPTIONS} ariaLabel="State" className="h-8 w-full text-xs" />
                        </Field>
                        <Field label="Scheduled">
                            <input
                                type="datetime-local"
                                value={form.scheduledAt}
                                disabled={busy}
                                onChange={event => setField('scheduledAt', event.target.value)}
                                style={{ colorScheme: 'dark' }}
                                className={cn(teamInputClass, 'w-full h-8 py-1 text-xs disabled:opacity-50')}
                            />
                        </Field>
                        <Field label="Stream" className="sm:col-span-2">
                            <input
                                value={form.streamUrl}
                                disabled={busy}
                                onChange={event => setField('streamUrl', event.target.value)}
                                placeholder="https://…"
                                className={cn(teamInputClass, 'w-full h-8 py-1 text-xs disabled:opacity-50')}
                            />
                        </Field>
                        <Field label="Notes" className="sm:col-span-2">
                            <input
                                value={form.notes}
                                disabled={busy}
                                onChange={event => setField('notes', event.target.value)}
                                className={cn(teamInputClass, 'w-full h-8 py-1 text-xs disabled:opacity-50')}
                            />
                        </Field>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={form.published}
                            disabled={busy}
                            onChange={event => setField('published', event.target.checked)}
                            style={{ colorScheme: 'dark' }}
                            className="size-3.5 accent-accent-500 cursor-pointer"
                        />
                        <span className="text-xs text-foreground">Show this match on the public bracket</span>
                    </label>
                </SubCard>

                <SubCard
                    title={match.mode === 'all_maps'
                        ? `Maps — all ${match.best_of} played, first to ${match.caps_to_win} caps (a level series is a draw)`
                        : `Maps — best of ${match.best_of}, first to ${match.caps_to_win} caps`}
                    action={
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                                setMaps(current => [...current, {
                                    id: `new-${current.length}`,
                                    ordinal: current.length ? Math.max(...current.map(row => row.ordinal)) + 1 : 0,
                                    map: null, kind: 'normal', picked_by: null,
                                    caps_a: null, caps_b: null, deaths_a: null, deaths_b: null,
                                    winner_side: null, started_at: null, ended_at: null, notes: null, caps: [],
                                }])
                                setDirty(true)
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-accent-300 hover:text-accent-200 cursor-pointer disabled:opacity-40"
                        >
                            <Plus className="size-3" /> Add map
                        </button>
                    }
                >
                    {maps.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">No map slots on this match.</p>
                    ) : maps.map(row => {
                        const winner = mapWinnerOf(row, match.caps_to_win)
                        const undecided = !winner && (row.caps_a != null || row.caps_b != null)

                        return (
                            <div key={row.ordinal} className="rounded-md border border-white/5 bg-card/20 p-2.5 space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">Map {row.ordinal + 1}</span>
                                    <MapSearchInput
                                        accessToken={accessToken}
                                        value={row.map}
                                        disabled={busy}
                                        onChange={value => setRow(row.ordinal, { map: value })}
                                        className="flex-1 min-w-[10rem]"
                                    />
                                    <select
                                        value={row.kind}
                                        disabled={busy}
                                        aria-label={`Map ${row.ordinal + 1} kind`}
                                        onChange={event => setRow(row.ordinal, { kind: event.target.value as EventMatchMap['kind'] })}
                                        style={{ colorScheme: 'dark' }}
                                        className={cn(teamInputClass, 'h-8 w-24 py-1 text-xs shrink-0')}
                                    >
                                        <option value="normal">Normal</option>
                                        <option value="decider">Decider</option>
                                    </select>
                                    <select
                                        value={row.picked_by ?? ''}
                                        disabled={busy}
                                        aria-label={`Map ${row.ordinal + 1} picked by`}
                                        onChange={event => setRow(row.ordinal, { picked_by: (event.target.value || null) as EventSide | null })}
                                        style={{ colorScheme: 'dark' }}
                                        className={cn(teamInputClass, 'h-8 w-28 py-1 text-xs shrink-0')}
                                    >
                                        <option value="">No pick</option>
                                        <option value="a">Picked by {teamNames.a}</option>
                                        <option value="b">Picked by {teamNames.b}</option>
                                    </select>
                                    <button
                                        type="button"
                                        title="Remove map"
                                        disabled={busy}
                                        onClick={() => {
                                            setMaps(current => current.filter(entry => entry.ordinal !== row.ordinal))
                                            setDirty(true)
                                        }}
                                        className="p-1 rounded-md text-red-300 hover:bg-red-500/10 cursor-pointer disabled:opacity-40 shrink-0"
                                    >
                                        <Trash2 className="size-3.5" />
                                    </button>
                                </div>

                                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Caps</span>
                                        {numberField(row.caps_a, value => setRow(row.ordinal, { caps_a: value }), `Map ${row.ordinal + 1} caps for ${teamNames.a}`, match.caps_to_win)}
                                        <span className="text-muted-foreground">–</span>
                                        {numberField(row.caps_b, value => setRow(row.ordinal, { caps_b: value }), `Map ${row.ordinal + 1} caps for ${teamNames.b}`, match.caps_to_win)}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Deaths</span>
                                        {numberField(row.deaths_a, value => setRow(row.ordinal, { deaths_a: value }), `Map ${row.ordinal + 1} deaths for ${teamNames.a}`)}
                                        <span className="text-muted-foreground">–</span>
                                        {numberField(row.deaths_b, value => setRow(row.ordinal, { deaths_b: value }), `Map ${row.ordinal + 1} deaths for ${teamNames.b}`)}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Won by</span>
                                        <select
                                            value={row.winner_side ?? ''}
                                            disabled={busy}
                                            aria-label={`Map ${row.ordinal + 1} winner`}
                                            onChange={event => setRow(row.ordinal, { winner_side: (event.target.value || null) as EventSide | null })}
                                            style={{ colorScheme: 'dark' }}
                                            className={cn(
                                                teamInputClass, 'h-8 w-40 py-1 text-xs',
                                                undecided && 'border-amber-500/50',
                                            )}
                                        >
                                            <option value="">
                                                {winner ? `From caps — ${teamNames[winner]}` : 'From caps — undecided'}
                                            </option>
                                            <option value="a">{teamNames.a}</option>
                                            <option value="b">{teamNames.b}</option>
                                        </select>
                                    </div>
                                </div>

                                {undecided && (
                                    <p className="text-[11px] text-amber-300">
                                        Nobody reached {match.caps_to_win} caps. If the time limit ended this map,
                                        pick the winner above — it still counts as a full map win.
                                    </p>
                                )}

                                {match.team_a && match.team_b && !row.id.startsWith('new-') && (
                                    <CapLinkPicker
                                        accessToken={accessToken}
                                        slug={slug}
                                        matchId={match.id}
                                        row={row}
                                        teamNames={teamNames}
                                        disabled={busy}
                                        onLink={async caps => {
                                            await linkEventMatchMapCaps(accessToken, slug, match.id, row.ordinal, caps)
                                            const fresh = await fetchEventMatch(accessToken, slug, match.id)
                                            if (dirtyRef.current) mergeFrom(fresh, row.ordinal)
                                            else syncFrom(fresh)
                                            onSaved()
                                        }}
                                    />
                                )}
                            </div>
                        )
                    })}
                </SubCard>

                <SubCard title="Other outcomes">
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => void save('a')} disabled={busy || !match.team_a}>
                            {teamNames.a} wins by forfeit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void save('b')} disabled={busy || !match.team_b}>
                            {teamNames.b} wins by forfeit
                        </Button>
                        <Button size="sm" variant="outline"
                            onClick={() => void run(() => clearEventMatchResult(accessToken, slug, match.id), 'Result cleared.')}
                            disabled={busy}>
                            Clear result
                        </Button>
                    </div>
                </SubCard>

                <div className="flex justify-end">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void remove()}
                        className="text-[11px] text-red-300 hover:underline cursor-pointer disabled:opacity-40"
                    >
                        Delete this match
                    </button>
                </div>
            </div>
        </Modal>
    )
}
