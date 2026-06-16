import { useEffect, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import { fetchUserFavorites } from '@/app/utils/api'
import { displayMapName } from '@/app/utils/format'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { PlayerFavoritesModal } from '@/app/components/modals/PlayerFavoritesModal'

interface FavoriteMapsCardProps {
    accessToken: string | undefined
    userId: string | number
    isSelf: boolean
    favoriteMapNames: Set<string>
    onToggleFavorite?: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
    totalCount?: number
}

const PREVIEW_LIMIT = 8

export function FavoriteMapsCard({
    accessToken, userId, isSelf, favoriteMapNames,
    onToggleFavorite, onMapSelect, totalCount,
}: FavoriteMapsCardProps) {
    const [favorites, setFavorites] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)

    useEffect(() => {
        let cancelled = false
        if (!accessToken) return
        setLoading(true)
        fetchUserFavorites(accessToken, userId)
            .then(rows => { if (!cancelled) setFavorites(rows) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [accessToken, userId])

    const liveList = useMemo(() => {
        if (isSelf) return Array.from(favoriteMapNames)
        return favorites
    }, [isSelf, favoriteMapNames, favorites])

    const preview = liveList.slice(0, PREVIEW_LIMIT)
    const count = totalCount ?? liveList.length

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
                <Star className="size-3.5 text-yellow-400 fill-current" />
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Favorite Maps {count > 0 && <span className="text-foreground/60 ml-1">({count.toLocaleString()})</span>}
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-4 gap-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="aspect-square bg-hairline/5 rounded animate-pulse" />
                    ))}
                </div>
            ) : liveList.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                    No favorites yet.
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-4 gap-2">
                        {preview.map(name => (
                            <button
                                key={name}
                                type="button"
                                onClick={() => onMapSelect?.(name)}
                                className="group flex flex-col gap-1 text-left cursor-pointer"
                                title={displayMapName(name)}
                            >
                                <MapThumbnail
                                    mapName={name}
                                    className="aspect-square rounded border border-hairline/10 group-hover:border-hairline/30 transition-colors"
                                />
                                <span className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground truncate transition-colors">
                                    {displayMapName(name)}
                                </span>
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="w-full px-2 py-1 rounded-md bg-hairline/[0.02] border border-hairline/5 text-[10px] uppercase tracking-wider font-medium text-muted-foreground hover:text-foreground hover:border-hairline/20 transition-colors cursor-pointer"
                    >
                        View all
                    </button>
                </>
            )}

            <PlayerFavoritesModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                accessToken={accessToken}
                userId={userId}
                isSelf={isSelf}
                favoriteMapNames={favoriteMapNames}
                onToggleFavorite={onToggleFavorite}
                onMapSelect={onMapSelect}
            />
        </div>
    )
}
