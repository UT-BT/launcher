import { cn } from '@/lib/utils'
import { formatCapTime } from '@/app/utils/format'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import type { ActiveTitle, CapNeighbor } from '@/app/utils/api'

interface RankContextCardProps {
    rank: number
    total: number
    capTime: number
    capUser: string | number
    capAlias?: string | null
    capTitle?: ActiveTitle | null
    neighbors: { above: CapNeighbor | null; below: CapNeighbor | null }
    currentUserId?: string | number
}

interface NeighborRowProps {
    rank: number
    userId: string | number
    alias?: string | null
    title?: ActiveTitle | null
    time: number
    capId?: string
    highlight?: boolean
    currentUserId?: string | number
}

function NeighborRow({ rank, userId, alias, title, time, capId, highlight, currentUserId }: NeighborRowProps) {
    const isYou = currentUserId != null && String(userId) === String(currentUserId)
    return (
        <div className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg',
            highlight ? 'bg-blue-500/10 border border-blue-500/30' : 'hover:bg-white/[0.03]',
        )}>
            <span className="w-8 text-xs font-bold font-mono text-muted-foreground tabular-nums shrink-0">#{rank}</span>
            <div className="min-w-0 flex-1">
                <PlayerInfo userId={userId} alias={alias} title={title} size="sm" highlight={isYou} showYouBadge={isYou} />
            </div>
            <span className="text-sm font-mono tabular-nums font-bold text-white shrink-0">
                {capId ? <CapTimeLink capId={capId} seconds={time} /> : formatCapTime(time)}
            </span>
        </div>
    )
}

export function RankContextCard({
    rank, total, capTime, capUser, capAlias, capTitle, neighbors, currentUserId,
}: RankContextCardProps) {
    return (
        <div className="bg-card/30 border border-white/5 rounded-xl">
            <div className="px-4 py-3 border-b border-white/5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-center">
                Rank
            </div>

            <div className="px-4 py-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono tabular-nums text-white">#{rank}</span>
                <span className="text-sm text-muted-foreground">of {total.toLocaleString()}</span>
            </div>

            <div className="px-2 pb-3 space-y-1">
                {neighbors.above && (
                    <NeighborRow
                        rank={neighbors.above.rank}
                        userId={neighbors.above.user}
                        alias={neighbors.above.alias}
                        title={neighbors.above.active_title}
                        time={neighbors.above.cap_time_seconds}
                        capId={neighbors.above.id}
                        currentUserId={currentUserId}
                    />
                )}
                <NeighborRow
                    rank={rank}
                    userId={capUser}
                    alias={capAlias}
                    title={capTitle}
                    time={capTime}
                    highlight
                    currentUserId={currentUserId}
                />
                {neighbors.below && (
                    <NeighborRow
                        rank={neighbors.below.rank}
                        userId={neighbors.below.user}
                        alias={neighbors.below.alias}
                        title={neighbors.below.active_title}
                        time={neighbors.below.cap_time_seconds}
                        capId={neighbors.below.id}
                        currentUserId={currentUserId}
                    />
                )}
            </div>
        </div>
    )
}
