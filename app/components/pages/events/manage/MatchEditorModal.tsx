import { useCallback, useEffect, useState } from 'react'
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
import { CapLinkPicker } from './CapLinkPicker'
import { Field, SubCard } from './formatFields'

const STATUS_OPTIONS: Array<{ value: EventMatchStatus; label: string }> = [
    { value: 'pending', label: 'Not played' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'live', label: 'Live' },
    { value: 'complete', label: 'Final' },
    { value: 'bye', label: 'Bye' },
    { value: 'forfeit', label: 'Forfeit' },
    { value: 'cancelled', label: 'Cancelled' },
]

function toLocalInput(value: string | null): string {
    if (!value) return ''
    const date = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function toIso(value: string): string | null {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
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
    const [maps, setMaps] = useState<EventMatchMap[]>(initial.maps ?? [])
    const [busy, setBusy] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [notice, setNotice] = useState<string | null>(null)

    const [teamA, setTeamA] = useState(initial.team_a?.id ?? '')
    const [teamB, setTeamB] = useState(initial.team_b?.id ?? '')
    const [status, setStatus] = useState<EventMatchStatus>(initial.status)
    const [scheduledAt, setScheduledAt] = useState(toLocalInput(initial.scheduled_at))
    const [streamUrl, setStreamUrl] = useState(initial.stream_url ?? '')
    const [notes, setNotes] = useState(initial.notes ?? '')

    const reload = useCallback(async () => {
        const fresh = await fetchEventMatch(accessToken, slug, initial.id)
        setMatch(fresh)
        setMaps(fresh.maps ?? [])
        setStatus(fresh.status)
        return fresh
    }, [accessToken, slug, initial.id])

    useEffect(() => { void reload().catch(() => undefined) }, [reload])

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

    const teamOptions = [
        { value: '', label: 'Undecided' },
        ...entrants.map(entrant => ({ value: entrant.team_id, label: entrant.team?.name ?? entrant.team_id })),
    ]

    const teamNames: Record<EventSide, string> = {
        a: match.team_a?.name ?? 'Side A',
        b: match.team_b?.name ?? 'Side B',
    }

    const setRow = (ordinal: number, patch: Partial<EventMatchMap>) =>
        setMaps(current => current.map(row => (row.ordinal === ordinal ? { ...row, ...patch } : row)))

    const saveDetails = () => run(() => updateEventMatch(accessToken, slug, match.id, {
        team_a_id: teamA || null,
        team_b_id: teamB || null,
        status,
        scheduled_at: toIso(scheduledAt),
        stream_url: streamUrl.trim() || null,
        notes: notes.trim() || null,
    }), 'Match updated.')

    const saveResult = (forfeit?: EventSide) => run(
        () => setEventMatchResult(accessToken, slug, match.id, {
            maps: maps.map(toMapInput),
            forfeit_winner: forfeit ?? null,
        }),
        forfeit ? 'Forfeit recorded.' : 'Result saved.',
    )

    const numberField = (value: number | null, onChange: (value: number | null) => void) => (
        <input
            type="number"
            min={0}
            value={value ?? ''}
            disabled={busy}
            onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
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
                <div className="p-4 border-t border-border bg-muted/50 flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={onClose} disabled={busy}>Close</Button>
                    <Button variant="outline" onClick={() => void run(() => clearEventMatchResult(accessToken, slug, match.id), 'Result cleared.')} disabled={busy}>
                        Clear result
                    </Button>
                    <Button onClick={() => void saveResult()} disabled={busy}>Save result</Button>
                </div>
            }
        >
            <div className="space-y-4">
                <ErrorBanner message={error} />
                {notice && <p className="text-xs text-emerald-300">{notice}</p>}

                <SubCard title="Match">
                    <div className="grid gap-3 sm:grid-cols-2">
                        <Field label="Side A">
                            <AdminSelect value={teamA} onChange={setTeamA} options={teamOptions} ariaLabel="Side A" className="h-8 w-full text-xs" />
                        </Field>
                        <Field label="Side B">
                            <AdminSelect value={teamB} onChange={setTeamB} options={teamOptions} ariaLabel="Side B" className="h-8 w-full text-xs" />
                        </Field>
                        <Field label="Status">
                            <AdminSelect value={status} onChange={value => setStatus(value as EventMatchStatus)} options={STATUS_OPTIONS} ariaLabel="Status" className="h-8 w-full text-xs" />
                        </Field>
                        <Field label="Scheduled">
                            <input
                                type="datetime-local"
                                value={scheduledAt}
                                disabled={busy}
                                onChange={event => setScheduledAt(event.target.value)}
                                style={{ colorScheme: 'dark' }}
                                className={cn(teamInputClass, 'w-full h-8 py-1 text-xs disabled:opacity-50')}
                            />
                        </Field>
                        <Field label="Stream" className="sm:col-span-2">
                            <input
                                value={streamUrl}
                                disabled={busy}
                                onChange={event => setStreamUrl(event.target.value)}
                                placeholder="https://…"
                                className={cn(teamInputClass, 'w-full h-8 py-1 text-xs disabled:opacity-50')}
                            />
                        </Field>
                        <Field label="Notes" className="sm:col-span-2">
                            <input
                                value={notes}
                                disabled={busy}
                                onChange={event => setNotes(event.target.value)}
                                className={cn(teamInputClass, 'w-full h-8 py-1 text-xs disabled:opacity-50')}
                            />
                        </Field>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={saveDetails} disabled={busy}>Save match</Button>
                        <Button size="sm" variant="outline" onClick={() => void saveResult('a')} disabled={busy || !match.team_a}>
                            {teamNames.a} wins by forfeit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void saveResult('b')} disabled={busy || !match.team_b}>
                            {teamNames.b} wins by forfeit
                        </Button>
                    </div>
                </SubCard>

                <SubCard
                    title={match.mode === 'all_maps'
                        ? `Maps — all ${match.best_of} played, first to ${match.caps_to_win} caps (a level series is a draw)`
                        : `Maps — best of ${match.best_of}, first to ${match.caps_to_win} caps`}
                    action={
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() => setMaps(current => [...current, {
                                id: `new-${current.length}`,
                                ordinal: current.length ? Math.max(...current.map(row => row.ordinal)) + 1 : 0,
                                map: null, kind: 'normal', picked_by: null,
                                caps_a: null, caps_b: null, deaths_a: null, deaths_b: null,
                                winner_side: null, started_at: null, ended_at: null, notes: null, caps: [],
                            }])}
                            className="inline-flex items-center gap-1 text-[11px] text-accent-300 hover:text-accent-200 cursor-pointer disabled:opacity-40"
                        >
                            <Plus className="size-3" /> Add map
                        </button>
                    }
                >
                    {maps.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">No map slots on this match.</p>
                    ) : maps.map(row => (
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
                                    onClick={() => setMaps(current => current.filter(entry => entry.ordinal !== row.ordinal))}
                                    className="p-1 rounded-md text-red-300 hover:bg-red-500/10 cursor-pointer disabled:opacity-40 shrink-0"
                                >
                                    <Trash2 className="size-3.5" />
                                </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Caps</span>
                                    {numberField(row.caps_a, value => setRow(row.ordinal, { caps_a: value }))}
                                    <span className="text-muted-foreground">–</span>
                                    {numberField(row.caps_b, value => setRow(row.ordinal, { caps_b: value }))}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Deaths</span>
                                    {numberField(row.deaths_a, value => setRow(row.ordinal, { deaths_a: value }))}
                                    <span className="text-muted-foreground">–</span>
                                    {numberField(row.deaths_b, value => setRow(row.ordinal, { deaths_b: value }))}
                                </div>
                            </div>

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
                                        await reload()
                                        onSaved()
                                    }}
                                />
                            )}
                        </div>
                    ))}
                </SubCard>

                <div className="flex justify-end">
                    <button
                        type="button"
                        disabled={busy}
                        onClick={() => void run(async () => {
                            await deleteEventMatch(accessToken, slug, match.id)
                            onClose()
                        })}
                        className="text-[11px] text-red-300 hover:underline cursor-pointer disabled:opacity-40"
                    >
                        Delete this match
                    </button>
                </div>
            </div>
        </Modal>
    )
}
