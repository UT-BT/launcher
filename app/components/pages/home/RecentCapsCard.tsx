import { MessageSquarePlus, Play } from 'lucide-react'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow,
    DataTableCell, DataTableEmpty,
} from '@/app/components/shared/DataTable'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { IconActionButton } from '@/app/components/shared/IconActionButton'
import { Tooltip } from '@/app/components/ui/tooltip'
import { formatCapTime, displayMapName } from '@/app/utils/format'
import { getMedalIcon } from '@/app/utils/medals'
import type { Summary } from '@/app/utils/api'

type Achievement = Summary['achievements'][number]

interface RecentCapsCardProps {
    achievements: Achievement[]
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
    onReview?: (mapName: string) => void
    onWatchReplay?: (achievement: Achievement) => void
    loadingCapId?: string | null
}

export function RecentCapsCard({
    achievements, favoriteMapNames, onToggleFavorite, onMapSelect, onReview, onWatchReplay, loadingCapId,
}: RecentCapsCardProps) {
    return (
        <DataTableShell className="flex-none">
            <DataTableHeaderRow>
                <DataTableHeaderCell width="3.5rem"> </DataTableHeaderCell>
                <DataTableHeaderCell>Map</DataTableHeaderCell>
                <DataTableHeaderCell>Author</DataTableHeaderCell>
                <DataTableHeaderCell align="right">Time</DataTableHeaderCell>
                <DataTableHeaderCell align="right" width="6rem">When</DataTableHeaderCell>
                <DataTableHeaderCell align="center" width="3rem"> </DataTableHeaderCell>
                <DataTableHeaderCell align="center" width="3rem"> </DataTableHeaderCell>
            </DataTableHeaderRow>
            <tbody>
                {achievements.length === 0 ? (
                    <DataTableEmpty colSpan={7} message="No recent caps. Head to a server and start capping!" />
                ) : (
                    achievements.map(ach => {
                        const medalIcon = getMedalIcon(ach.medal)
                        const timeVal = Number(ach.time)
                        const timeStr = !isNaN(timeVal) ? formatCapTime(timeVal) : String(ach.time)

                        return (
                            <DataTableRow
                                key={ach.id}
                                onClick={onMapSelect ? () => onMapSelect(ach.mapName) : undefined}
                                className={onMapSelect ? 'cursor-pointer' : undefined}
                            >
                                <DataTableCell>
                                    <MapThumbnail mapName={ach.mapName} className="w-12 h-12" />
                                </DataTableCell>
                                <DataTableCell>
                                    <div className="flex items-center gap-2">
                                        <FavoriteStar
                                            name={ach.mapName}
                                            isFavorited={favoriteMapNames.has(ach.mapName)}
                                            onToggle={onToggleFavorite}
                                            size="sm"
                                            className="shrink-0"
                                        />
                                        <span className="font-bold text-white/90 truncate">
                                            {displayMapName(ach.mapName)}
                                        </span>
                                    </div>
                                </DataTableCell>
                                <DataTableCell>
                                    <PlayerInfo alias={ach.author} size="sm" />
                                </DataTableCell>
                                <DataTableCell align="right">
                                    <div className="flex items-center justify-end gap-2">
                                        {medalIcon && (
                                            <Tooltip content={ach.medal} side="top">
                                                <img
                                                    src={medalIcon}
                                                    alt={ach.medal}
                                                    className="h-4 w-auto object-contain shrink-0"
                                                />
                                            </Tooltip>
                                        )}
                                        <span className="font-mono font-black text-white/90 tracking-tight">
                                            {timeStr}
                                        </span>
                                    </div>
                                </DataTableCell>
                                <DataTableCell align="right">
                                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                        {ach.timeAgo}
                                    </span>
                                </DataTableCell>
                                <DataTableCell align="center" className="px-2">
                                    {onWatchReplay && ach.verified && (
                                        <IconActionButton
                                            variant="replay"
                                            icon={Play}
                                            iconFill
                                            tooltip="Watch run"
                                            loading={loadingCapId === ach.id}
                                            onClick={() => onWatchReplay(ach)}
                                        />
                                    )}
                                </DataTableCell>
                                <DataTableCell align="center" className="px-2">
                                    {onReview && (
                                        <IconActionButton
                                            variant="review"
                                            icon={MessageSquarePlus}
                                            tooltip="Review this map"
                                            onClick={() => onReview(ach.mapName)}
                                        />
                                    )}
                                </DataTableCell>
                            </DataTableRow>
                        )
                    })
                )}
            </tbody>
        </DataTableShell>
    )
}
