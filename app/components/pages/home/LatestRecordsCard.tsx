import { useCallback, useState } from 'react'
import { Play, Trophy } from 'lucide-react'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
    type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { TeamAvatarStack, teamRosterLabel } from '@/app/components/shared/TeamAvatarStack'
import { TeamHolders } from '@/app/components/shared/TeamHolders'
import { MapNameCell } from '@/app/components/shared/MapNameCell'
import { CapTimeLink, openCap, openTeamCap } from '@/app/components/shared/CapTimeLink'
import { IconActionButton } from '@/app/components/shared/IconActionButton'
import { cn } from '@/lib/utils'
import type { SummaryWorldRecord } from '@/app/utils/api'

type RecordColumnId = 'map' | 'holder' | 'time' | 'when' | 'replay'

const RECORD_COLUMNS: (Omit<ResponsiveColumn, 'id'> & { id: RecordColumnId; align?: 'center' })[] = [
    { id: 'map', required: true, tier: 'essential', label: 'Map' },
    { id: 'holder', width: '9rem', priority: 30, required: true, tier: 'essential', label: 'Holder' },
    { id: 'time', width: '5rem', priority: 70, required: true, tier: 'essential', label: 'Time', align: 'center' },
    { id: 'when', width: '7rem', priority: 10, tier: 'essential', label: 'When' },
    { id: 'replay', width: '3rem', priority: 20, tier: 'essential', label: 'Watch replay', align: 'center' },
]

interface LatestRecordsCardProps {
    records: SummaryWorldRecord[]
    currentUserId?: string | null
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
    onWatchReplay: (record: SummaryWorldRecord) => void
    loadingCapId: string | null
    limit?: number
}

export function LatestRecordsCard({
    records, currentUserId, favoriteMapNames, onToggleFavorite,
    onMapSelect, onWatchReplay, loadingCapId, limit = 5,
}: LatestRecordsCardProps) {
    const rows = records.slice(0, limit)

    const [resolved, setResolved] = useState<Set<RecordColumnId> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => { setResolved(ids as Set<RecordColumnId>) }, [])
    const isVisible = (id: RecordColumnId) => !resolved || resolved.has(id)

    const isOwnRecord = (r: SummaryWorldRecord) => currentUserId != null && r.userId === currentUserId
    const isTeamRecord = (r: SummaryWorldRecord) => !!(r.members && r.members.length > 0)
    const openRecord = (r: SummaryWorldRecord) => isTeamRecord(r) ? openTeamCap(r.id) : openCap(r.id)

    const recordCell = (id: RecordColumnId, r: SummaryWorldRecord): React.ReactNode => {
        switch (id) {
            case 'map':
                return (
                    <MapNameCell
                        mapName={r.mapName}
                        favorited={favoriteMapNames.has(r.mapName)}
                        onToggleFavorite={onToggleFavorite}
                        onMapSelect={onMapSelect}
                    />
                )
            case 'holder':
                return isTeamRecord(r) ? (
                    <TeamAvatarStack
                        members={r.members ?? []}
                        currentUserId={currentUserId}
                    />
                ) : (
                    <PlayerInfo
                        userId={r.userId ?? undefined}
                        alias={r.alias}
                        title={r.activeTitle ?? null}
                        size="sm"
                        highlight={isOwnRecord(r)}
                        showYouBadge={isOwnRecord(r)}
                    />
                )
            case 'time':
                return (
                    <div className="flex justify-center">
                        <CapTimeLink
                            capId={isTeamRecord(r) ? undefined : r.id}
                            teamCapId={isTeamRecord(r) ? r.id : undefined}
                            seconds={r.time}
                            className="font-mono tabular-nums font-bold text-blue-300"
                        />
                    </div>
                )
            case 'when':
                return (
                    <div className="flex justify-center">
                        <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">{r.timeAgo}</span>
                    </div>
                )
            case 'replay':
                return (
                    <div className="flex justify-center">
                        <IconActionButton
                            variant="replay"
                            icon={Play}
                            iconFill
                            tooltip="Watch Replay"
                            loading={loadingCapId === r.id}
                            onClick={() => onWatchReplay(r)}
                        />
                    </div>
                )
        }
    }

    const columns: ResponsiveColumn<SummaryWorldRecord>[] = RECORD_COLUMNS.map(({ align: _align, ...column }) => ({
        ...column,
        cell: r => recordCell(column.id, r),
    }))

    const recordFace = (r: SummaryWorldRecord) => (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
            <div className="min-w-0 space-y-2">
                {recordCell('map', r)}
                {isTeamRecord(r) ? (
                    <div role="group" aria-label={teamRosterLabel(r.members ?? [])}>
                        <TeamHolders members={r.members ?? []} currentUserId={currentUserId} />
                    </div>
                ) : recordCell('holder', r)}
            </div>
            <div className="flex flex-col items-end justify-between gap-2">
                {recordCell('time', r)}
                <div className="flex items-center gap-2">
                    {recordCell('when', r)}
                    {recordCell('replay', r)}
                </div>
            </div>
        </div>
    )

    if (rows.length === 0) {
        return (
            <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Trophy className="size-7 text-blue-300/70" />
                <p className="text-sm font-semibold text-foreground/80">No world records yet</p>
                <p className="text-xs text-muted-foreground">Be the first to set one.</p>
            </div>
        )
    }

    return (
        <DataTableShell
            className="!flex-none"
            responsive={{
                columns,
                onResolve: handleResolve,
                compactAriaLabel: 'Latest world records',
                cards: {
                    rows,
                    rowKey: r => r.id,
                    face: recordFace,
                    onOpen: openRecord,
                    rowClassName: r => isOwnRecord(r) ? 'bg-emerald-500/[0.05]' : undefined,
                },
            }}
        >
            <DataTableHeaderRow>
                <DataTableHeaderCell align="center">Map</DataTableHeaderCell>
                {isVisible('holder') && <DataTableHeaderCell align="center" width="9rem">Holder</DataTableHeaderCell>}
                {isVisible('time') && <DataTableHeaderCell align="center" width="5rem">Time</DataTableHeaderCell>}
                {isVisible('when') && <DataTableHeaderCell align="center" width="7rem">When</DataTableHeaderCell>}
                {isVisible('replay') && <DataTableHeaderCell align="center" width="3rem" />}
            </DataTableHeaderRow>
            <tbody>
                {rows.map(r => (
                    <DataTableRow
                        key={r.id}
                        className={cn('cursor-pointer', isOwnRecord(r) && 'bg-emerald-500/[0.05]')}
                        onClick={() => openRecord(r)}
                    >
                        {RECORD_COLUMNS.filter(column => isVisible(column.id)).map(column => (
                            <DataTableCell key={column.id} align={column.align}>
                                {recordCell(column.id, r)}
                            </DataTableCell>
                        ))}
                    </DataTableRow>
                ))}
            </tbody>
        </DataTableShell>
    )
}
