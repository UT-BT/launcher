import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { TeamHolders, type TeamHolderMember } from '@/app/components/shared/TeamHolders'
import { Tooltip } from '@/app/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface TeamAvatarStackProps {
    members: TeamHolderMember[]
    currentUserId?: string | null
    className?: string
}

export function TeamAvatarStack({ members, currentUserId, className }: TeamAvatarStackProps) {
    const roster = members.slice(0, 12)
    if (roster.length === 0) return null

    return (
        <Tooltip
            side="bottom"
            content={(
                <div className={cn('py-1', roster.length > 6 ? 'min-w-64' : 'min-w-36')}>
                    <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                        Team roster
                    </div>
                    <TeamHolders
                        members={roster}
                        size="sm"
                        currentUserId={currentUserId}
                        className={roster.length > 6 ? 'grid grid-cols-2 gap-x-4 gap-y-1.5' : undefined}
                    />
                </div>
            )}
        >
            <div
                className={cn('flex items-center -space-x-3.5 cursor-help', className)}
                tabIndex={0}
                aria-label={`Team roster: ${roster.map(member => member.alias).join(', ')}`}
            >
                {roster.map((member, index) => (
                    <PlayerInfo
                        key={member.userId != null ? String(member.userId) : `${member.alias}-${index}`}
                        userId={member.userId ?? undefined}
                        alias={member.alias}
                        title={member.activeTitle ?? null}
                        size="sm"
                        presentation="avatar"
                        interactive={false}
                        highlight={currentUserId != null
                            && member.userId != null
                            && String(member.userId) === String(currentUserId)}
                        className="relative rounded-full ring-2 ring-card hover:z-10"
                    />
                ))}
            </div>
        </Tooltip>
    )
}
