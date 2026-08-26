import { cn } from '@/lib/utils'
import { formatCapTime } from '@/app/utils/format'
import { NavLink } from '@/app/components/navigation/NavLink'
import { capTimeTarget } from '@/app/components/shared/capTimeTarget'

export function openCap(capId: string) {
    window.dispatchEvent(new CustomEvent('open-cap', { detail: { capId } }))
}

export function openTeamCap(teamCapId: string) {
    window.dispatchEvent(new CustomEvent('open-team-cap', { detail: { teamCapId } }))
}

interface CapTimeLinkProps {
    capId?: string | null
    teamCapId?: string | null
    seconds: number
    className?: string
    onNavigate?: () => void
}

export function CapTimeLink({ capId, teamCapId, seconds, className, onNavigate }: CapTimeLinkProps) {
    const target = capTimeTarget(capId, teamCapId)
    if (!target) {
        return <span className={className}>{formatCapTime(seconds)}</span>
    }
    return (
        <NavLink
            view={target.view}
            params={target.params}
            onActivate={() => {
                if (target.params.teamCapId) openTeamCap(target.params.teamCapId)
                else openCap(target.params.capId!)
                onNavigate?.()
            }}
            className={cn(
                'cursor-pointer hover:underline decoration-dotted underline-offset-2 transition-colors',
                className,
            )}
        >
            {formatCapTime(seconds)}
        </NavLink>
    )
}
