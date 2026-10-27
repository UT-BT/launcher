import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useNavigation } from '@/app/components/navigation/NavigationContext'
import type { OverviewTeam } from './StatsOverview'
import { teamAccentColor } from './teamAccent'

export function OverviewTeamLink({ team, eventSlug, className, children }: {
    team: OverviewTeam
    eventSlug: string
    className?: string
    children?: ReactNode
}) {
    const { navigate } = useNavigation()
    const params = { eventSlug, eventTeamId: team.id }

    return (
        <NavLink
            view="event-team"
            params={params}
            onActivate={() => navigate('event-team', params)}
            className={cn('min-w-0 cursor-pointer text-left font-semibold hover:underline underline-offset-4', className)}
        >
            {children ?? <span style={{ color: teamAccentColor(team.accentSlot) }}>{team.name}</span>}
        </NavLink>
    )
}
