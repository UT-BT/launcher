import { Users2, Calendar, Trophy, Flag, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { NavLink } from '@/app/components/navigation/NavLink'
import { formatAddedDate } from '@/app/utils/format'
import type { TeamCore, TeamSort } from '@/app/utils/api'
import { AccessBadge, TagChip } from './teamsShared'
import { formatTeamHours } from './teamStats'
import { TeamMetricRow } from './TeamMetricRow'
import { TeamAvatar } from './TeamAvatar'

interface TeamCardProps {
    team: TeamCore
    isOwnTeam?: boolean
    highlight?: TeamSort
    onSelect: (teamId: string) => void
}

export function TeamCard({ team, isOwnTeam, highlight, onSelect }: TeamCardProps) {
    const stats = team.stats
    const ranks = stats?.ranks

    return (
        <NavLink
            view="team-detail"
            params={{ teamId: team.id }}
            onActivate={() => onSelect(team.id)}
            className={cn(
                'block text-left w-full rounded-xl border transition-colors cursor-pointer',
                isOwnTeam
                    ? 'bg-accent-500/10 border-accent-500/50 hover:border-accent-500/70'
                    : 'bg-card/30 border-white/10 hover:border-white/20 hover:bg-card/50',
            )}
        >
            <div className="p-4 space-y-3">
                <div className="flex items-center gap-3 min-w-0">
                    <TeamAvatar team={team} size="md" />
                    <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <span
                                title={team.name}
                                className="min-w-0 truncate text-base font-bold text-white leading-tight"
                            >
                                {team.name}
                            </span>
                            <TagChip tag={team.tag} />
                            <AccessBadge isOpen={team.is_open} compact />
                            {isOwnTeam && (
                                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border bg-accent-500/20 text-accent-200 border-accent-500/40">
                                    Yours
                                </span>
                            )}
                        </div>
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Users2 className="size-3.5 shrink-0" />
                            <span className="tabular-nums">
                                {team.member_count} {team.member_count === 1 ? 'member' : 'members'}
                            </span>
                        </span>
                    </div>
                </div>

                <div className="pt-1 border-t border-white/5">
                    <TeamMetricRow
                        icon={Trophy}
                        label="Records"
                        value={(stats?.world_records ?? 0).toLocaleString()}
                        total={stats?.world_records ?? 0}
                        rank={ranks?.world_records}
                        accent="text-blue-300"
                        active={highlight === 'world_records'}
                    />
                    <TeamMetricRow
                        icon={Flag}
                        label="Caps"
                        value={(stats?.caps ?? 0).toLocaleString()}
                        total={stats?.caps ?? 0}
                        rank={ranks?.caps}
                        accent="text-amber-300"
                        active={highlight === 'caps'}
                    />
                    <TeamMetricRow
                        icon={Clock}
                        label="Played"
                        value={formatTeamHours(stats?.playtime_seconds)}
                        total={stats?.playtime_seconds ?? 0}
                        rank={ranks?.playtime}
                        accent="text-emerald-300"
                        active={highlight === 'playtime'}
                    />
                </div>

                <div className="flex items-center gap-1.5 min-w-0 text-xs text-muted-foreground pt-2 border-t border-white/5">
                    <Calendar className="size-3.5 shrink-0" />
                    <span className="truncate">
                        Created {team.added ? formatAddedDate(team.added) : '—'} by{' '}
                        <PlayerInfo
                            userId={team.owner}
                            alias={team.owner_alias}
                            title={team.owner_title}
                            presentation="name"
                            interactive={false}
                        />
                    </span>
                </div>
            </div>
        </NavLink>
    )
}
