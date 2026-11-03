import { useCallback, useMemo, useState, useEffect } from 'react'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
    DataTableEmpty, DataTableSkeletonRow, type ColumnTier, type ResponsiveColumn, type SortDirection,
} from '@/app/components/shared/DataTable'
import { PlayerInfo, openPlayer } from '@/app/components/shared/PlayerInfo'
import { CapTimeLink, openCap } from '@/app/components/shared/CapTimeLink'
import { useNavState } from '@/app/components/navigation/useNavState'
import { cn } from '@/lib/utils'
import { displayMapName, formatTimeAgo } from '@/app/utils/format'
import { fetchTeamActivity, type TeamActivityItem, type TeamActivityType } from '@/app/utils/api'
import { SectionHeader, teamErrorMessage } from './teamsShared'

const FEED_LIMIT = 15

type ActSortField = 'player' | 'type' | 'map' | 'when'
type ActColumnId = ActSortField | 'result'

const COLUMNS: (ResponsiveColumn & { id: ActColumnId; tier: ColumnTier; label: string })[] = [
    { id: 'player', width: '15rem', priority: 60, required: true, tier: 'essential', label: 'Player' },
    { id: 'type', width: '4.5rem', priority: 35, tier: 'essential', label: 'Type' },
    { id: 'map', width: '10rem', priority: 55, required: true, tier: 'essential', label: 'Map' },
    { id: 'result', width: '6rem', priority: 60, tier: 'detail', label: 'Result' },
    { id: 'when', width: '5rem', priority: 50, tier: 'essential', label: 'When' },
]

const CELL_ALIGN: Partial<Record<ActColumnId, 'right'>> = { result: 'right', when: 'right' }

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

    const rowKeys = useMemo(
        () => new Map(items.map((item, i) => [item, `${item.type}-${item.cap_id ?? item.user}-${item.added}-${i}`])),
        [items],
    )
    const rowKey = (item: TeamActivityItem) => rowKeys.get(item) ?? ''

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

    const openItem = (item: TeamActivityItem) => (item.cap_id ? openCap(item.cap_id) : openPlayer(item.user))

    const isOwnItem = (item: TeamActivityItem) => selfUserId != null && String(item.user) === String(selfUserId)

    const activityCell = (id: ActColumnId, item: TeamActivityItem): React.ReactNode => {
        switch (id) {
            case 'player': {
                const isOwn = isOwnItem(item)
                return <PlayerInfo userId={item.user} alias={item.alias} title={item.title} size="sm" highlight={isOwn} showYouBadge={isOwn} />
            }
            case 'type': {
                const badge = TYPE_BADGE[item.type]
                return <span className={cn('text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', badge.className)}>{badge.label}</span>
            }
            case 'map':
                return <span className="text-foreground truncate block">{item.map ? displayMapName(item.map) : '—'}</span>
            case 'result':
                return resultFor(item)
            case 'when':
                return <span className="text-xs text-muted-foreground tabular-nums">{item.added ? formatTimeAgo(item.added) : ''}</span>
        }
    }

    const columns: ResponsiveColumn<TeamActivityItem>[] = COLUMNS.map(column => ({
        ...column,
        sortKey: column.id === 'result' ? undefined : column.id,
        cell: item => activityCell(column.id, item),
    }))

    const activityFace = (item: TeamActivityItem) => {
        const badge = TYPE_BADGE[item.type]
        return (
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
                <div className="min-w-0 space-y-1.5">
                    {activityCell('player', item)}
                    <div className="flex items-center gap-2 min-w-0">
                        <span className={cn('shrink-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border', badge.className)}>{badge.label}</span>
                        <span className="text-sm text-foreground truncate">{item.map ? displayMapName(item.map) : '—'}</span>
                    </div>
                </div>
                <div className="flex items-center">{activityCell('when', item)}</div>
            </div>
        )
    }

    const cardPlaceholder = loading ? (
        Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 mx-3 my-2 rounded-lg bg-hairline/5 animate-pulse" />
        ))
    ) : sorted.length === 0 ? (
        <div className="px-4 py-12 text-center text-sm text-muted-foreground">
            No recent activity from this team yet.
        </div>
    ) : undefined

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
                    columns,
                    onResolve: handleResolve,
                    compactAriaLabel: 'Team activity',
                    cards: {
                        rows: sorted,
                        rowKey,
                        face: activityFace,
                        onOpen: openItem,
                        rowClassName: item => (isOwnItem(item) ? 'bg-emerald-500/[0.05]' : undefined),
                        placeholder: cardPlaceholder,
                        sort: { key: sort.by, direction: sort.dir, onSort: key => handleSort(key as ActSortField) },
                    },
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
                        sorted.map(item => (
                            <DataTableRow key={rowKey(item)} className={cn(isOwnItem(item) && 'bg-emerald-500/[0.05]')}>
                                {COLUMNS.filter(column => isVisible(column.id)).map(column => (
                                    <DataTableCell key={column.id} align={CELL_ALIGN[column.id]}>{activityCell(column.id, item)}</DataTableCell>
                                ))}
                            </DataTableRow>
                        ))
                    )}
                </tbody>
            </DataTableShell>
        </section>
    )
}
