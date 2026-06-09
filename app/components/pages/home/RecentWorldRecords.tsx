import { Play } from 'lucide-react'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow,
    DataTableCell, DataTableEmpty,
} from '@/app/components/shared/DataTable'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { IconActionButton } from '@/app/components/shared/IconActionButton'
import { displayMapName } from '@/app/utils/format'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import type { SummaryWorldRecord } from '@/app/utils/api'

interface RecentWorldRecordsProps {
    records: SummaryWorldRecord[]
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
    onWatchReplay: (record: SummaryWorldRecord) => void
    loadingCapId: string | null
}

export function RecentWorldRecords({
    records, favoriteMapNames, onToggleFavorite, onMapSelect, onWatchReplay, loadingCapId,
}: RecentWorldRecordsProps) {
    return (
        <DataTableShell className="flex-none">
            <DataTableHeaderRow>
                <DataTableHeaderCell width="3.5rem"> </DataTableHeaderCell>
                <DataTableHeaderCell>Map</DataTableHeaderCell>
                <DataTableHeaderCell>Player</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Time</DataTableHeaderCell>
                <DataTableHeaderCell align="right" width="6rem">When</DataTableHeaderCell>
                <DataTableHeaderCell align="center" width="3rem"> </DataTableHeaderCell>
            </DataTableHeaderRow>
            <tbody>
                {records.length === 0 ? (
                    <DataTableEmpty colSpan={6} message="No recent world records." />
                ) : (
                    records.map(r => {
                        const isLoading = loadingCapId === r.id
                        return (
                            <DataTableRow
                                key={r.id}
                                onClick={onMapSelect ? () => onMapSelect(r.mapName) : undefined}
                                className={onMapSelect ? 'cursor-pointer' : undefined}
                            >
                                <DataTableCell>
                                    <MapThumbnail mapName={r.mapName} className="w-12 h-12" />
                                </DataTableCell>
                                <DataTableCell>
                                    <div className="flex items-center gap-2">
                                        <FavoriteStar
                                            name={r.mapName}
                                            isFavorited={favoriteMapNames.has(r.mapName)}
                                            onToggle={onToggleFavorite}
                                            size="sm"
                                            className="shrink-0"
                                        />
                                        <span className="font-bold text-white/90 truncate">{displayMapName(r.mapName)}</span>
                                    </div>
                                </DataTableCell>
                                <DataTableCell>
                                    <PlayerInfo
                                        userId={r.userId ?? undefined}
                                        alias={r.alias}
                                        title={r.activeTitle ?? null}
                                        size="sm"
                                    />
                                </DataTableCell>
                                <DataTableCell align="right">
                                    <CapTimeLink
                                        capId={r.id}
                                        seconds={r.time}
                                        className="font-mono font-black text-white/90 tracking-tight"
                                    />
                                </DataTableCell>
                                <DataTableCell align="right">
                                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                        {r.timeAgo}
                                    </span>
                                </DataTableCell>
                                <DataTableCell align="center" className="px-2">
                                    <IconActionButton
                                        variant="replay"
                                        icon={Play}
                                        iconFill
                                        tooltip="Watch run"
                                        loading={isLoading}
                                        onClick={() => onWatchReplay(r)}
                                    />
                                </DataTableCell>
                            </DataTableRow>
                        )
                    })
                )}
            </tbody>
        </DataTableShell>
    )
}
