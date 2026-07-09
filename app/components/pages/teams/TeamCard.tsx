import { Users2, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { formatAddedDate } from '@/app/utils/format'
import type { ActiveTitle, TeamCore } from '@/app/utils/api'
import { AccessBadge, TagChip } from './teamsShared'

interface TeamCardProps {
    team: TeamCore
    ownerAlias?: string
    ownerTitle?: ActiveTitle | null
    isOwnTeam?: boolean
    onSelect: (teamId: string) => void
}

export function TeamCard({ team, ownerAlias, ownerTitle, isOwnTeam, onSelect }: TeamCardProps) {
    return (
        <button
            type="button"
            onClick={() => onSelect(team.id)}
            className={cn(
                'text-left w-full rounded-xl border p-4 space-y-3 transition-colors cursor-pointer',
                isOwnTeam
                    ? 'bg-accent-500/10 border-accent-500/50 hover:border-accent-500/70'
                    : 'bg-card/30 border-white/10 hover:border-white/20 hover:bg-card/50',
            )}
        >
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base font-bold text-white truncate">{team.name}</span>
                    <TagChip tag={team.tag} />
                </div>
                {isOwnTeam && (
                    <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-accent-500/20 text-accent-200 border-accent-500/40">
                        Your team
                    </span>
                )}
            </div>

            <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">Owner</span>
                <PlayerInfo userId={team.owner} alias={ownerAlias} title={ownerTitle} size="sm" interactive={false} />
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <Users2 className="size-3.5" />
                        <span className="tabular-nums">{team.member_count}</span>
                    </span>
                    <span className="flex items-center gap-1">
                        <Calendar className="size-3.5" />
                        <span>{team.added ? formatAddedDate(team.added) : '—'}</span>
                    </span>
                </div>
                <AccessBadge isOpen={team.is_open} />
            </div>
        </button>
    )
}
