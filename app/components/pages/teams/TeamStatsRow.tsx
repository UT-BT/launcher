import { useEffect, useMemo, useState } from 'react'
import { Users2, Trophy, Flag, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchTeamActivity, type TeamDetail, type TeamRanks } from '@/app/utils/api'
import { formatTeamHours } from './teamStats'
import { RankChip } from './TeamMetricRow'

interface TeamStatsRowProps {
    accessToken: string
    team: TeamDetail
}

interface TeamTotals {
    caps: number
    world_records: number
    playtime_seconds: number
    spectator_seconds: number
    ranks: TeamRanks
    ranked_teams: number
}

const EMPTY_RANKS: TeamRanks = { world_records: null, caps: null, playtime: null }
const EMPTY_TOTALS: TeamTotals = {
    caps: 0, world_records: 0, playtime_seconds: 0, spectator_seconds: 0,
    ranks: EMPTY_RANKS, ranked_teams: 0,
}

function StatTile({ icon: Icon, label, value, sub, rank, accent, loading }: {
    icon: LucideIcon
    label: string
    value: string
    sub?: string
    rank?: number | null
    accent: string
    loading?: boolean
}) {
    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className={cn('p-2 rounded-lg bg-hairline/5 shrink-0', accent)}>
                <Icon className="size-4" />
            </div>
            <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                {loading ? (
                    <div className="mt-1 h-5 w-14 bg-hairline/5 rounded animate-pulse" />
                ) : (
                    <>
                        <div className="flex items-center gap-1.5">
                            <span className="text-base sm:text-lg font-bold font-mono tabular-nums text-foreground leading-tight">{value}</span>
                            <RankChip rank={rank} />
                        </div>
                        {sub && <div className="text-[11px] text-muted-foreground tabular-nums leading-tight truncate">{sub}</div>}
                    </>
                )}
            </div>
        </div>
    )
}

export function TeamStatsRow({ accessToken, team }: TeamStatsRowProps) {
    const hasMembers = useMemo(() => team.members.some(m => m.status === 'active'), [team.members])
    const [totals, setTotals] = useState<TeamTotals | null>(null)

    useEffect(() => {
        if (!hasMembers) {
            setTotals(EMPTY_TOTALS)
            return
        }
        let cancelled = false
        fetchTeamActivity(accessToken, team.id, { limit: 1 })
            .then(res => {
                if (cancelled) return
                setTotals({
                    caps: res.caps,
                    world_records: res.world_records,
                    playtime_seconds: res.playtime_seconds,
                    spectator_seconds: res.spectator_seconds,
                    ranks: res.ranks,
                    ranked_teams: res.ranked_teams,
                })
            })
            .catch(() => { if (!cancelled) setTotals(null) })
        return () => { cancelled = true }
    }, [accessToken, team.id, hasMembers])

    const loading = totals === null && hasMembers
    const fmt = (n: number | undefined) => (n == null ? '0' : n.toLocaleString())
    const rankFor = (total: number | undefined, rank: number | null | undefined) => (total ? rank : null)
    const rankSub = (total: number | undefined, rank: number | null | undefined, extra?: string) => {
        const of = rankFor(total, rank) && totals?.ranked_teams
            ? `of ${totals.ranked_teams} teams`
            : undefined
        return [of, extra].filter(Boolean).join(' · ') || undefined
    }

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile icon={Users2} label="Members" value={fmt(team.member_count)} accent="text-accent-300" />
            <StatTile
                icon={Trophy}
                label="World Records"
                value={fmt(totals?.world_records)}
                sub={rankSub(totals?.world_records, totals?.ranks.world_records)}
                rank={rankFor(totals?.world_records, totals?.ranks.world_records)}
                accent="text-blue-300"
                loading={loading}
            />
            <StatTile
                icon={Flag}
                label="Total Caps"
                value={fmt(totals?.caps)}
                sub={rankSub(totals?.caps, totals?.ranks.caps)}
                rank={rankFor(totals?.caps, totals?.ranks.caps)}
                accent="text-amber-300"
                loading={loading}
            />
            <StatTile
                icon={Clock}
                label="Time Played"
                value={formatTeamHours(totals?.playtime_seconds)}
                sub={rankSub(
                    totals?.playtime_seconds,
                    totals?.ranks.playtime,
                    `${formatTeamHours(totals?.spectator_seconds)} spectating`,
                )}
                rank={rankFor(totals?.playtime_seconds, totals?.ranks.playtime)}
                accent="text-cyan-300"
                loading={loading}
            />
        </div>
    )
}
