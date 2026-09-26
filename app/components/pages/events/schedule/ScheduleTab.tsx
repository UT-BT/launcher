import { useEffect, useState, type ReactNode } from 'react'
import { CalendarClock, ExternalLink, Radio, Swords } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/app/components/ui/button'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { ErrorBanner } from '@/app/components/pages/teams/teamsShared'
import { buildMatchLinks } from '@/app/components/navigation/matchLinks'
import { useCopyFeedback } from '@/app/hooks/useCopyFeedback'
import { useDisplayTimezone } from '@/app/utils/timezone'
import { eventErrorMessage, type EventMatch, type MyMatchEntry, type MyPickBanSession, type ScheduleEntry } from '@/app/utils/api'
import { Chip, MATCH_STATUS_STYLES, opponentNameOf, teamLabel } from '../bracket/bracketShared'
import { streamerName } from '../eventsShared'
import { TeamName } from '../TeamRoster'
import { PickBanJoinBanner } from '../pickban/components/PickBanJoinBanner'
import { PickBanLink } from '../pickban/components/PickBanLink'
import { PickBanStatusChip } from '../pickban/components/PickBanStatusChip'
import { formatSlotTime, proposerName, schedulabilityReason, whoseTurnLabel } from './scheduleShared'
import {
    matchRoundLabel, matchTimeLabel, pickBanCallToAction, scheduleSections,
    type PickBanCallToAction, type ScheduleViewer,
} from './scheduleSections'

const REFRESH_MS = 30_000

interface ScheduleTabProps {
    myTeamId: string | null
    entries: ScheduleEntry[] | null
    myMatches: MyMatchEntry[] | null
    loaded: boolean
    viewer: ScheduleViewer
    onRefresh: () => void
    onOpenPicker: (matchId: string) => void
    eventSlug: string
    pickBanSession?: MyPickBanSession | null
}

export function ScheduleTab({
    myTeamId, entries, myMatches, loaded, viewer, onRefresh, onOpenPicker, eventSlug, pickBanSession = null,
}: ScheduleTabProps) {
    const [copyError, setCopyError] = useState<string | null>(null)
    const { copiedKey, copy } = useCopyFeedback(e => setCopyError(eventErrorMessage(e)))

    useEffect(() => {
        onRefresh()
        const timer = setInterval(onRefresh, REFRESH_MS)
        return () => clearInterval(timer)
    }, [onRefresh])

    if (!loaded) {
        return <div className="p-6 text-center text-sm text-muted-foreground">Loading schedule…</div>
    }

    if (entries === null && myMatches === null) {
        return (
            <div className="p-6 flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">The schedule could not be loaded.</p>
                <Button variant="secondary" onClick={onRefresh}>Try Again</Button>
            </div>
        )
    }

    const sections = scheduleSections(entries, myMatches, viewer)
    const playerEmpty = sections.upcoming.length === 0 && sections.needsTime.length === 0

    return (
        <div className="flex flex-col gap-5">
            <ErrorBanner message={copyError} />

            {sections.showPlayer && playerEmpty && entries !== null && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                    {myTeamId
                        ? 'Your team has no booked matches and none waiting on a time right now.'
                        : 'No matches are waiting on a time right now.'}
                </div>
            )}

            {sections.upcoming.length > 0 && (
                <ScheduleSection title="Upcoming" count={sections.upcoming.length}>
                    {sections.upcoming.map(entry => (
                        <BookedMatchCard key={entry.match.id} entry={entry} myTeamId={myTeamId} eventSlug={eventSlug} pickBanSession={pickBanSession} />
                    ))}
                </ScheduleSection>
            )}

            {sections.showPlayer && entries === null && (
                <ScheduleSection title="Needs a time">
                    <p className="text-xs text-muted-foreground">The matches waiting on a time could not be loaded.</p>
                    <div>
                        <Button size="sm" variant="secondary" onClick={onRefresh}>Try Again</Button>
                    </div>
                </ScheduleSection>
            )}

            {sections.needsTime.length > 0 && (
                <ScheduleSection title="Needs a time" count={sections.needsTime.length}>
                    {sections.needsTime.map(entry => (
                        <ScheduleMatchCard key={entry.match.id} entry={entry} myTeamId={myTeamId} onOpenPicker={onOpenPicker}
                            eventSlug={eventSlug} pickBanSession={pickBanSession} />
                    ))}
                </ScheduleSection>
            )}

            {sections.showStreaming && (
                <ScheduleSection
                    title="Streaming"
                    count={myMatches === null ? undefined : sections.streaming.length}
                    blurb="Each stream link is a 1920×1080 browser source for OBS."
                >
                    {myMatches === null ? (
                        <p className="text-xs text-muted-foreground">Your assigned matches could not be loaded.</p>
                    ) : sections.streaming.length === 0 ? (
                        <p className="text-xs text-muted-foreground">No matches assigned to you yet.</p>
                    ) : sections.streaming.map(entry => (
                        <StreamingMatchCard key={entry.match.id} entry={entry} eventSlug={eventSlug}
                            copied={copiedKey === entry.match.id} onCopy={copy} />
                    ))}
                </ScheduleSection>
            )}
        </div>
    )
}

