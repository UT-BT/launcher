import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import { relTime } from '@/app/components/pages/admin/components/controls'
import {
    eventErrorMessage, fetchEventAuditLog, fetchEventScheduleOversight,
    type EventAuditEntry, type ScheduleOversightEntry,
} from '@/app/utils/api'
import { teamLabel } from '../bracket/bracketShared'
import { TeamName } from '../TeamRoster'
import { schedulabilityReason, whoseTurnLabel } from '../schedule/scheduleShared'

const AUDIT_ACTION_LABELS: Record<string, string> = {
    proposal_created: 'proposed a time',
    proposal_withdrawn: 'withdrew their proposal',
    proposal_accepted: 'accepted a time',
}

function auditActionLabel(action: string): string {
    return AUDIT_ACTION_LABELS[action] ?? action
}

export function ScheduleOversightPanel({ accessToken, slug }: { accessToken: string; slug: string }) {
    const [entries, setEntries] = useState<ScheduleOversightEntry[] | null>(null)
    const [loaded, setLoaded] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        try {
            setEntries(await fetchEventScheduleOversight(accessToken, slug))
            setError(null)
        } catch (e) {
            setEntries(null)
            setError(eventErrorMessage(e))
        } finally {
            setLoaded(true)
        }
    }, [accessToken, slug])

    useEffect(() => { void load() }, [load])

    if (!loaded) {
        return <div className="p-6 text-center text-sm text-muted-foreground">Loading schedule…</div>
    }

    if (entries === null) {
        return (
            <div className="p-6 flex flex-col items-center gap-3">
                <ErrorBanner message={error} />
                <Button variant="secondary" onClick={load}>Try again</Button>
            </div>
        )
    }

    if (entries.length === 0) {
        return (
            <div className="p-6 text-center text-sm text-muted-foreground">
                Every match in this event is booked, or not schedulable yet.
            </div>
        )
    }

    const overdue = entries.filter(entry => entry.overdue)
    const rest = entries.filter(entry => !entry.overdue)

    return (
        <div className="flex flex-col gap-5">
            {overdue.length > 0 && (
                <Section title="Overdue" count={overdue.length} accent>
                    {overdue.map(entry => (
                        <OversightCard key={entry.match.id} entry={entry} accessToken={accessToken} slug={slug} />
                    ))}
                </Section>
            )}

            <Section title="Waiting on a time" count={rest.length}>
                {rest.map(entry => (
                    <OversightCard key={entry.match.id} entry={entry} accessToken={accessToken} slug={slug} />
                ))}
            </Section>
        </div>
    )
}

function Section({ title, count, accent, children }: { title: string; count: number; accent?: boolean; children: React.ReactNode }) {
    if (count === 0) return null

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2">
                <h3 className={cn(
                    'text-xs font-bold uppercase tracking-wider',
                    accent ? 'text-amber-300' : 'text-muted-foreground',
                )}>
                    {title}
                </h3>
                <span className="text-[11px] text-muted-foreground tabular-nums">{count}</span>
            </div>
            <div className="flex flex-col gap-2">{children}</div>
        </div>
    )
}

function OversightCard({ entry, accessToken, slug }: { entry: ScheduleOversightEntry; accessToken: string; slug: string }) {
    const { match } = entry
    const [historyOpen, setHistoryOpen] = useState(false)
    const [history, setHistory] = useState<EventAuditEntry[] | null>(null)
    const [historyError, setHistoryError] = useState<string | null>(null)

    const toggleHistory = useCallback(async () => {
        if (historyOpen) {
            setHistoryOpen(false)
            return
        }

        setHistoryOpen(true)

        if (history !== null) return

        try {
            const data = await fetchEventAuditLog(accessToken, slug, { matchId: match.id, limit: 20 })
            setHistory(data.items)
        } catch (e) {
            setHistoryError(eventErrorMessage(e))
        }
    }, [historyOpen, history, accessToken, slug, match.id])

    return (
        <div className={cn(
            'rounded-lg border bg-card/40 p-3 flex flex-col gap-2',
            entry.overdue ? 'border-amber-500/30' : 'border-white/10',
        )}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 text-sm font-medium text-white">
                    {entry.overdue && <AlertTriangle className="size-3.5 shrink-0 text-amber-300" />}
                    <TeamName teamId={match.team_a?.id} className="truncate">
                        {teamLabel(match.team_a, match.slot_a_label)}
                    </TeamName>
                    <span className="text-muted-foreground shrink-0">vs</span>
                    <TeamName teamId={match.team_b?.id} className="truncate">
                        {teamLabel(match.team_b, match.slot_b_label)}
                    </TeamName>
                </div>
                <span className="text-[11px] text-muted-foreground shrink-0">
                    {match.round_label || `Round ${match.round_no}`}
                </span>
            </div>

            {!entry.schedulable ? (
                <p className="text-xs text-muted-foreground">{schedulabilityReason(entry.reason)}</p>
            ) : (
                <p className="text-xs text-muted-foreground">
                    {whoseTurnLabel(entry, null)}
                    {entry.stalled_since && <> · sitting there {relTime(entry.stalled_since)}</>}
                </p>
            )}

            <button
                type="button"
                onClick={toggleHistory}
                className="self-start inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-white transition-colors cursor-pointer"
            >
                {historyOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                History
            </button>

            {historyOpen && (
                <div className="pl-3 border-l border-white/10 flex flex-col gap-1">
                    {historyError && <ErrorBanner message={historyError} />}
                    {history === null && !historyError && (
                        <span className="text-[11px] text-muted-foreground">Loading…</span>
                    )}
                    {history?.length === 0 && (
                        <span className="text-[11px] text-muted-foreground">No history yet.</span>
                    )}
                    {history?.map(item => (
                        <span key={item.id} className="text-[11px] text-muted-foreground">
                            <span className="text-white/80">{item.actor_alias ?? 'Someone'}</span>{' '}
                            {auditActionLabel(item.action)} · {relTime(item.created_at)}
                        </span>
                    ))}
                </div>
            )}
        </div>
    )
}
