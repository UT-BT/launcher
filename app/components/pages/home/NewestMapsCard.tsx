import { Map as MapIcon } from 'lucide-react'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { cn } from '@/lib/utils'
import { displayMapName } from '@/app/utils/format'
import { difficultyTextColor } from '@/app/utils/scoreColors'
import type { SummaryNewMap } from '@/app/utils/api'

interface NewestMapsCardProps {
    maps: SummaryNewMap[]
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
    limit?: number
}

export function NewestMapsCard({ maps, favoriteMapNames, onToggleFavorite, onMapSelect, limit = 5 }: NewestMapsCardProps) {
    const rows = maps.slice(0, limit)

    if (rows.length === 0) {
        return (
            <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col items-center justify-center gap-2 py-8 text-center">
                <MapIcon className="size-6 text-accent-300/70" />
                <p className="text-xs text-muted-foreground">No new maps yet.</p>
            </div>
        )
    }

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl overflow-hidden">
            {rows.map(map => (
                <div
                    key={map.name}
                    className={cn(
                        'flex items-center gap-3 px-3 py-2.5 h-16 border-b border-hairline/5 last:border-0 transition-colors',
                        onMapSelect && 'hover:bg-hairline/[0.03]',
                    )}
                >
                    <button
                        type="button"
                        onClick={onMapSelect ? () => onMapSelect(map.name) : undefined}
                        disabled={!onMapSelect}
                        aria-label={displayMapName(map.name)}
                        className="shrink-0 enabled:cursor-pointer"
                    >
                        <MapThumbnail mapName={map.name} className="size-10 rounded-md" />
                    </button>
                    <div className="flex items-center gap-1 min-w-0">
                        <FavoriteStar
                            name={map.name}
                            isFavorited={favoriteMapNames.has(map.name)}
                            onToggle={onToggleFavorite}
                            size="sm"
                        />
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 min-w-0">
                            <button
                                type="button"
                                onClick={onMapSelect ? () => onMapSelect(map.name) : undefined}
                                disabled={!onMapSelect}
                                className="min-w-0 truncate text-left text-sm font-semibold text-foreground leading-tight enabled:cursor-pointer enabled:hover:underline underline-offset-2"
                            >
                                {displayMapName(map.name)}
                            </button>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
                            <span className="truncate">{map.author ? `by ${map.author}` : 'Community map'}</span>
                            <span className="shrink-0 text-muted-foreground/60">· {map.timeAgo}</span>
                        </div>
                    </div>
                    {map.difficulty > 0 && (
                        <span className={cn('shrink-0 text-xs font-black tabular-nums', difficultyTextColor(map.difficulty))}>
                            R{map.difficulty}
                        </span>
                    )}
                </div>
            ))}
        </div>
    )
}
