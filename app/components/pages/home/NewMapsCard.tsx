import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow,
    DataTableCell, DataTableEmpty,
} from '@/app/components/shared/DataTable'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { difficultyTextColor, difficultyBgColor } from '@/app/utils/scoreColors'
import { displayMapName } from '@/app/utils/format'
import { cn } from '@/lib/utils'
import type { SummaryNewMap } from '@/app/utils/api'

interface NewMapsCardProps {
    maps: SummaryNewMap[]
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
}

export function NewMapsCard({ maps, favoriteMapNames, onToggleFavorite, onMapSelect }: NewMapsCardProps) {
    return (
        <DataTableShell className="flex-none">
            <DataTableHeaderRow>
                <DataTableHeaderCell width="3.5rem"> </DataTableHeaderCell>
                <DataTableHeaderCell>Map</DataTableHeaderCell>
                <DataTableHeaderCell>Author</DataTableHeaderCell>
                <DataTableHeaderCell align="left" width="6rem">Difficulty</DataTableHeaderCell>
                <DataTableHeaderCell align="right" width="6rem">Added</DataTableHeaderCell>
            </DataTableHeaderRow>
            <tbody>
                {maps.length === 0 ? (
                    <DataTableEmpty colSpan={5} message="No new maps." />
                ) : (
                    maps.map(map => (
                        <DataTableRow
                            key={map.name}
                            onClick={onMapSelect ? () => onMapSelect(map.name) : undefined}
                            className={onMapSelect ? 'cursor-pointer' : undefined}
                        >
                            <DataTableCell>
                                <MapThumbnail mapName={map.name} className="w-12 h-12" />
                            </DataTableCell>
                            <DataTableCell>
                                <div className="flex items-center gap-2 min-w-0">
                                    <FavoriteStar
                                        name={map.name}
                                        isFavorited={favoriteMapNames.has(map.name)}
                                        onToggle={onToggleFavorite}
                                        size="sm"
                                        className="shrink-0"
                                    />
                                    <span className="font-bold text-foreground/90 truncate">
                                        {displayMapName(map.name)}
                                    </span>
                                </div>
                            </DataTableCell>
                            <DataTableCell>
                                <PlayerInfo alias={map.author} size="sm" />
                            </DataTableCell>
                            <DataTableCell>
                                {map.difficulty > 0 ? (
                                    <div className="flex items-center gap-2">
                                        <span className={cn('text-sm font-bold w-4 text-center', difficultyTextColor(map.difficulty))}>
                                            {map.difficulty}
                                        </span>
                                        <div className="w-12 h-1.5 bg-hairline/10 rounded-full overflow-hidden">
                                            <div
                                                className={cn('h-full rounded-full', difficultyBgColor(map.difficulty))}
                                                style={{ width: `${(map.difficulty / 10) * 100}%` }}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground/40">—</span>
                                )}
                            </DataTableCell>
                            <DataTableCell align="right">
                                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                    {map.timeAgo}
                                </span>
                            </DataTableCell>
                        </DataTableRow>
                    ))
                )}
            </tbody>
        </DataTableShell>
    )
}
