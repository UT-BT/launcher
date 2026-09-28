import { useMemo } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { openExternal } from '@/app/platform'
import { Button } from '@/app/components/ui/button'
import { useNavState } from '@/app/components/navigation/useNavState'
import { useDisplayTimezone } from '@/app/utils/timezone'
import type { EventBracket, EventMatch } from '@/app/utils/api'
import { Chip, MATCH_STATUS_STYLES, MatchStatusChip, sideOf } from '../bracket/bracketShared'
import { formatCountdown, useNow } from '../predictions/predictionsShared'
import { pickBanAction, type PickBanAction } from '../pickban/pickBanEntryPoints'
import { PickBanLink } from '../pickban/components/PickBanLink'
import { matchRoundLabel } from './scheduleSections'
import { ScheduleSection, TeamPair } from './scheduleShared'
import {
    bucketByStatus, groupByDay, nextUp, rowTime, rowTimeLabel, scheduledRows, unscheduledCount,
    type PublicScheduleDay, type PublicScheduleRow,
} from './publicSchedule'

interface ScheduleRowContext {
    myTeamId: string | null
    eventSlug: string
    now: number
    timezone: string
    nextMatchId: string | null
}

export interface PublicSchedulePanelProps {
    bracket: EventBracket | null
    loading: boolean
    eventSlug: string
    myTeamId: string | null
}

const SKELETON_ROWS = 4

const PICK_BAN_BUTTON_LABELS: Record<NonNullable<PickBanAction>, string> = {
    join: 'Join Picks & Bans',
    live: 'Watch Picks & Bans',
    view: 'View Picks & Bans',
}

function matchContextLabel(row: PublicScheduleRow): string {
    const parts = [row.stage.name, row.group?.name, matchRoundLabel(row.match)]
    return parts.filter(Boolean).join(' · ')
}

function RowScore({ match }: { match: EventMatch }) {
    if (match.score_a === null || match.score_b === null) return null

    return <span className="text-xs font-semibold text-foreground tabular-nums">{match.score_a}–{match.score_b}</span>
}

function RowStatus({ row, now, isNext }: { row: PublicScheduleRow; now: number; isNext: boolean }) {
    const { match } = row

    if (match.status === 'live') return <Chip className={MATCH_STATUS_STYLES.live}>Live Now</Chip>
    if (match.status === 'complete' || match.status === 'forfeit') return <MatchStatusChip match={match} />

    const countdown = isNext ? formatCountdown(new Date(row.startsAt).toISOString(), now) : null

    return <Chip className={MATCH_STATUS_STYLES.scheduled}>{countdown ? `Starts in ${countdown}` : 'Scheduled'}</Chip>
}

function RowPickBan({ eventSlug, match, isMine }: { eventSlug: string; match: EventMatch; isMine: boolean }) {
    const action = pickBanAction(match.pick_ban_status, isMine)

    if (!action) return null

    return (
        <Button asChild size="sm" variant={action === 'join' ? 'default' : 'outline'}>
            <PickBanLink eventSlug={eventSlug} matchId={match.id}>{PICK_BAN_BUTTON_LABELS[action]}</PickBanLink>
        </Button>
    )
}

function RowStreamButton({ url }: { url: string }) {
    return (
        <Button size="sm" variant="outline" onClick={() => openExternal(url)}>
            Watch Stream
        </Button>
    )
}

function ScheduleRowCard({ row, context, time }: { row: PublicScheduleRow; context: ScheduleRowContext; time: string }) {
    const { match } = row
    const isMine = sideOf(match, context.myTeamId) !== null

    return (
        <div className={cn(
            'rounded-lg border bg-card/40 p-3 flex flex-wrap items-center gap-x-3 gap-y-2',
            isMine ? 'border-accent-500/40' : 'border-hairline/10',
        )}>
            <span className="text-xs text-foreground tabular-nums whitespace-nowrap min-w-14 shrink-0">{time}</span>

            <TeamPair match={match} className="flex-1 basis-40" />

            <span className="text-[11px] text-muted-foreground shrink-0">{matchContextLabel(row)}</span>

            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
                <RowScore match={match} />
                <RowStatus row={row} now={context.now} isNext={match.id === context.nextMatchId} />
                <RowPickBan eventSlug={context.eventSlug} match={match} isMine={isMine} />
                {match.stream_url && <RowStreamButton url={match.stream_url} />}
            </div>
        </div>
    )
}

