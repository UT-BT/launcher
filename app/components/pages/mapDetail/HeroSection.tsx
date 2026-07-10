import { Download, Calendar, Star, Sparkles, Loader2, Users } from 'lucide-react'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { MetaPill } from '@/app/components/shared/MetaPill'
import { cn } from '@/lib/utils'
import { displayMapName, formatAddedDate, isNew } from '@/app/utils/format'
import { difficultyBgColor } from '@/app/utils/scoreColors'
import type { MapMetadata } from '@/app/utils/api'
import { MapVersionsBar } from './MapVersionsCard'

interface HeroSectionProps {
    mapName: string
    map: MapMetadata | null
    avgOverall: number | null
    reviewCount: number
    isFavorited: boolean
    onToggleFavorite: (mapName: string) => void
    onDownload: () => void
    isDownloading: boolean
    chart?: React.ReactNode
    accessToken?: string
    onMapSelect?: (mapName: string) => void
    requiredPlayers?: number | null
}

export function HeroSection({
    mapName, map, avgOverall, reviewCount, isFavorited, onToggleFavorite, onDownload, isDownloading, chart,
    accessToken, onMapSelect, requiredPlayers,
}: HeroSectionProps) {
    const difficulty = map?.difficulty
    const author = map?.author_str ?? (map?.author != null ? String(map.author) : null)
    const authorRef = map?.author_ref
    const tags = (map?.tags ?? '').split(',').map(t => t.trim()).filter(Boolean)
    const added = map?.added
    const showNew = added ? isNew(added) : false
    const showTopRated = avgOverall !== null && reviewCount >= 3 && avgOverall >= 8

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl overflow-hidden shrink-0">
            <div className="flex flex-col lg:flex-row">
                <div className="lg:w-64 lg:h-64 shrink-0 p-2">
                    <MapThumbnail
                        mapName={mapName}
                        className="w-full h-full aspect-video lg:aspect-square rounded-lg border border-hairline/10"
                    />
                </div>
                <div className="flex-1 p-4 flex flex-col gap-3 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                            <FavoriteStar
                                name={mapName}
                                isFavorited={isFavorited}
                                onToggle={onToggleFavorite}
                                size="lg"
                                className="translate-y-px"
                            />
                            <h1 className="text-2xl font-bold text-foreground leading-tight truncate">
                                {displayMapName(mapName)}
                            </h1>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {requiredPlayers != null && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-accent-500/15 border border-accent-500/40 text-accent-200 text-[10px] font-bold uppercase tracking-wider">
                                    <Users className="size-3" />
                                    {requiredPlayers}-Player Map
                                </span>
                            )}
                            {showNew && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
                                    <Sparkles className="size-3" />
                                    New
                                </span>
                            )}
                            {showTopRated && (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/15 border border-amber-500/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                                    <Star className="size-3 fill-current" />
                                    Top Rated
                                </span>
                            )}
                            <button
                                type="button"
                                onClick={onDownload}
                                disabled={isDownloading}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent-500/15 border border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:text-foreground hover:border-accent-500/60 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-xs font-semibold cursor-pointer"
                            >
                                {isDownloading ? (
                                    <Loader2 className="size-3.5 animate-spin" />
                                ) : (
                                    <Download className="size-3.5" />
                                )}
                                {isDownloading ? 'Downloading…' : 'Download Map'}
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                        {(authorRef && author) ? (
                            <span className="inline-flex items-center h-7 px-2 rounded-md bg-hairline/5 border border-hairline/5">
                                <PlayerInfo
                                    userId={authorRef}
                                    alias={author}
                                    size="sm"
                                />
                            </span>
                        ) : author ? (
                            <MetaPill label="By" value={author} />
                        ) : null}
                        {added && (
                            <MetaPill icon={Calendar} value={formatAddedDate(added)} />
                        )}
                        {difficulty != null && (
                            <MetaPill label="Difficulty">
                                <span className={cn(
                                    'inline-flex items-center justify-center size-4 rounded text-[10px] font-bold text-foreground',
                                    difficultyBgColor(difficulty),
                                )}>
                                    {difficulty}
                                </span>
                            </MetaPill>
                        )}
                        {tags.map(t => (
                            <MetaPill key={t} value={t.toUpperCase()} className="!text-[10px]" />
                        ))}
                        <MapVersionsBar map={map} accessToken={accessToken} onSelect={onMapSelect} />
                    </div>

                    {chart && <div className="flex-1 min-h-0">{chart}</div>}
                </div>
            </div>
        </div>
    )
}
