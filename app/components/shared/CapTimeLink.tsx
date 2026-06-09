import { cn } from '@/lib/utils'
import { formatCapTime } from '@/app/utils/format'

/**
 * Renders a cap time. When a real `capId` is present the time becomes a button
 * that opens the Cap Detail page (via the `open-cap` window event, mirroring the
 * `open-player` convention in PlayerInfo). Aggregate times with no backing cap
 * (medians, medal thresholds, distribution buckets) pass `capId={undefined}` and
 * render as plain text.
 *
 * `stopPropagation` is important: several call sites render this inside rows that
 * already have their own click handler (e.g. opening the map).
 */
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
