import { useEffect, useMemo, useState } from 'react'
import { Users2, Trophy, Flag, CalendarDays } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatAddedDate } from '@/app/utils/format'
import { fetchTeamActivity, type TeamDetail } from '@/app/utils/api'

interface TeamStatsRowProps {
    accessToken: string
    team: TeamDetail
}

function StatTile({ icon: Icon, label, value, accent, loading }: {
    icon: LucideIcon
    label: string
    value: string
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
                    <div className="text-lg font-bold font-mono tabular-nums text-foreground leading-tight truncate">{value}</div>
                )}
            </div>
        </div>
    )
}

export function TeamStatsRow({ accessToken, team }: TeamStatsRowProps) {
    const hasMembers = useMemo(() => team.members.some(m => m.status === 'active'), [team.members])
    const [counts, setCounts] = useState<{ caps: number; world_records: number } | null>(null)

    useEffect(() => {
        if (!hasMembers) {
            setCounts({ caps: 0, world_records: 0 })
            return
        }
        let cancelled = false
        fetchTeamActivity(accessToken, team.id, { limit: 1 })
            .then(res => { if (!cancelled) setCounts({ caps: res.caps, world_records: res.world_records }) })
            .catch(() => { if (!cancelled) setCounts(null) })
        return () => { cancelled = true }
    }, [accessToken, team.id, hasMembers])

    const loading = counts === null && hasMembers
    const fmt = (n: number | undefined) => (n == null ? '0' : n.toLocaleString())

    return (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatTile icon={Users2} label="Members" value={team.member_count.toLocaleString()} accent="text-accent-300" />
            <StatTile icon={Trophy} label="World Records" value={fmt(counts?.world_records)} accent="text-blue-300" loading={loading} />
            <StatTile icon={Flag} label="Total Caps" value={fmt(counts?.caps)} accent="text-amber-300" loading={loading} />
            <StatTile icon={CalendarDays} label="Created" value={team.added ? formatAddedDate(team.added) : '—'} accent="text-emerald-300" />
        </div>
    )
}
