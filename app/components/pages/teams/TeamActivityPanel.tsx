import { useCallback, useMemo, useState, useEffect } from 'react'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
    DataTableEmpty, DataTableSkeletonRow, type ResponsiveColumn, type SortDirection,
} from '@/app/components/shared/DataTable'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import { useNavState } from '@/app/components/navigation/useNavState'
import { cn } from '@/lib/utils'
import { displayMapName, formatTimeAgo } from '@/app/utils/format'
import { fetchTeamActivity, type TeamActivityItem, type TeamActivityType } from '@/app/utils/api'
import { SectionHeader, teamErrorMessage } from './teamsShared'

const FEED_LIMIT = 15

type ActSortField = 'player' | 'type' | 'map' | 'when'

const COLUMNS: ResponsiveColumn[] = [
    { id: 'player', width: '15rem', priority: 60, required: true },
    { id: 'type', width: '4.5rem', priority: 35 },
    { id: 'map', width: '10rem', priority: 55, required: true },
    { id: 'result', width: '6rem', priority: 60 },
    { id: 'when', width: '5rem', priority: 50 },
]

const DEFAULT_DIR: Record<ActSortField, 'asc' | 'desc'> = { player: 'asc', type: 'asc', map: 'asc', when: 'desc' }

const TYPE_BADGE: Record<TeamActivityType, { label: string; className: string }> = {
    cap: { label: 'Cap', className: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
    world_record: { label: 'WR', className: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
    playtime: { label: 'Play', className: 'bg-violet-500/15 text-violet-300 border-violet-500/30' },
}

interface TeamActivityPanelProps {
    accessToken: string
    teamId: string
    hasMembers: boolean
    selfUserId?: string
}

function formatDuration(seconds: number): string {
    const minutes = Math.max(1, Math.round(seconds / 60))
    if (minutes < 60) return `${minutes}m`
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest ? `${hours}h ${rest}m` : `${hours}h`
}

export function TeamActivityPanel({ accessToken, teamId, hasMembers, selfUserId }: TeamActivityPanelProps) {
    const [items, setItems] = useState<TeamActivityItem[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [sort, setSort] = useNavState<{ by: ActSortField; dir: 'asc' | 'desc' }>(`team-activity-sort-${teamId}`, { by: 'when', dir: 'desc' })

    const [resolved, setResolved] = useState<Set<string> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => setResolved(ids), [])
    const isVisible = (id: string) => !resolved || resolved.has(id)
    const visibleCount = COLUMNS.filter(c => isVisible(c.id)).length

    useEffect(() => {
        if (!hasMembers) {
            setItems([])
            setLoading(false)
            return
        }
        let cancelled = false
        setLoading(true)
        setError(null)
        fetchTeamActivity(accessToken, teamId, { limit: FEED_LIMIT })
            .then(res => { if (!cancelled) setItems(res.items) })
            .catch(e => { if (!cancelled) setError(teamErrorMessage(e)) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [accessToken, teamId, hasMembers])

    const sorted = useMemo(() => {
        const arr = [...items]
        const mul = sort.dir === 'asc' ? 1 : -1
        arr.sort((a, b) => {
            let c = 0
            switch (sort.by) {
                case 'player': c = (a.alias || a.user).localeCompare(b.alias || b.user); break
                case 'type': c = a.type.localeCompare(b.type); break
                case 'map': c = (a.map || '').localeCompare(b.map || ''); break
                case 'when': c = (a.added || '').localeCompare(b.added || ''); break
            }
            return c * mul
        })
        return arr
    }, [items, sort])

    const handleSort = (field: ActSortField) => {
        setSort(sort.by === field ? { by: field, dir: sort.dir === 'asc' ? 'desc' : 'asc' } : { by: field, dir: DEFAULT_DIR[field] })
    }
    const dirFor = (field: ActSortField): SortDirection => (sort.by === field ? sort.dir : null)

    const resultFor = (item: TeamActivityItem) => {
        if (item.type === 'playtime') {
            return item.time_played_seconds != null
                ? <span className="text-xs text-muted-foreground tabular-nums">{formatDuration(item.time_played_seconds)}</span>
                : <span className="text-muted-foreground/40">—</span>
        }
        if (item.cap_time_seconds == null) return <span className="text-muted-foreground/40">—</span>
        return (
            <CapTimeLink
                capId={item.cap_id}
                seconds={item.cap_time_seconds}
                className={cn('font-mono tabular-nums font-bold', item.type === 'world_record' ? 'text-blue-300' : 'text-amber-300')}
            />
        )
    }

    const compactRows = loading ? (
        Array.from({ length: 8 }).map((_, i) => (
            <div key={i} role="listitem" className="p-3 border-b border-hairline/5 last:border-0 animate-pulse">
                <div className="h-10 rounded bg-hairline/5" />
            </div>
        ))
    ) : sorted.length === 0 ? (
        <div role="listitem" className="px-4 py-12 text-center text-sm text-muted-foreground">
            No recent activity from this team yet.
        </div>
    ) : sorted.map((item, i) => {
        const isOwn = selfUserId != null && String(item.user) === String(selfUserId)
        const badge = TYPE_BADGE[item.type]
        return (
            <div
                key={`${item.type}-${item.cap_id ?? item.user}-${item.added}-${i}`}
                role="listitem"
                className={cn('grid grid-cols-[minmax(0,1fr)_auto] gap-3 p-3 border-b border-hairline/5 last:border-0', isOwn && 'bg-emerald-500/[0.05]')}
            >
                <div className="min-w-0 space-y-1.5">
                    <PlayerInfo userId={item.user} alias={item.alias} title={item.title} size="sm" highlight={isOwn} showYouBadge={isOwn} />
                    <div className="flex items-center gap-2 min-w-0">
                        <span className={cn('shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', badge.className)}>{badge.label}</span>
                        <span className="text-sm text-foreground truncate">{item.map ? displayMapName(item.map) : '—'}</span>
                    </div>
                </div>
                <div className="flex flex-col items-end justify-between gap-1.5">
                    {resultFor(item)}
                    <span className="text-xs text-muted-foreground tabular-nums">{item.added ? formatTimeAgo(item.added) : ''}</span>
                </div>
            </div>
        )
    })

    return (
        <section>
            <SectionHeader
                title="Recent Activity"
                subtitle="Caps, world records and playtime across the team"
                accentClass="bg-amber-400"
            />

            {error && <div className="mb-2 p-2.5 bg-red-500/10 border border-red-500/30 rounded-lg text-red-300 text-xs">{error}</div>}

            <DataTableShell
                className="!flex-none"
                responsive={{
                    columns: COLUMNS,
                    onResolve: handleResolve,
                    compactContent: compactRows,
                    compactAriaLabel: 'Team activity',
                }}
            >
                <DataTableHeaderRow>
                    <DataTableHeaderCell width="15rem" sortable sortDirection={dirFor('player')} onSort={() => handleSort('player')}>Player</DataTableHeaderCell>
                    {isVisible('type') && <DataTableHeaderCell width="4.5rem" sortable sortDirection={dirFor('type')} onSort={() => handleSort('type')}>Type</DataTableHeaderCell>}
                    <DataTableHeaderCell width="10rem" sortable sortDirection={dirFor('map')} onSort={() => handleSort('map')}>Map</DataTableHeaderCell>
                    {isVisible('result') && <DataTableHeaderCell align="right" width="6rem">Result</DataTableHeaderCell>}
                    {isVisible('when') && <DataTableHeaderCell align="right" width="5rem" sortable sortDirection={dirFor('when')} onSort={() => handleSort('when')}>When</DataTableHeaderCell>}
                </DataTableHeaderRow>
                <tbody>
                    {loading ? (
                        Array.from({ length: 8 }).map((_, i) => <DataTableSkeletonRow key={i} columnCount={visibleCount} />)
                    ) : sorted.length === 0 ? (
                        <DataTableEmpty colSpan={visibleCount} message="No recent activity from this team yet." />
                    ) : (
                        sorted.map((item, i) => {
                            const isOwn = selfUserId != null && String(item.user) === String(selfUserId)
                            const badge = TYPE_BADGE[item.type]
                            return (
                                <DataTableRow key={`${item.type}-${item.cap_id ?? item.user}-${item.added}-${i}`} className={cn(isOwn && 'bg-emerald-500/[0.05]')}>
                                    <DataTableCell>
                                        <PlayerInfo userId={item.user} alias={item.alias} title={item.title} size="sm" highlight={isOwn} showYouBadge={isOwn} />
                                    </DataTableCell>
                                    {isVisible('type') && (
                                        <DataTableCell>
                                            <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', badge.className)}>{badge.label}</span>
                                        </DataTableCell>
                                    )}
                                    <DataTableCell>
                                        <span className="text-foreground truncate block">{item.map ? displayMapName(item.map) : '—'}</span>
                                    </DataTableCell>
                                    {isVisible('result') && <DataTableCell align="right">{resultFor(item)}</DataTableCell>}
                                    {isVisible('when') && (
                                        <DataTableCell align="right">
                                            <span className="text-xs text-muted-foreground tabular-nums">{item.added ? formatTimeAgo(item.added) : ''}</span>
                                        </DataTableCell>
                                    )}
                                </DataTableRow>
                            )
                        })
                    )}
                </tbody>
            </DataTableShell>
        </section>
    )
}
