import { Fragment } from 'react'
import { Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { CHIP_SHAPE } from '@/app/components/shared/chipStyles'
import type { EventStatsResult, EventStatsStanding, EventStatsTeamMember } from '@/app/utils/api'
import type { FormPip, PathPart, TeamCardView } from './statsView'
import { teamAccentStyle } from './teamAccent'

const STANDING_STYLES: Record<EventStatsStanding, string> = {
    alive: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
    eliminated: 'text-muted-foreground border-hairline/15',
    champion: 'bg-red-500/15 text-red-300 border-red-500/30',
    withdrawn: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    disqualified: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
}

const PIP_STYLES: Record<EventStatsResult, string> = {
    W: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    D: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    L: 'bg-red-500/15 text-red-300 border-red-500/25',
}

const memberList = new Intl.ListFormat('en', { style: 'long', type: 'conjunction' })

function memberName(member: EventStatsTeamMember): string {
    return member.alias ?? 'Unknown player'
}

function MemberStack({ members }: { members: EventStatsTeamMember[] }) {
    if (members.length === 0) return <span aria-hidden className="size-8 shrink-0" />
    return (
        <span role="img" aria-label={memberList.format(members.map(memberName))} className="flex shrink-0 -space-x-3">
            {members.map(member => (
                <span
                    key={member.user}
                    title={memberName(member)}
                    className="team-card-avatar relative flex rounded-full hover:z-10"
                >
                    <PlayerInfo userId={member.user} alias={member.alias} size="md" presentation="avatar" interactive={false} />
                </span>
            ))}
        </span>
    )
}

function StandingChip({ standing }: { standing: TeamCardView['standing'] }) {
    return (
        <span className={cn(CHIP_SHAPE, 'inline-flex shrink-0 items-center gap-1', STANDING_STYLES[standing.key])}>
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {standing.label}
        </span>
    )
}

function PathLine({ parts }: { parts: PathPart[] }) {
    if (parts.length === 0) return null
    return (
        <p className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {parts.map((part, index) => (
                <Fragment key={`${part.label}-${index}`}>
                    {index > 0 && <span aria-hidden>→</span>}
                    <span className={cn(part.next && 'font-semibold text-foreground')}>{part.label}</span>
                </Fragment>
            ))}
        </p>
    )
}

function FormPips({ pips, summary }: { pips: FormPip[]; summary: string }) {
    if (pips.length === 0) return <span className="text-xs text-muted-foreground">{summary}</span>
    return (
        <span role="img" aria-label={`${summary}: ${pips.map(pip => pip.title).join(', ')}`} className="flex items-center gap-1">
            {pips.map((pip, index) => (
                <span
                    key={`${pip.matchId}-${index}`}
                    title={pip.title}
                    className={cn('grid size-4.5 place-items-center rounded border text-[10px] font-bold', PIP_STYLES[pip.result])}
                >
                    {pip.result}
                </span>
            ))}
        </span>
    )
}

function RecordStat({ label, value }: { label: string; value: string }) {
    return (
        <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="font-mono text-sm font-semibold tabular-nums text-foreground">{value}</div>
        </div>
    )
}

interface TeamCardProps {
    card: TeamCardView
    eventSlug: string
}

export function TeamCard({ card, eventSlug }: TeamCardProps) {
    const { navigate } = useNavigation()
    const params = { eventSlug, eventTeamId: card.id }

    return (
        <div style={teamAccentStyle(card.accentSlot)} className="flex min-w-0">
            <NavLink
                as="div"
                view="event-team"
                params={params}
                onActivate={() => navigate('event-team', params)}
                className={cn(
                    'team-card flex w-full min-w-0 cursor-pointer flex-col gap-2.5 rounded-xl border border-hairline/10 bg-card/30 p-3.5 text-left transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-400/60',
                )}
            >
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                    <MemberStack members={card.members} />
                    <div className="min-w-0">
                        <h3 className="text-base font-bold leading-tight text-foreground break-words">{card.name}</h3>
                        <div className="text-xs text-muted-foreground">{card.seedLabel}</div>
                    </div>
                    <StandingChip standing={card.standing} />
                </div>

                <PathLine parts={card.path} />

                <div className="mt-auto grid grid-cols-3 gap-1.5 border-t border-hairline/10 pt-3">
                    <RecordStat label="Matches" value={card.record.matches} />
                    <RecordStat label="Maps" value={card.record.maps} />
                    <RecordStat label="Caps" value={card.record.caps} />
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                    <FormPips pips={card.form} summary={card.formSummary} />
                    {card.recordsHeld && (
                        <span title={card.recordsHeld.title} className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-semibold text-yellow-300">
                            <Timer aria-hidden className="size-3.5" />
                            {card.recordsHeld.label}
                        </span>
                    )}
                </div>
            </NavLink>
        </div>
    )
}
