import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { cn } from '@/lib/utils'
import type { ActiveTitle } from '@/app/utils/api'

export interface TeamHolderMember {
    userId?: string | null
    alias: string
    activeTitle?: ActiveTitle | null
}

interface TeamHoldersProps {
    members: TeamHolderMember[]
    size?: 'sm' | 'md' | 'lg'
    currentUserId?: string | null
    className?: string
}

export function TeamHolders({ members, size = 'sm', currentUserId, className }: TeamHoldersProps) {
    return (
        <div className={cn('flex flex-col gap-1.5 py-0.5 min-w-0', className)}>
            {members.map((member, index) => {
                const isSelf = currentUserId != null
                    && member.userId != null
                    && String(member.userId) === String(currentUserId)
                return (
                    <PlayerInfo
                        key={member.userId != null ? String(member.userId) : `${member.alias}-${index}`}
                        userId={member.userId ?? undefined}
                        alias={member.alias}
                        title={member.activeTitle ?? null}
                        size={size}
                        highlight={isSelf}
                    />
                )
            })}
        </div>
    )
}
