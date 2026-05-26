import { Download, Calendar, Star, Sparkles } from 'lucide-react'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { cn } from '@/lib/utils'
import { displayMapName, formatAddedDate, isNew } from '@/app/utils/format'
import { difficultyTextColor, difficultyBgColor } from '@/app/utils/scoreColors'
import type { MapMetadata } from '@/app/utils/api'

interface HeroSectionProps {
    mapName: string
    map: MapMetadata | null
    avgOverall: number | null
    reviewCount: number
    isFavorited: boolean
    onToggleFavorite: (mapName: string) => void
    chart?: React.ReactNode
}

function difficultyLabel(d: number): string {
    if (d <= 3) return 'Beginner'
    if (d <= 6) return 'Intermediate'
    if (d <= 8) return 'Advanced'
    return 'Expert'
}

export function HeroSection({
    mapName, map, avgOverall, reviewCount, isFavorited, onToggleFavorite, chart,
}: HeroSectionProps) {
    const difficulty = map?.difficulty
    const author = map?.author_str ?? (map?.author != null ? String(map.author) : null)
    const authorRef = map?.author_ref
    const tags = (map?.tags ?? '').split(',').map(t => t.trim()).filter(Boolean)
    const added = map?.added
    const showNew = added ? isNew(added) : false
    const showTopRated = avgOverall !== null && reviewCount >= 3 && avgOverall >= 8
    const downloadUrl = map?.url

    return (
        <div className="bg-card/30 border border-white/5 rounded-xl overflow-hidden shrink-0">
            <div className="flex flex-col lg:flex-row">
                <div className="lg:w-64 lg:h-64 shrink-0">
                    <MapThumbnail
                        mapName={mapName}
                        className="w-full h-full aspect-video lg:aspect-square !rounded-none border-0 border-r border-white/5"
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
                            <h1 className="text-2xl font-bold text-white leading-tight truncate">
                                {displayMapName(mapName)}
                            </h1>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
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
                            {downloadUrl && (
                                <a
                                    href={downloadUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-500/15 border border-blue-500/40 text-blue-200 hover:bg-blue-500/25 hover:text-white hover:border-blue-500/60 transition-colors text-xs font-semibold"
                                >
                                    <Download className="size-3.5" />
                                    Download
                                </a>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-xs">
                        {difficulty != null && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5">
                                <span className={cn('inline-flex items-center justify-center size-4 rounded text-[10px] font-bold text-white', difficultyBgColor(difficulty))}>
                                    {difficulty}
                                </span>
                                <span className={cn('font-semibold text-xs', difficultyTextColor(difficulty))}>
                                    {difficultyLabel(difficulty)}
                                </span>
                            </span>
                        )}
                        {added && (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5 text-white">
                                <Calendar className="size-3 text-muted-foreground" />
                                <span className="font-semibold">{formatAddedDate(added)}</span>
                            </span>
                        )}
                        {(authorRef && author) ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-white/5 border border-white/5">
                                <PlayerInfo
                                    userId={authorRef}
                                    alias={author}
                                    size="sm"
                                />
                            </span>
                        ) : author ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-white/5 border border-white/5 text-white">
                                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">by</span>
                                <span className="font-semibold text-xs">{author}</span>
                            </span>
                        ) : null}
                        {tags.map(t => (
                            <span
                                key={t}
                                className="inline-flex items-center px-2 py-1 rounded-md bg-white/[0.03] border border-white/5 text-[10px] font-medium text-muted-foreground uppercase tracking-wider"
                            >
                                {t}
                            </span>
                        ))}
                    </div>

                    {chart && <div className="flex-1 min-h-0">{chart}</div>}
                </div>
            </div>
        </div>
    )
}
