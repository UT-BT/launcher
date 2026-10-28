import { ArrowUpRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { LiveDot } from '@/app/components/shared/LiveDot'
import { PickBanLink } from '@/app/components/pages/events/pickban/components/PickBanLink'
import { teamMatchView, type TeamMatchView } from '@/app/components/pages/events/stats/statsView'
import { formatSlotTime, useDisplayTimezone } from '@/app/utils/timezone'
import { sideColorTag, sideColorTitle, sideColorTone } from '@/app/utils/sideLabels'
import { PICK_BAN_TONES } from '@/app/components/broadcast/broadcastTone'
import type { EventTeamStatsMatch, SideColor } from '@/app/utils/api'
import { MapRow } from './MapRow'
import { PickBanSteps } from './PickBanSteps'
import { ResultBadge, SECTION_LABEL, TeamAvatars, TeamLink, useTeamPage } from './teamShared'

function SideTag({ side }: { side: SideColor }) {
    const tone = PICK_BAN_TONES[sideColorTone(side)]
    return (
        <span
            title={sideColorTitle(side)}
            className={cn('rounded px-1.5 py-1 text-[10px] font-bold leading-none tracking-wider', tone.solid, tone.onSolid)}
        >
            {sideColorTag(side)}
        </span>
    )
}

function MatchPickBanLink({ matchId, label }: { matchId: string; label: string }) {
    const { eventSlug } = useTeamPage()
    return (
        <PickBanLink
            eventSlug={eventSlug}
            matchId={matchId}
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-accent-300 hover:underline underline-offset-4"
        >
            {label}
            <ArrowUpRight className="size-3.5" aria-hidden />
        </PickBanLink>
    )
}

function MatchHeading({ view }: { view: TeamMatchView }) {
    const { accentOf } = useTeamPage()
    const timezone = useDisplayTimezone()
    const when = view.scheduledAt ? formatSlotTime(view.scheduledAt, timezone) : null
    const opponent = view.opponent

    return (
        <div className="min-w-0">
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] uppercase tracking-wider text-muted-foreground">
                {view.meta && <span>{view.meta}</span>}
                {when && <time dateTime={view.scheduledAt ?? undefined}>{when}</time>}
            </div>
            <div className="mt-1.5 flex min-w-0 flex-wrap items-center gap-2">
                {opponent ? (
                    <>
                        <span className="text-xs text-muted-foreground">vs</span>
                        <TeamAvatars members={opponent.members} accent={accentOf(opponent.id)} />
                        <TeamLink teamId={opponent.id} className="text-lg font-black leading-tight break-words" style={{ color: accentOf(opponent.id) }}>
                            {opponent.name}
                        </TeamLink>
                    </>
                ) : (
                    <span className="text-sm italic text-muted-foreground">{view.opponentLabel}</span>
                )}
            </div>
        </div>
    )
}

function MatchBody({ match, view, teamId, teamName }: {
    match: EventTeamStatsMatch
    view: TeamMatchView
    teamId: string
    teamName: string
}) {
    const opponentName = view.opponent?.name ?? view.opponentLabel

    return (
        <div className="grid gap-4 border-t border-hairline/10 p-3 sm:p-4">
            <div className="grid gap-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    {match.pick_ban
                        ? <span className={SECTION_LABEL}>Pick &amp; ban</span>
                        : <span className="text-xs text-muted-foreground">No pick &amp; ban for this match.</span>}
                    <MatchPickBanLink matchId={view.id} label={view.pickBanLink} />
                </div>
                {match.pick_ban && <PickBanSteps pickBan={match.pick_ban} />}
            </div>
            {match.status === 'forfeit' ? (
                <p className="text-xs italic text-muted-foreground">{view.note}</p>
            ) : view.maps.length > 0 && (
                <div className="grid gap-2">
                    <span className={SECTION_LABEL}>Maps</span>
                    <div className="grid gap-2">
                        {match.maps.map(map => (
                            <MapRow key={map.ordinal} map={map} teamId={teamId} teamName={teamName} opponentName={opponentName} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}

export function MatchCard({ match, teamId, teamName, expanded, onToggle }: {
    match: EventTeamStatsMatch
    teamId: string
    teamName: string
    expanded: boolean
    onToggle: () => void
}) {
    const { names } = useTeamPage()
    const view = teamMatchView(match, names)
    const bodyId = `team-match-${view.id}`

    if (view.state !== 'result') {
        return (
            <div className="grid gap-2.5 rounded-xl border border-hairline/10 bg-card/30 p-3 sm:p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <MatchHeading view={view} />
                    {view.state === 'live' ? (
                        <span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-300">
                            <LiveDot />
                            {view.statusLabel}
                        </span>
                    ) : (
                        <span className="text-xs uppercase tracking-wider text-muted-foreground">{view.statusLabel}</span>
                    )}
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                    {view.state === 'live' ? (
                        <>
                            <MatchPickBanLink matchId={view.id} label={view.pickBanLink} />
                            <span>{view.note}</span>
                        </>
                    ) : (
                        <>
                            <span>{view.note}</span>
                            <MatchPickBanLink matchId={view.id} label={view.pickBanLink} />
                        </>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div className={cn('rounded-xl border bg-card/30', expanded ? 'border-hairline/20' : 'border-hairline/10')}>
            <div
                onClick={onToggle}
                className="flex cursor-pointer flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4"
            >
                <MatchHeading view={view} />
                <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                    {match.own_side && <SideTag side={match.own_side} />}
                    {view.score && <span className="text-3xl font-black leading-none tabular-nums text-foreground">{view.score}</span>}
                    {view.result && <ResultBadge result={view.result} />}
                    <button
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={expanded ? bodyId : undefined}
                        aria-label={expanded ? 'Hide match details' : 'Show match details'}
                        onClick={event => {
                            event.stopPropagation()
                            onToggle()
                        }}
                        className="ml-auto inline-flex size-8 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-hairline/5 hover:text-foreground"
                    >
                        <ChevronDown className={cn('size-5 transition-transform', expanded && 'rotate-180')} aria-hidden />
                    </button>
                </div>
            </div>
            {expanded && (
                <div id={bodyId}>
                    <MatchBody match={match} view={view} teamId={teamId} teamName={teamName} />
                </div>
            )}
        </div>
    )
}
