import { Play, Trophy } from 'lucide-react'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow, DataTableCell,
} from '@/app/components/shared/DataTable'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { MapNameCell } from '@/app/components/shared/MapNameCell'
import { CapTimeLink, openCap } from '@/app/components/shared/CapTimeLink'
import { IconActionButton } from '@/app/components/shared/IconActionButton'
import { cn } from '@/lib/utils'
import type { SummaryWorldRecord } from '@/app/utils/api'

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
        <DataTableShell className="!flex-none">
            <DataTableHeaderRow>
                <DataTableHeaderCell>Map</DataTableHeaderCell>
                <DataTableHeaderCell width="32%">Holder</DataTableHeaderCell>
                <DataTableHeaderCell width="110px" align="right">Time</DataTableHeaderCell>
                <DataTableHeaderCell width="84px" align="right">When</DataTableHeaderCell>
                <DataTableHeaderCell width="52px" align="center" />
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
                            <DataTableCell align="right">
                                <CapTimeLink
                                    capId={r.id}
                                    seconds={r.time}
                                    className="font-mono tabular-nums font-bold text-blue-300"
                                />
                            </DataTableCell>
                            <DataTableCell align="right">
                                <span className="text-xs text-muted-foreground tabular-nums">{r.timeAgo}</span>
                            </DataTableCell>
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
                        </DataTableRow>
                    )
                })}
            </tbody>
        </DataTableShell>
    )
}
