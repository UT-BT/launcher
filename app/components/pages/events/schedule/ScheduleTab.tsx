import { useEffect } from 'react'
import { CalendarClock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useDisplayTimezone } from '@/app/utils/timezone'
import type { MyPickBanSession, ScheduleEntry } from '@/app/utils/api'
import { teamLabel } from '../bracket/bracketShared'
import { TeamName } from '../TeamRoster'
import { formatSlotTime, proposerName, schedulabilityReason, whoseTurnLabel } from './scheduleShared'

const REFRESH_MS = 30_000

interface ScheduleTabProps {
    myTeamId: string | null
    entries: ScheduleEntry[] | null
    loaded: boolean
    onRefresh: () => void
    onOpenPicker: (matchId: string) => void
    eventSlug: string
    pickBanSession?: MyPickBanSession | null
}

export function ScheduleTab({ myTeamId, entries, loaded, onRefresh, onOpenPicker, eventSlug, pickBanSession = null }: ScheduleTabProps) {
    useEffect(() => {
        onRefresh()
        const timer = setInterval(onRefresh, REFRESH_MS)
        return () => clearInterval(timer)
    }, [onRefresh])

    if (!loaded) {
        return <div className="p-6 text-center text-sm text-muted-foreground">Loading schedule…</div>
    }

    if (entries === null) {
        return (
            <div className="p-6 flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">The schedule could not be loaded.</p>
                <Button variant="secondary" onClick={onRefresh}>Try again</Button>
            </div>
        )
    }

    if (entries.length === 0) {
        return (
            <div className="p-6 text-center text-sm text-muted-foreground">
                {myTeamId
                    ? 'Your team has no matches waiting on a time right now.'
                    : 'No matches are waiting on a time right now.'}
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-2">
            {entries.map(entry => (
                <ScheduleMatchCard key={entry.match.id} entry={entry} myTeamId={myTeamId} onOpenPicker={onOpenPicker}
                    eventSlug={eventSlug} pickBanOpen={pickBanSession?.match_id === entry.match.id} />
            ))}
        </div>
    )
}

function ScheduleMatchCard({ entry, myTeamId, onOpenPicker, eventSlug, pickBanOpen }: {
    entry: ScheduleEntry
    myTeamId: string | null
    onOpenPicker: (matchId: string) => void
    eventSlug: string
    pickBanOpen: boolean
}) {
    const timezone = useDisplayTimezone()
    const { navigate } = useNavigation()
    const { match } = entry
    const myTurn = !!entry.proposal && !!myTeamId && entry.whose_turn === myTeamId

    return (
        <div className={cn(
            'rounded-lg border bg-card/40 p-3 flex flex-col gap-2',
            pickBanOpen ? 'border-emerald-500/40' : myTurn ? 'border-accent-500/40' : 'border-white/10',
        )}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0 text-sm font-medium text-white">
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

            {pickBanOpen && (
                <NavLink
                    view="match-pickban"
                    params={{ eventSlug, matchId: match.id }}
                    onActivate={() => navigate('match-pickban', { eventSlug, matchId: match.id })}
                    className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-xs cursor-pointer hover:bg-emerald-500/15 transition-colors"
                >
                    <span className="relative flex size-1.5 shrink-0">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                    </span>
                    <span className="text-foreground font-medium">Pick/Ban open – Join</span>
                </NavLink>
            )}

            {!entry.schedulable ? (
                <p className="text-xs text-muted-foreground">{schedulabilityReason(entry.reason)}</p>
            ) : (
                <>
                    <p className={cn('text-xs flex items-center gap-1.5', myTurn ? 'text-accent-300 font-medium' : 'text-muted-foreground')}>
                        <CalendarClock className="size-3.5 shrink-0" />
                        {whoseTurnLabel(entry, myTeamId)}
                    </p>

                    {entry.proposal && (
                        <div className="flex flex-col gap-1">
                            <span className="text-[11px] text-muted-foreground">
                                {proposerName(entry)} proposed{entry.proposal.note ? `: "${entry.proposal.note}"` : ''}
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                                {entry.proposal.slots.map((slot, index) => (
                                    <span
                                        key={index}
                                        className={cn(
                                            'text-[11px] px-2 py-1 rounded border tabular-nums',
                                            slot.expired
                                                ? 'border-white/5 bg-white/5 text-muted-foreground/60 line-through'
                                                : 'border-white/10 bg-white/5 text-white/80',
                                        )}
                                    >
                                        {formatSlotTime(slot.starts_at, timezone)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    <div>
                        <Button size="sm" variant="secondary" onClick={() => onOpenPicker(match.id)}>
                            {!entry.proposal ? 'Propose a time' : myTurn ? 'Respond to offer' : 'Manage your offer'}
                        </Button>
                    </div>
                </>
            )}
        </div>
    )
}
