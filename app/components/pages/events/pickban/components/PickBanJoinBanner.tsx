import { cn } from '@/lib/utils'
import { LiveDot } from '@/app/components/shared/LiveDot'
import { PickBanLink } from './PickBanLink'

export function PickBanJoinBanner({ eventSlug, matchId, opponent, className }: {
    eventSlug: string
    matchId: string
    opponent: string | null
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
            <LiveDot />
            <span className="text-foreground font-medium">
                {opponent ? `Picks & Bans against ${opponent} are live now.` : 'Picks & Bans are live now.'}
            </span>
        </PickBanLink>
    )
}
