import { TeamHolders, type TeamHolderMember } from '@/app/components/shared/TeamHolders'
import { Tooltip } from '@/app/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface TeamRosterBadgeProps {
    members?: TeamHolderMember[] | null
    currentUserId?: string | null
    className?: string
}

export function TeamRosterBadge({ members, currentUserId, className }: TeamRosterBadgeProps) {
    const badge = (
        <span
            className={cn(
                'shrink-0 inline-flex items-center h-4 px-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[9px] font-bold uppercase tracking-wider',
                members?.length && 'cursor-help',
                className,
            )}
            tabIndex={members?.length ? 0 : undefined}
        >
            Team
        </span>
    )

    if (!members?.length) return badge

    return (
        <Tooltip
            side="bottom"
            content={(
                <div className={cn('py-1', members.length > 6 ? 'min-w-64' : 'min-w-36')}>
                    <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Team roster
                    </div>
                    <TeamHolders
                        members={members}
                        size="sm"
                        currentUserId={currentUserId}
                        className={members.length > 6 ? 'grid grid-cols-2 gap-x-4 gap-y-1.5' : undefined}
                    />
                </div>
            )}
        >
            {badge}
        </Tooltip>
    )
}
