import { cn } from '@/lib/utils'
import { formatCapTime } from '@/app/utils/format'

export function openCap(capId: string) {
    window.dispatchEvent(new CustomEvent('open-cap', { detail: { capId } }))
}

interface CapTimeLinkProps {
    capId?: string | null
    seconds: number
    className?: string
    onNavigate?: () => void
}

export function CapTimeLink({ capId, seconds, className, onNavigate }: CapTimeLinkProps) {
    if (!capId) {
        return <span className={className}>{formatCapTime(seconds)}</span>
    }
    return (
        <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openCap(capId); onNavigate?.() }}
            className={cn(
                'cursor-pointer hover:underline decoration-dotted underline-offset-2 transition-colors',
                className,
            )}
        >
            {formatCapTime(seconds)}
        </button>
    )
}