function ScheduleSection({ title, count, blurb, children }: {
    title: string
    count?: number
    blurb?: string
    children: ReactNode
}) {
    return (
        <section aria-label={title} className="flex flex-col gap-2">
            <div className="flex items-baseline gap-2 flex-wrap">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{title}</h3>
                {count !== undefined && <span className="text-[11px] text-muted-foreground tabular-nums">{count}</span>}
                {blurb && <span className="text-[11px] text-muted-foreground">{blurb}</span>}
            </div>
            {children}
        </section>
    )
}

function MatchHeading({ match, stageName }: { match: EventMatch; stageName?: string }) {
    return (
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
                {stageName ? `${stageName} · ${matchRoundLabel(match)}` : matchRoundLabel(match)}
            </span>
        </div>
    )
}

function MatchTime({ match }: { match: EventMatch }) {
    const timezone = useDisplayTimezone()
    const label = matchTimeLabel(match, timezone)

    if (match.status === 'live') return <Chip className={MATCH_STATUS_STYLES.live}>{label}</Chip>

    return (
        <span className="text-xs text-foreground flex items-center gap-1.5">
            <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" />
            {label}
        </span>
    )
}

function PickBanPageLink({ eventSlug, matchId, action }: {
    eventSlug: string
    matchId: string
    action: Exclude<PickBanCallToAction, 'join'>
}) {
    if (action === 'view') {
        return (
            <Button asChild size="sm" variant="outline">
                <PickBanLink eventSlug={eventSlug} matchId={matchId}>
                    <Swords /> View Picks & Bans
                </PickBanLink>
            </Button>
        )
    }

    return (
        <PickBanLink
            eventSlug={eventSlug}
            matchId={matchId}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
            <Swords className="size-3.5" /> Visit Picks & Bans Page
        </PickBanLink>
    )
}

function BookedMatchCard({ entry, myTeamId, eventSlug, pickBanSession }: {
    entry: MyMatchEntry
    myTeamId: string | null
    eventSlug: string
    pickBanSession: MyPickBanSession | null
}) {
    const { match, streamer } = entry
    const action = pickBanCallToAction(match, pickBanSession)

    return (
        <div className={cn(
            'rounded-lg border bg-card/40 p-3 flex flex-col gap-2',
            action === 'join' ? 'border-emerald-500/40' : 'border-white/10',
        )}>
            <MatchHeading match={match} stageName={entry.stage.name} />

            {action === 'join' && <PickBanJoinBanner eventSlug={eventSlug} matchId={match.id} opponent={opponentNameOf(match, myTeamId)} />}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <MatchTime match={match} />
                {streamer && (
                    <span className="flex items-center gap-1.5 min-w-0 text-xs text-muted-foreground">
                        Streamed by
                        <PlayerInfo userId={streamer.id} alias={streamerName(streamer)} size="sm" />
                    </span>
                )}
                {action !== 'join' && (
                    <span className="ml-auto">
                        <PickBanPageLink eventSlug={eventSlug} matchId={match.id} action={action} />
                    </span>
                )}
            </div>
        </div>
    )
}

function StreamingMatchCard({ entry, eventSlug, copied, onCopy }: {
    entry: MyMatchEntry
    eventSlug: string
    copied: boolean
    onCopy: (key: string, text: string) => void
}) {
    const { match } = entry
    const { streamLink } = buildMatchLinks(eventSlug, match.id)

    return (
        <div className="rounded-lg border border-white/10 bg-card/40 p-3 flex flex-col gap-2">
            <MatchHeading match={match} stageName={entry.stage.name} />

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <MatchTime match={match} />
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    State:
                    <PickBanStatusChip status={match.pick_ban_status} />
                </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
                <Button size="sm" variant="secondary" onClick={() => onCopy(match.id, streamLink)}>
                    <Radio /> {copied ? 'Copied' : 'Copy Stream Link'}
                </Button>
                <Button asChild size="sm" variant="outline">
                    <PickBanLink eventSlug={eventSlug} matchId={match.id}>
                        <ExternalLink /> Open Picks & Bans
                    </PickBanLink>
                </Button>
            </div>
        </div>
    )
}

function ScheduleMatchCard({ entry, myTeamId, onOpenPicker, eventSlug, pickBanSession }: {
    entry: ScheduleEntry
    myTeamId: string | null
    onOpenPicker: (matchId: string) => void
    eventSlug: string
    pickBanSession: MyPickBanSession | null
}) {
    const timezone = useDisplayTimezone()
    const { match } = entry
    const myTurn = !!entry.proposal && !!myTeamId && entry.whose_turn === myTeamId
    const action = pickBanCallToAction(match, pickBanSession)

    return (
        <div className={cn(
            'rounded-lg border bg-card/40 p-3 flex flex-col gap-2',
            action === 'join' ? 'border-emerald-500/40' : myTurn ? 'border-accent-500/40' : 'border-white/10',
        )}>
            <MatchHeading match={match} />

            {action === 'join' && <PickBanJoinBanner eventSlug={eventSlug} matchId={match.id} opponent={opponentNameOf(match, myTeamId)} />}

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
                </>
            )}

            {(entry.schedulable || action !== 'join') && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    {entry.schedulable && (
                        <Button size="sm" variant="secondary" onClick={() => onOpenPicker(match.id)}>
                            {!entry.proposal ? 'Propose a time' : myTurn ? 'Respond to offer' : 'Manage your offer'}
                        </Button>
                    )}
                    {action !== 'join' && (
                        <span className="ml-auto">
                            <PickBanPageLink eventSlug={eventSlug} matchId={match.id} action={action} />
                        </span>
                    )}
                </div>
            )}
        </div>
    )
}
