import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import type { WRHolder } from '@/app/components/pages/MapsPage.types'
import { wrHolderLines } from './wrHolder'

/**
 * Holder block of a world record: the solo holder on one line, or each team member on a line of
 * their own with their split, fastest first. Renders nothing for a team record without members.
 */
export const WRHolderDetails = ({ holder, isTeam }: { holder: WRHolder; isTeam: boolean }) => {
    const lines = wrHolderLines(holder, isTeam)
    if (!lines) return null
    return (
        <div className="flex flex-col gap-1">
            {lines.map((line, index) => (
                <div key={line.userId || index} className="flex items-center justify-between gap-3">
                    <PlayerInfo userId={line.userId || undefined} alias={line.alias} title={line.title} size="sm" />
                    {line.split != null && (
                        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                            {line.split}
                        </span>
                    )}
                </div>
            ))}
        </div>
    )
}
