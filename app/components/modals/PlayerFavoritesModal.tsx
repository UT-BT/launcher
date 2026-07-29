import { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { displayMapName } from '@/app/utils/format'
import { fetchUserFavorites } from '@/app/utils/api'
import { PaginationBar } from '@/app/components/ui/pagination'

interface PlayerFavoritesModalProps {
    open: boolean
    onClose: () => void
    accessToken: string | undefined
    userId: string | number
    isSelf: boolean
    favoriteMapNames: Set<string>
    onToggleFavorite?: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
}

export function PlayerFavoritesModal({
    open, onClose, accessToken, userId, isSelf,
    favoriteMapNames, onToggleFavorite, onMapSelect,
}: PlayerFavoritesModalProps) {
    const [favorites, setFavorites] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState('')
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(25)

    useEffect(() => {
        if (!open) return
        let cancelled = false
        setLoading(true)
        fetchUserFavorites(accessToken ?? '', userId)
            .then(rows => { if (!cancelled) setFavorites(rows) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [open, accessToken, userId])

    const liveList = useMemo(() => {
        if (isSelf) return Array.from(favoriteMapNames)
        return favorites
    }, [isSelf, favoriteMapNames, favorites])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        const sorted = [...liveList].sort((a, b) => a.localeCompare(b))
        if (!q) return sorted
        return sorted.filter(n => n.toLowerCase().includes(q))
    }, [liveList, query])

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const safePage = Math.min(page, totalPages)
    const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

    // Reset to page 1 on search changes
    useEffect(() => { setPage(1) }, [query])

    return (
        <Modal
            isOpen={open}
            onClose={onClose}
            title={`Favorite Maps${liveList.length > 0 ? ` (${liveList.length})` : ''}`}
            className="w-[95%] sm:w-[760px] max-w-4xl"
            offsetSidebar
        >
            <div className="space-y-3">
                <div className="relative sticky top-0 z-10 bg-card pb-2 -mt-2 pt-2">
                    <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder="Search by map name…"
                        className="w-full pl-7 pr-3 py-1.5 bg-card/50 border border-hairline/10 rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent-500/50"
                    />
                </div>

                {loading ? (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <div key={i} className="aspect-square bg-hairline/5 rounded animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-sm text-muted-foreground">
                        {liveList.length === 0 ? 'No favorites yet.' : 'No matches for that search.'}
                    </div>
                ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                        {pageRows.map(name => (
                            <div key={name} className="group flex flex-col gap-1 relative">
                                <button
                                    type="button"
                                    onClick={() => { onMapSelect?.(name); onClose() }}
                                    className="text-left cursor-pointer"
                                    title={displayMapName(name)}
                                >
                                    <MapThumbnail
                                        mapName={name}
                                        size="card"
                                        className="aspect-square w-full rounded border border-hairline/10 group-hover:border-hairline/30 transition-colors"
                                    />
                                </button>
                                {isSelf && onToggleFavorite && (
                                    <div className="absolute top-1 right-1">
                                        <FavoriteStar
                                            name={name}
                                            isFavorited={favoriteMapNames.has(name)}
                                            onToggle={onToggleFavorite}
                                            size="sm"
                                            className="bg-black/40 backdrop-blur-sm"
                                        />
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={() => { onMapSelect?.(name); onClose() }}
                                    className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground truncate transition-colors text-left cursor-pointer"
                                >
                                    {displayMapName(name)}
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {!loading && filtered.length > 0 && (
                    <div className="pt-2 border-t border-hairline/5">
                        <PaginationBar
                            page={safePage}
                            totalPages={totalPages}
                            pageSize={pageSize}
                            totalForCount={filtered.length}
                            pageSizePreference={pageSize}
                            autoPageSize={pageSize}
                            onPageChange={setPage}
                            onPageSizeChange={(pref) => { setPageSize(pref === 'auto' ? 25 : pref); setPage(1) }}
                        />
                    </div>
                )}
            </div>
        </Modal>
    )
}
