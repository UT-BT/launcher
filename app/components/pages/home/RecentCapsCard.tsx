import { MessageSquarePlus } from 'lucide-react'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow,
    DataTableCell, DataTableEmpty,
} from '@/app/components/shared/DataTable'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { Button } from '@/app/components/ui/button'
import { Tooltip } from '@/app/components/ui/tooltip'
import { formatCapTime } from '@/app/utils/format'
import { getMedalIcon } from '@/app/utils/medals'
import type { Summary } from '@/app/utils/api'

type Achievement = Summary['achievements'][number]

interface RecentCapsCardProps {
    achievements: Achievement[]
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
    onReview?: (mapName: string) => void
}

export function RecentCapsCard({
    achievements, favoriteMapNames, onToggleFavorite, onMapSelect, onReview,
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
            </DataTableHeaderRow>
            <tbody>
                {achievements.length === 0 ? (
                    <DataTableEmpty colSpan={6} message="No recent caps. Head to a server and start capping!" />
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
                                        <span className="font-bold text-white/90 truncate">
                                            {ach.mapName.replace('CTF-BT-', '')}
                                        </span>
                                        {medalIcon && (
                                            <img
                                                src={medalIcon}
                                                alt={ach.medal}
                                                title={ach.medal}
                                                className="h-4 w-auto object-contain shrink-0"
                                            />
                                        )}
                                        <FavoriteStar
                                            name={ach.mapName}
                                            isFavorited={favoriteMapNames.has(ach.mapName)}
                                            onToggle={onToggleFavorite}
                                            size="sm"
                                        />
                                    </div>
                                </DataTableCell>
                                <DataTableCell>
                                    <PlayerInfo alias={ach.author} size="sm" />
                                </DataTableCell>
                                <DataTableCell align="right">
                                    <span className="font-mono font-black text-white/90 tracking-tight">
                                        {timeStr}
                                    </span>
                                </DataTableCell>
                                <DataTableCell align="right">
                                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                        {ach.timeAgo}
                                    </span>
                                </DataTableCell>
                                <DataTableCell align="center" className="px-2">
                                    {onReview && (
                                        <Tooltip content="Review this map" side="top">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={e => {
                                                    e.stopPropagation()
                                                    onReview(ach.mapName)
                                                }}
                                                className="inline-flex items-center justify-center size-7 rounded-md bg-orange-500/10 border border-orange-500/30 text-orange-300 hover:bg-orange-500/25 hover:border-orange-500/60 transition-colors cursor-pointer"
                                            >
                                                <MessageSquarePlus className="size-3" />
                                            </Button>
                                        </Tooltip>
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
