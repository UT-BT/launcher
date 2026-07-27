import { cn } from '@/lib/utils'
import { formatCapTime } from '@/app/utils/format'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import type { ActiveTitle, CapNeighbor } from '@/app/utils/api'

interface RankContextCardProps {
    rank: number | null
    total: number | null
    capTime: number
    capUser: string | number
    capAlias?: string | null
    capTitle?: ActiveTitle | null
    neighbors: { above: CapNeighbor[]; below: CapNeighbor[] }
    currentUserId?: string | number
}

interface NeighborRowProps {
    rank: number | null
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
            highlight ? 'bg-accent-500/10 border border-accent-500/30' : 'hover:bg-hairline/[0.03]',
        )}>
            <span className="w-8 text-xs font-bold font-mono text-muted-foreground tabular-nums shrink-0">{rank != null ? `#${rank}` : '—'}</span>
            <div className="min-w-0 flex-1">
                <PlayerInfo userId={userId} alias={alias} title={title} size="sm" highlight={isYou} showYouBadge={isYou} />
            </div>
            <span className="text-sm font-mono tabular-nums font-bold text-foreground shrink-0">
                {capId ? <CapTimeLink capId={capId} seconds={time} /> : formatCapTime(time)}
            </span>
        </div>
    )
}

export function RankContextCard({
    rank, total, capTime, capUser, capAlias, capTitle, neighbors, currentUserId,
}: RankContextCardProps) {
    const above = neighbors?.above ?? []
    const below = neighbors?.below ?? []

    let topRows: CapNeighbor[]
    let bottomRows: CapNeighbor[]
    if (above.length === 0) {
        topRows = []
        bottomRows = below.slice(0, 2)
    } else if (below.length === 0) {
        topRows = [...above.slice(0, 2)].reverse()
        bottomRows = []
    } else {
        topRows = [above[0]]
        bottomRows = [below[0]]
    }

    const renderNeighbor = (n: CapNeighbor) => (
        <NeighborRow
            key={n.id}
            rank={n.rank}
            userId={n.user}
            alias={n.alias}
            title={n.active_title}
            time={n.cap_time_seconds}
            capId={n.id}
            currentUserId={currentUserId}
        />
    )

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl">
            <div className="px-4 py-3 border-b border-hairline/5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium text-center">
                Rank
            </div>

            <div className="px-4 py-4 flex items-baseline gap-2">
                <span className="text-3xl font-bold font-mono tabular-nums text-foreground">{rank != null ? `#${rank}` : '—'}</span>
                <span className="text-sm text-muted-foreground">of {total != null ? total.toLocaleString() : '—'}</span>
            </div>

            <div className="px-2 pb-3 space-y-1">
                {topRows.map(renderNeighbor)}
                <NeighborRow
                    rank={rank}
                    userId={capUser}
                    alias={capAlias}
                    title={capTitle}
                    time={capTime}
                    highlight
                    currentUserId={currentUserId}
                />
                {bottomRows.map(renderNeighbor)}
            </div>
        </div>
    )
}
