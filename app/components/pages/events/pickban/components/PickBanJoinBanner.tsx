import { cn } from '@/lib/utils'
import { PickBanLink } from './PickBanLink'

export function PickBanJoinBanner({ eventSlug, matchId, className }: {
    eventSlug: string
    matchId: string
    className?: string
}) {
    return (
        <PickBanLink
            eventSlug={eventSlug}
            matchId={matchId}
            className={cn(
                'flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs shrink-0 cursor-pointer hover:bg-emerald-500/15 transition-colors',
                className,
            )}
        >
            <span className="relative flex size-2 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
            </span>
            <span className="text-foreground font-medium">Pick/Ban open – Join</span>
        </PickBanLink>
    )
}
