import type { MouseEvent } from 'react'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { displayMapName } from '@/app/utils/format'

interface MapNameCellProps {
    mapName: string
    favorited: boolean
    onToggleFavorite: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
}

export function MapNameCell({ mapName, favorited, onToggleFavorite, onMapSelect }: MapNameCellProps) {
    const select = onMapSelect
        ? (e: MouseEvent) => { e.stopPropagation(); onMapSelect(mapName) }
        : undefined

    return (
        <div className="flex items-center gap-2.5 min-w-0">
            <button
                type="button"
                onClick={select}
                disabled={!onMapSelect}
                aria-label={displayMapName(mapName)}
                className="shrink-0 enabled:cursor-pointer"
            >
                <MapThumbnail mapName={mapName} className="size-9 rounded-md" />
            </button>
            <FavoriteStar
                name={mapName}
                isFavorited={favorited}
                onToggle={onToggleFavorite}
                size="sm"
                className="shrink-0"
            />
            <button
                type="button"
                onClick={select}
                disabled={!onMapSelect}
                className="min-w-0 text-left enabled:cursor-pointer group/map"
            >
                <span className="block truncate text-sm font-semibold text-foreground enabled:group-hover/map:underline underline-offset-2">
                    {displayMapName(mapName)}
                </span>
            </button>
        </div>
    )
}