function DaySection({ day, context }: { day: PublicScheduleDay; context: ScheduleRowContext }) {
    return (
        <ScheduleSection title={day.label}>
            {day.rows.map(row => (
                <ScheduleRowCard key={row.match.id} row={row} context={context} time={rowTime(row.startsAt, context.timezone)} />
            ))}
        </ScheduleSection>
    )
}

export function PublicSchedulePanel({ bracket, loading, myTeamId, eventSlug }: PublicSchedulePanelProps) {
    const timezone = useDisplayTimezone()
    const now = useNow()
    const [showPlayed, setShowPlayed] = useNavState('event.schedulePlayedOpen', false)

    const scheduled = useMemo(() => scheduledRows(bracket), [bracket])
    const buckets = useMemo(() => bucketByStatus(scheduled), [scheduled])
    const upcomingDays = useMemo(() => groupByDay(buckets.upcoming, timezone, now), [buckets.upcoming, timezone, now])
    const playedDays = useMemo(() => groupByDay(buckets.played, timezone, now), [buckets.played, timezone, now])
    const next = useMemo(() => nextUp(scheduled, now), [scheduled, now])
    const unscheduled = useMemo(() => unscheduledCount(bracket), [bracket])

    const context: ScheduleRowContext = { myTeamId, eventSlug, now, timezone, nextMatchId: next?.match.id ?? null }
    const isEmpty = buckets.live.length === 0 && buckets.upcoming.length === 0 && buckets.played.length === 0

    return (
        <section aria-label="All Matches" aria-busy={loading} className="flex flex-col gap-4">
            {loading ? (
                <>
                    <span className="sr-only">Loading schedule…</span>
                    <div aria-hidden className="h-3 w-24 rounded bg-hairline/10" />
                    {Array.from({ length: SKELETON_ROWS }, (_, index) => (
                        <div key={index} aria-hidden className="h-16 rounded-lg border border-hairline/5 bg-card/30" />
                    ))}
                </>
            ) : (
                <>
                    {isEmpty ? (
                        <p className="p-6 text-center text-sm text-muted-foreground">No matches scheduled yet.</p>
                    ) : (
                        <>
                            {buckets.live.length > 0 && (
                                <ScheduleSection title="Live Now">
                                    {buckets.live.map(row => (
                                        <ScheduleRowCard
                                            key={row.match.id} row={row} context={context}
                                            time={rowTimeLabel(row.startsAt, context.timezone, context.now)}
                                        />
                                    ))}
                                </ScheduleSection>
                            )}

                            {upcomingDays.map(day => <DaySection key={day.key} day={day} context={context} />)}
                        </>
                    )}

                    {unscheduled > 0 && (
                        <p className="text-xs text-muted-foreground">
                            {unscheduled} {unscheduled === 1 ? 'match' : 'matches'} still need a time.
                        </p>
                    )}

                    {buckets.played.length > 0 && (
                        <section aria-label="Played matches" className="flex flex-col gap-4">
                            <button
                                type="button"
                                aria-expanded={showPlayed}
                                onClick={() => setShowPlayed(!showPlayed)}
                                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                                {showPlayed ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                                Show played matches ({buckets.played.length})
                            </button>
                            {showPlayed && playedDays.map(day => <DaySection key={day.key} day={day} context={context} />)}
                        </section>
                    )}
                </>
            )}
        </section>
    )
}
