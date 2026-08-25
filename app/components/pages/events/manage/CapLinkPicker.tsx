import { useCallback, useState } from 'react'
import { Link2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { teamInputClass } from '@/app/components/pages/teams/teamsShared'
import {
    eventErrorMessage, fetchEventCapCandidates,
    type EventCapCandidate, type EventMatchMap, type EventSide,
} from '@/app/utils/api'
import { formatSeconds } from '../bracket/bracketShared'

interface CapLinkPickerProps {
    accessToken: string
    slug: string
    matchId: string
    row: EventMatchMap
    teamNames: Record<EventSide, string>
    disabled?: boolean
    onLink: (caps: Array<{ cap_id: string; side: EventSide }>) => Promise<void>
}

/**
 * Finds the real caps behind a played map. The counts stay editable afterwards —
 * this is a convenience, not the source of truth.
 */
export function CapLinkPicker({ accessToken, slug, matchId, row, teamNames, disabled, onLink }: CapLinkPickerProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [candidates, setCandidates] = useState<EventCapCandidate[]>([])
    const [picked, setPicked] = useState<Record<string, EventSide>>({})
    const [from, setFrom] = useState(row.started_at ?? '')
    const [to, setTo] = useState(row.ended_at ?? '')

    const search = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const rows = await fetchEventCapCandidates(accessToken, slug, matchId, {
                map: row.map,
                from: from || null,
                to: to || null,
            })
            setCandidates(rows)
            setPicked(Object.fromEntries(
                rows.filter(cap => cap.side).map(cap => [cap.cap_id, cap.side as EventSide]),
            ))
            setOpen(true)
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setLoading(false)
        }
    }, [accessToken, slug, matchId, row.map, from, to])

    const linked = new Set((row.caps ?? []).map(cap => cap.cap_id))
    const counts = Object.values(picked).reduce(
        (totals, side) => ({ ...totals, [side]: totals[side] + 1 }),
        { a: 0, b: 0 } as Record<EventSide, number>,
    )

    const confirm = async () => {
        setSaving(true)
        setError(null)
        try {
            await onLink(Object.entries(picked).map(([cap_id, side]) => ({ cap_id, side })))
            setOpen(false)
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="space-y-2">
            <div className="flex flex-wrap items-end gap-2">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    From
                    <input
                        type="datetime-local"
                        value={from}
                        disabled={disabled}
                        onChange={event => setFrom(event.target.value)}
                        style={{ colorScheme: 'dark' }}
                        className={cn(teamInputClass, 'block mt-1 h-8 py-1 text-xs')}
                    />
                </label>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    To
                    <input
                        type="datetime-local"
                        value={to}
                        disabled={disabled}
                        onChange={event => setTo(event.target.value)}
                        style={{ colorScheme: 'dark' }}
                        className={cn(teamInputClass, 'block mt-1 h-8 py-1 text-xs')}
                    />
                </label>
                <button
                    type="button"
                    onClick={() => void search()}
                    disabled={disabled || loading}
                    className="h-8 px-3 rounded-md border border-white/10 bg-card/50 text-xs text-foreground hover:border-white/20 transition-colors cursor-pointer disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                    {loading ? <Loader2 className="size-3.5 animate-spin" /> : <Link2 className="size-3.5" />}
                    Find caps
                </button>
                {linked.size > 0 && (
                    <span className="text-[11px] text-emerald-300">{linked.size} cap{linked.size === 1 ? '' : 's'} linked</span>
                )}
            </div>

            {error && <p className="text-[11px] text-red-300">{error}</p>}

            {open && (
                <div className="rounded-lg border border-white/10 bg-card/40 p-2.5 space-y-2">
                    {candidates.length === 0 ? (
                        <p className="text-[11px] text-muted-foreground">
                            No caps by these players on that map in that window.
                        </p>
                    ) : (
                        <>
                            <div className="max-h-56 overflow-auto divide-y divide-white/5">
                                {candidates.map(cap => {
                                    const side = picked[cap.cap_id]

                                    return (
                                        <div key={cap.cap_id} className="flex items-center gap-2 py-1.5 min-w-0">
                                            <input
                                                type="checkbox"
                                                checked={!!side}
                                                style={{ colorScheme: 'dark' }}
                                                onChange={event => setPicked(current => {
                                                    const next = { ...current }
                                                    if (event.target.checked) next[cap.cap_id] = cap.side ?? 'a'
                                                    else delete next[cap.cap_id]
                                                    return next
                                                })}
                                                className="size-3.5 accent-accent-500 cursor-pointer shrink-0"
                                            />
                                            <PlayerInfo userId={cap.user} alias={cap.alias} size="sm" />
                                            <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted-foreground">
                                                {formatSeconds(cap.cap_time_seconds)}
                                            </span>
                                            <select
                                                value={side ?? ''}
                                                disabled={!side}
                                                onChange={event => setPicked(current => ({ ...current, [cap.cap_id]: event.target.value as EventSide }))}
                                                style={{ colorScheme: 'dark' }}
                                                className={cn(teamInputClass, 'h-7 w-24 py-0 text-[11px] shrink-0 disabled:opacity-40')}
                                            >
                                                <option value="a">{teamNames.a}</option>
                                                <option value="b">{teamNames.b}</option>
                                            </select>
                                        </div>
                                    )
                                })}
                            </div>

                            <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                                <span className="text-[11px] text-muted-foreground tabular-nums">
                                    {counts.a} – {counts.b}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => void confirm()}
                                    disabled={saving}
                                    className="ml-auto h-7 px-2.5 rounded-md border border-emerald-500/30 text-emerald-300 text-[11px] hover:bg-emerald-500/10 transition-colors cursor-pointer disabled:opacity-40"
                                >
                                    {saving ? 'Linking…' : 'Link and fill counts'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOpen(false)}
                                    className="h-7 px-2.5 rounded-md border border-white/10 text-muted-foreground text-[11px] hover:text-white cursor-pointer"
                                >
                                    Cancel
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
