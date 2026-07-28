import { Clock, Eye, Flame } from 'lucide-react'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { cn } from '@/lib/utils'
import { displayMapName } from '@/app/utils/format'
import { difficultyTextColor } from '@/app/utils/scoreColors'
import type { HotMap } from '@/app/utils/api'

interface HottestPosterGridProps {
    maps: HotMap[]
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
    limit?: number
}

function formatDuration(seconds: number): string {
    if (seconds >= 3600) return `${(seconds / 3600).toFixed(1)}h`
    if (seconds >= 60) return `${Math.round(seconds / 60)}m`
    return `${Math.round(seconds)}s`
}

export function HottestPosterGrid({ maps, favoriteMapNames, onToggleFavorite, onMapSelect, limit = 6 }: HottestPosterGridProps) {
    if (maps.length === 0) {
        return (
            <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col items-center justify-center gap-2 py-8 text-center">
                <Flame className="size-6 text-accent-300/70" />
                <p className="text-xs text-muted-foreground">Map activity will show up here once people start playing.</p>
            </div>
        )
    }

    const tiles = maps.slice(0, limit)

    return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {tiles.map(map => (
                <div
                    key={map.name}
                    className="group relative rounded-xl overflow-hidden border border-hairline/5 bg-card/30 hover:border-hairline/20 transition-colors"
                >
                    <button
                        type="button"
                        onClick={onMapSelect ? () => onMapSelect(map.name) : undefined}
                        disabled={!onMapSelect}
                        aria-label={displayMapName(map.name)}
                        className="block w-full enabled:cursor-pointer"
                    >
                        <MapThumbnail
                            mapName={map.name}
                            size="card"
                            priority
                            className="w-full aspect-square rounded-none border-0 transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                    </button>
                    <div className="p-2.5 space-y-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <button
                                type="button"
                                onClick={onMapSelect ? () => onMapSelect(map.name) : undefined}
                                disabled={!onMapSelect}
                                className="min-w-0 text-left enabled:cursor-pointer group/name"
                            >
                                <span className="block truncate text-sm font-semibold text-foreground group-hover/name:underline underline-offset-2">
                                    {displayMapName(map.name)}
                                </span>
                            </button>
                            <FavoriteStar
                                name={map.name}
                                isFavorited={favoriteMapNames.has(map.name)}
                                onToggle={onToggleFavorite}
                                size="sm"
                            />
                            {map.difficulty != null && map.difficulty > 0 && (
                                <span className={cn(
                                    'shrink-0 ml-auto text-[11px] font-black tabular-nums',
                                    difficultyTextColor(map.difficulty),
                                )}>
                                    R{map.difficulty}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Clock className="size-3 text-emerald-400 shrink-0" />
                            <span className="font-mono tabular-nums">{formatDuration(map.ingameSeconds)}</span>
                            <Eye className="size-3 text-amber-400 shrink-0 ml-1" />
                            <span className="font-mono tabular-nums">{formatDuration(map.spectateSeconds)}</span>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}
