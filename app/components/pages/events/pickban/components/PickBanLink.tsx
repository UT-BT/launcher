import type { ReactNode } from 'react'
import { NavLink } from '@/app/components/navigation/NavLink'
import { useNavigation } from '@/app/components/navigation/NavigationContext'

interface PickBanLinkProps {
    eventSlug: string
    matchId: string
    className?: string
    children: ReactNode
}

export function PickBanLink({ eventSlug, matchId, className, children }: PickBanLinkProps) {
    const { navigate } = useNavigation()

    return (
        <NavLink
            view="match-pickban"
            params={{ eventSlug, matchId }}
            onActivate={() => navigate('match-pickban', { eventSlug, matchId })}
            className={className}
        >
            {children}
        </NavLink>
    )
}
