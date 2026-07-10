import { cn } from '@/lib/utils'
import { formatCapTime } from '@/app/utils/format'

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
    const target = teamCapId ?? capId
    if (!target) {
        return <span className={className}>{formatCapTime(seconds)}</span>
    }
    return (
        <button
            type="button"
            onClick={(e) => {
                e.stopPropagation()
                if (teamCapId) openTeamCap(teamCapId)
                else openCap(capId!)
                onNavigate?.()
            }}
            className={cn(
                'cursor-pointer hover:underline decoration-dotted underline-offset-2 transition-colors',
                className,
            )}
        >
            {formatCapTime(seconds)}
        </button>
    )
}
