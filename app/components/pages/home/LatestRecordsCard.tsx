import { useCallback, useState } from 'react'
import { Play, Trophy } from 'lucide-react'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
    type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { MapNameCell } from '@/app/components/shared/MapNameCell'
import { CapTimeLink, openCap } from '@/app/components/shared/CapTimeLink'
import { IconActionButton } from '@/app/components/shared/IconActionButton'
import { cn } from '@/lib/utils'
import type { SummaryWorldRecord } from '@/app/utils/api'

type RecordColumnId = 'map' | 'holder' | 'time' | 'when' | 'replay'

const RECORD_COLUMNS: ResponsiveColumn[] = [
    { id: 'map', required: true },
    { id: 'holder', width: '32%', priority: 30 },
    { id: 'time', width: '110px', priority: 70 },
    { id: 'when', width: '84px', priority: 20 },
    { id: 'replay', width: '52px', priority: 10 },
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
            responsive={{ columns: RECORD_COLUMNS, onResolve: handleResolve }}
        >
            <DataTableHeaderRow>
                <DataTableHeaderCell align="center" width="16rem">Map</DataTableHeaderCell>
                {isVisible('holder') && <DataTableHeaderCell align="center" width="10rem">Holder</DataTableHeaderCell>}
                {isVisible('time') && <DataTableHeaderCell align="center" width="6rem">Time</DataTableHeaderCell>}
                {isVisible('when') && <DataTableHeaderCell align="center" width="6rem">When</DataTableHeaderCell>}
                {isVisible('replay') && <DataTableHeaderCell align="center" width="4rem" />}
            </DataTableHeaderRow>
            <tbody>
                {rows.map(r => {
                    const isOwn = currentUserId != null && r.userId === currentUserId
                    return (
                        <DataTableRow
                            key={r.id}
                            className={cn('cursor-pointer', isOwn && 'bg-emerald-500/[0.05]')}
                            onClick={() => openCap(r.id)}
                        >
                            <DataTableCell>
                                <MapNameCell
                                    mapName={r.mapName}
                                    favorited={favoriteMapNames.has(r.mapName)}
                                    onToggleFavorite={onToggleFavorite}
                                    onMapSelect={onMapSelect}
                                />
                            </DataTableCell>
                            {isVisible('holder') && (
                                <DataTableCell>
                                    <PlayerInfo
                                        userId={r.userId ?? undefined}
                                        alias={r.alias}
                                        title={r.activeTitle ?? null}
                                        size="sm"
                                        highlight={isOwn}
                                        showYouBadge={isOwn}
                                    />
                                </DataTableCell>
                            )}
                            {isVisible('time') && (
                                <DataTableCell align="center">
                                    <div className="flex justify-center">
                                        <CapTimeLink
                                            capId={r.id}
                                            seconds={r.time}
                                            className="font-mono tabular-nums font-bold text-blue-300"
                                        />
                                    </div>
                                </DataTableCell>
                            )}
                            {isVisible('when') && (
                                <DataTableCell>
                                    <div className="flex justify-center">
                                        <span className="text-xs text-muted-foreground tabular-nums">{r.timeAgo}</span>
                                    </div>
                                </DataTableCell>
                            )}
                            {isVisible('replay') && (
                                <DataTableCell align="center">
                                    <IconActionButton
                                        variant="replay"
                                        icon={Play}
                                        iconFill
                                        tooltip="Watch replay"
                                        loading={loadingCapId === r.id}
                                        onClick={() => onWatchReplay(r)}
                                    />
                                </DataTableCell>
                            )}
                        </DataTableRow>
                    )
                })}
            </tbody>
        </DataTableShell>
    )
}
