import { Play, Loader2 } from 'lucide-react'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow,
    DataTableCell, DataTableEmpty,
} from '@/app/components/shared/DataTable'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { Tooltip } from '@/app/components/ui/tooltip'
import { formatCapTime } from '@/app/utils/format'
import type { SummaryWorldRecord } from '@/app/utils/api'

interface RecentWorldRecordsProps {
    records: SummaryWorldRecord[]
    onMapSelect?: (mapName: string) => void
    onWatchReplay: (record: SummaryWorldRecord) => void
    loadingCapId: string | null
}

export function RecentWorldRecords({
    records, onMapSelect, onWatchReplay, loadingCapId,
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
                                    <span className="font-bold text-white/90">{r.mapName.replace('CTF-BT-', '').replace('CTF-BT+', '')}</span>
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
                                    <span className="font-mono font-black text-white/90 tracking-tight">
                                        {formatCapTime(r.time)}
                                    </span>
                                </DataTableCell>
                                <DataTableCell align="right">
                                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                        {r.timeAgo}
                                    </span>
                                </DataTableCell>
                                <DataTableCell align="center" className="px-2">
                                    <Tooltip content={isLoading ? 'Loading…' : 'Watch run'} side="top">
                                        <button
                                            type="button"
                                            disabled={isLoading}
                                            onClick={e => {
                                                e.stopPropagation()
                                                onWatchReplay(r)
                                            }}
                                            className="inline-flex items-center justify-center size-7 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 hover:border-amber-500/60 transition-colors disabled:opacity-40 cursor-pointer"
                                        >
                                            {isLoading
                                                ? <Loader2 className="size-3 animate-spin" />
                                                : <Play className="size-3 fill-current" />
                                            }
                                        </button>
                                    </Tooltip>
                                </DataTableCell>
                            </DataTableRow>
                        )
                    })
                )}
            </tbody>
        </DataTableShell>
    )
}
