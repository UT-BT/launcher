import { createContext, useContext, type CSSProperties, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { CHIP_SHAPE } from '@/app/components/shared/chipStyles'
import { STANDING_LABELS, type FormPip } from '@/app/components/pages/events/stats/statsView'
import type { EventStatsResult, EventStatsStanding, EventStatsTeamMember } from '@/app/utils/api'

export interface TeamPageContextValue {
    eventSlug: string
    names: Record<string, string>
    accentOf: (teamId: string | null | undefined) => string
}

export const TeamPageContext = createContext<TeamPageContextValue | null>(null)

export function useTeamPage(): TeamPageContextValue {
    const value = useContext(TeamPageContext)
    if (!value) throw new Error('useTeamPage must be used within a TeamPageContext.Provider')
    return value
}

export function TeamLink({ teamId, className, style, children }: {
    teamId: string
    className?: string
    style?: CSSProperties
    children: ReactNode
}) {
    const { eventSlug } = useTeamPage()
    const { navigate } = useNavigation()
    const params = { eventSlug, eventTeamId: teamId }

    return (
        <NavLink
            view="event-team"
            params={params}
            onActivate={() => navigate('event-team', params)}
            className={cn('min-w-0 cursor-pointer text-left hover:underline underline-offset-4', className)}
        >
            <span style={style}>{children}</span>
        </NavLink>
    )
}

export function TeamAvatars({ members, accent, size = 'sm', className }: {
    members: EventStatsTeamMember[]
    accent: string
    size?: 'sm' | 'md' | 'lg'
    className?: string
}) {
    if (members.length === 0) return null

    return (
        <span
            role="img"
            aria-label={members.map(member => member.alias ?? 'Unknown player').join(' and ')}
            className={cn('inline-flex shrink-0 items-center', size === 'lg' ? '-space-x-3.5' : '-space-x-3', className)}
        >
            {members.map(member => (
                <span
                    key={member.user}
                    title={member.alias ?? undefined}
                    className="relative inline-flex rounded-full hover:z-10"
                    style={{ boxShadow: `0 0 0 2px var(--background), 0 0 0 ${size === 'lg' ? 4 : 3}px ${accent}` }}
                >
                    <PlayerInfo userId={member.user} alias={member.alias} size={size} presentation="avatar" interactive={false} />
                </span>
            ))}
        </span>
    )
}

export const RESULT_FILLS: Record<EventStatsResult, string> = {
    W: 'bg-emerald-500 text-white',
    D: 'bg-amber-400 text-white',
    L: 'bg-red-500 text-white',
}

export const RESULT_RINGS: Record<EventStatsResult, string> = {
    W: 'border-emerald-400',
    D: 'border-amber-400',
    L: 'border-red-500/50',
}

const RESULT_WORDS: Record<EventStatsResult, string> = { W: 'Win', D: 'Draw', L: 'Loss' }

export function ResultBadge({ result, className }: { result: EventStatsResult; className?: string }) {
    return (
        <span
            title={RESULT_WORDS[result]}
            className={cn('inline-flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold leading-none', RESULT_FILLS[result], className)}
        >
            {result}
        </span>
    )
}

export function FormPips({ pips, summary }: { pips: FormPip[]; summary: string }) {
    if (pips.length === 0) return <span className="text-xs text-muted-foreground">{summary}</span>

    return (
        <span className="inline-flex flex-wrap gap-1" role="list" aria-label={summary}>
            {pips.map(pip => (
                <span
                    key={pip.matchId}
                    role="listitem"
                    title={pip.title}
                    aria-label={pip.title}
                    className={cn('inline-flex size-5 items-center justify-center rounded text-[10px] font-bold leading-none', RESULT_FILLS[pip.result])}
                >
                    {pip.result}
                </span>
            ))}
        </span>
    )
}

const STANDING_STYLES: Record<EventStatsStanding, string> = {
    alive: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/40',
    eliminated: 'bg-hairline/5 text-muted-foreground border-hairline/20',
    champion: 'bg-red-500/15 text-red-300 border-red-500/40',
    withdrawn: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
    disqualified: 'bg-amber-500/10 text-amber-300 border-amber-500/40',
}

export function StandingChip({ standing }: { standing: EventStatsStanding }) {
    return (
        <span className={cn('inline-flex shrink-0 items-center gap-1.5', CHIP_SHAPE, STANDING_STYLES[standing])}>
            <span aria-hidden className="size-1.5 rounded-full bg-current" />
            {STANDING_LABELS[standing]}
        </span>
    )
}

export const SECTION_LABEL = 'text-[10px] font-semibold uppercase tracking-wider text-muted-foreground'
