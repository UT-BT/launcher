import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { openExternal } from '@/app/platform'
import { useDisplayTimezone, formatZoned } from '@/app/utils/timezone'
import type { EventBracket, EventMatch } from '@/app/utils/api'
import { Chip, MATCH_STATUS_STYLES, MatchStatusChip, teamLabel } from '../bracket/bracketShared'
import { formatCountdown, MatchOddsChip, useNow } from '../predictions/predictionsShared'
import { PickBanLink } from '../pickban/components/PickBanLink'
import { PickBanStatusChip } from '../pickban/components/PickBanStatusChip'
import { TeamName } from '../TeamRoster'
import { matchRoundLabel } from './scheduleSections'
import { byDay, nextUp, partition, rows, unscheduledCount, type PublicScheduleRow } from './publicSchedule'

interface ScheduleRowCardProps {
    row: PublicScheduleRow
    myTeamId: string | null
    now: number
    isNext: boolean
    eventSlug: string
}

export interface PublicSchedulePanelProps {
    bracket: EventBracket | null
    loading: boolean
    eventSlug: string
    myTeamId: string | null
}

const SKELETON_ROWS = 4

const ROW_TIME_FORMAT: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }

function rowTime(startsAt: number, timezone: string): string {
    return formatZoned(startsAt, timezone, ROW_TIME_FORMAT)
}

function matchContextLabel(row: PublicScheduleRow): string {
    const parts = [row.stage.name, row.group?.name, matchRoundLabel(row.match)]
    return parts.filter(Boolean).join(' · ')
}

function RowScore({ match }: { match: EventMatch }) {
    if (match.score_a === null || match.score_b === null) return null

    return <span className="text-xs font-semibold text-foreground tabular-nums">{match.score_a}–{match.score_b}</span>
}

function RowPickBan({ eventSlug, match }: { eventSlug: string; match: EventMatch }) {
    if (match.pick_ban_status === 'none') return null

    return (
        <PickBanLink eventSlug={eventSlug} matchId={match.id} className="shrink-0">
            <PickBanStatusChip status={match.pick_ban_status} />
        </PickBanLink>
    )
}

function RowStreamLink({ url }: { url: string }) {
    return (
        <button
            type="button"
            onClick={() => openExternal(url)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
        >
            <Radio className="size-3.5" /> Stream
        </button>
    )
}

function ScheduleRowCard({ row, myTeamId, now, isNext, eventSlug }: ScheduleRowCardProps) {
    const timezone = useDisplayTimezone()
    const { match } = row
    const isMine = !!myTeamId && (match.team_a?.id === myTeamId || match.team_b?.id === myTeamId)
    const countdown = isNext ? formatCountdown(new Date(row.startsAt).toISOString(), now) : null

    return (
        <div className={cn(
            'rounded-lg border bg-card/40 p-3 flex flex-wrap items-center gap-x-3 gap-y-2',
            isMine ? 'border-accent-500/40' : 'border-hairline/10',
        )}>
            <span className="text-xs text-foreground tabular-nums w-14 shrink-0">{rowTime(row.startsAt, timezone)}</span>

            <div className="flex items-center gap-1.5 min-w-0 flex-1 basis-40 text-sm font-medium text-white">
                <TeamName teamId={match.team_a?.id} className="truncate">
                    {teamLabel(match.team_a, match.slot_a_label)}
                </TeamName>
                <span className="text-muted-foreground shrink-0">vs</span>
                <TeamName teamId={match.team_b?.id} className="truncate">
                    {teamLabel(match.team_b, match.slot_b_label)}
                </TeamName>
            </div>

            <span className="text-[11px] text-muted-foreground shrink-0">{matchContextLabel(row)}</span>

            <div className="flex flex-wrap items-center gap-1.5 shrink-0 ml-auto">
                <RowScore match={match} />
                <MatchOddsChip match={match} />
                <RowPickBan eventSlug={eventSlug} match={match} />
                {match.stream_url && <RowStreamLink url={match.stream_url} />}
                <MatchStatusChip match={match} />
                {isNext && countdown && <Chip className={MATCH_STATUS_STYLES.scheduled}>in {countdown}</Chip>}
            </div>
        </div>
    )
}

function DaySection({ label, rows: dayRows, myTeamId, now, nextMatchId, eventSlug }: {
    label: string
    rows: PublicScheduleRow[]
    myTeamId: string | null
    now: number
    nextMatchId: string | null
    eventSlug: string
}) {
    return (
        <section aria-label={label} className="flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</h3>
            {dayRows.map(row => (
                <ScheduleRowCard key={row.match.id} row={row} myTeamId={myTeamId} now={now} isNext={row.match.id === nextMatchId} eventSlug={eventSlug} />
            ))}
        </section>
    )
}

export function PublicSchedulePanel({ bracket, loading, myTeamId, eventSlug }: PublicSchedulePanelProps) {
    const timezone = useDisplayTimezone()
    const now = useNow()
    const [showPlayed, setShowPlayed] = useState(false)

    const scheduled = useMemo(() => rows(bracket), [bracket])
    const buckets = useMemo(() => partition(scheduled), [scheduled])
    const days = useMemo(() => byDay(buckets.upcoming, timezone, now), [buckets.upcoming, timezone, now])
    const next = useMemo(() => nextUp(scheduled, now), [scheduled, now])
    const unscheduled = useMemo(() => unscheduledCount(bracket), [bracket])

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
            ) : isEmpty ? (
                <>
                    <p className="p-6 text-center text-sm text-muted-foreground">No matches scheduled yet.</p>
                    {unscheduled > 0 && (
                        <p className="text-xs text-muted-foreground">
                            {unscheduled} {unscheduled === 1 ? 'match' : 'matches'} still need a time.
                        </p>
                    )}
                </>
            ) : (
                <>
                    {buckets.live.length > 0 && (
                        <section aria-label="Live Now" className="flex flex-col gap-2">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Live Now</h3>
                            {buckets.live.map(row => (
                                <ScheduleRowCard key={row.match.id} row={row} myTeamId={myTeamId} now={now} isNext={false} eventSlug={eventSlug} />
                            ))}
                        </section>
                    )}

                    {days.map(day => (
                        <DaySection
                            key={day.key} label={day.label} rows={day.rows} myTeamId={myTeamId} now={now}
                            nextMatchId={next?.match.id ?? null} eventSlug={eventSlug}
                        />
                    ))}

                    {unscheduled > 0 && (
                        <p className="text-xs text-muted-foreground">
                            {unscheduled} {unscheduled === 1 ? 'match' : 'matches'} still need a time.
                        </p>
                    )}

                    {buckets.played.length > 0 && (
                        <section aria-label="Played matches" className="flex flex-col gap-2">
                            <button
                                type="button"
                                onClick={() => setShowPlayed(current => !current)}
                                className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                                {showPlayed ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                                Show played matches ({buckets.played.length})
                            </button>
                            {showPlayed && buckets.played.map(row => (
                                <ScheduleRowCard key={row.match.id} row={row} myTeamId={myTeamId} now={now} isNext={false} eventSlug={eventSlug} />
                            ))}
                        </section>
                    )}
                </>
            )}
        </section>
    )
}
