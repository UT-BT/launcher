import { cn } from '@/lib/utils'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { MapNavLink } from '@/app/components/shared/MapNavLink'
import { displayMapName } from '@/app/utils/format'

interface MapNameCellProps {
    mapName: string
    favorited: boolean
    onToggleFavorite: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
}

export function MapNameCell({ mapName, favorited, onToggleFavorite, onMapSelect }: MapNameCellProps) {
    const disabled = !onMapSelect

    return (
        <div className="flex items-center gap-2.5 min-w-0">
            <MapNavLink
                mapName={mapName}
                onMapSelect={onMapSelect}
                ariaLabel={displayMapName(mapName)}
                className={cn('shrink-0', !disabled && 'cursor-pointer')}
            >
                <MapThumbnail mapName={mapName} className="size-9 rounded-md" />
            </MapNavLink>
            <FavoriteStar
                name={mapName}
                isFavorited={favorited}
                onToggle={onToggleFavorite}
                size="sm"
                className="shrink-0"
            />
            <MapNavLink
                mapName={mapName}
                onMapSelect={onMapSelect}
                className={cn('min-w-0 text-left group/map', !disabled && 'cursor-pointer')}
            >
                <span className={cn(
                    'block truncate text-sm font-semibold text-foreground underline-offset-2',
                    !disabled && 'group-hover/map:underline',
                )}>
                    {displayMapName(mapName)}
                </span>
            </MapNavLink>
        </div>
    )
}
