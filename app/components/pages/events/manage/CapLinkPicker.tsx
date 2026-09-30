import { useCallback, useState } from 'react'
import { Link2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { teamInputClass } from '@/app/components/pages/teams/teamsShared'
import {
    eventErrorMessage, fetchEventCapCandidates,
    type EventCapCandidate, type EventMatchMap, type EventSide,
} from '@/app/utils/api'
import { Chip, formatMatchTime, formatSeconds, toIso, toLocalInput } from '../bracket/bracketShared'
import { candidateKey, defaultPicks, linkedCaps, tallyPicks, type CapLinkPicks } from './capLinkRuns'

const COMPLETE_STYLE = 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
const INCOMPLETE_STYLE = 'bg-amber-500/15 text-amber-300 border-amber-500/30'

interface CapLinkPickerProps {
    accessToken: string
    slug: string
    matchId: string
    row: EventMatchMap
    teamNames: Record<EventSide, string>
    disabled?: boolean
    onLink: (caps: Array<{ cap_id: string; side: EventSide }>) => Promise<void>
}

export function CapLinkPicker({ accessToken, slug, matchId, row, teamNames, disabled, onLink }: CapLinkPickerProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [candidates, setCandidates] = useState<EventCapCandidate[]>([])
    const [picked, setPicked] = useState<CapLinkPicks>({})
    const [from, setFrom] = useState(() => toLocalInput(row.started_at))
    const [to, setTo] = useState(() => toLocalInput(row.ended_at))

    const search = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const rows = await fetchEventCapCandidates(accessToken, slug, matchId, {
                map: row.map,
                from: toIso(from),
                to: toIso(to),
            })
            setCandidates(rows)
            setPicked(defaultPicks(rows))
            setOpen(true)
        } catch (e) {
            setError(eventErrorMessage(e))
        } finally {
            setLoading(false)
        }
    }, [accessToken, slug, matchId, row.map, from, to])

    const linked = new Set((row.caps ?? []).map(cap => cap.cap_id))
    const counts = tallyPicks(candidates, picked)

    const confirm = async () => {
        setSaving(true)
        setError(null)
        try {
            await onLink(linkedCaps(candidates, picked))
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
                                {candidates.map(candidate => {
                                    const key = candidateKey(candidate)
                                    const side = candidate.complete ? picked[key] : undefined

                                    return (
                                        <div key={key} className="flex flex-wrap items-center gap-2 py-1.5 min-w-0">
                                            <input
                                                type="checkbox"
                                                checked={!!side}
                                                disabled={!candidate.complete}
                                                style={{ colorScheme: 'dark' }}
                                                onChange={event => setPicked(current => {
                                                    const next = { ...current }
                                                    if (event.target.checked) next[key] = candidate.side ?? 'a'
                                                    else delete next[key]
                                                    return next
                                                })}
                                                className="size-3.5 accent-accent-500 cursor-pointer shrink-0 disabled:cursor-not-allowed disabled:opacity-40"
                                            />
                                            <div className="flex flex-1 min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                                                {candidate.members.map(member => (
                                                    <span key={member.cap_id} className="inline-flex min-w-0 items-center gap-1.5">
                                                        <PlayerInfo userId={member.user} alias={member.alias} size="sm" />
                                                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                                                            {formatSeconds(member.cap_time_seconds)}
                                                        </span>
                                                    </span>
                                                ))}
                                            </div>
                                            <span className="ml-auto inline-flex shrink-0 items-center gap-2">
                                                {candidate.complete && (
                                                    <span className="text-[11px] tabular-nums text-muted-foreground">
                                                        {formatMatchTime(candidate.completed_at)}
                                                    </span>
                                                )}
                                                <Chip className={candidate.complete ? COMPLETE_STYLE : INCOMPLETE_STYLE}>
                                                    {candidate.complete ? 'Complete' : 'Incomplete'}
                                                </Chip>
                                            </span>
                                            <select
                                                value={side ?? ''}
                                                disabled={!side}
                                                onChange={event => setPicked(current => ({ ...current, [key]: event.target.value as EventSide }))}
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
