import { useState, useEffect, useCallback } from 'react'
import { ClipboardCheck, ChevronLeft, ChevronRight, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { MapNavLink } from '@/app/components/shared/MapNavLink'
import { Button } from '@/app/components/ui/button'
import { cn } from '@/lib/utils'
import { displayMapName } from '@/app/utils/format'
import { fetchPendingReviews, type PendingReview, type PendingReviewsPage } from '@/app/utils/api'

const PAGE_SIZE = 5

interface MapsToReviewCardProps {
    accessToken?: string
    refreshKey?: number
    firstPage: PendingReviewsPage | null
    onFirstPageLoaded: (page: PendingReviewsPage) => void
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
    onReview: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
}

export function MapsToReviewCard({
    accessToken, refreshKey = 0, firstPage, onFirstPageLoaded, favoriteMapNames,
    onToggleFavorite, onReview, onMapSelect,
}: MapsToReviewCardProps) {
    const [page, setPage] = useState(1)
    const [items, setItems] = useState<PendingReview[]>(firstPage?.items ?? [])
    const [total, setTotal] = useState(firstPage?.total ?? 0)
    const [loading, setLoading] = useState(firstPage === null)
    const [error, setError] = useState<string | null>(null)

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    const load = useCallback(async (targetPage: number, isActive: () => boolean = () => true) => {
        if (!accessToken) {
            setLoading(false)
            return
        }
        setLoading(true)
        setError(null)
        try {
            const data = await fetchPendingReviews(accessToken, PAGE_SIZE, (targetPage - 1) * PAGE_SIZE)
            if (!isActive()) return
            setItems(data.items)
            setTotal(data.total)
            if (targetPage === 1) onFirstPageLoaded(data)
        } catch (err) {
            if (!isActive()) return
            console.error('Failed to load pending reviews', err)
            setError('Failed to load pending reviews.')
        } finally {
            if (isActive()) setLoading(false)
        }
    }, [accessToken, onFirstPageLoaded])

    useEffect(() => {
        if (page === 1 && firstPage !== null) {
            setItems(firstPage.items)
            setTotal(firstPage.total)
            setLoading(false)
            return
        }
        let cancelled = false
        load(page, () => !cancelled)
        return () => { cancelled = true }
    }, [load, page, refreshKey, firstPage])

    if (!loading && !error && items.length === 0) {
        return (
            <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col items-center justify-center gap-2 py-8 text-center">
                <ClipboardCheck className="size-6 text-emerald-300/70" />
                <p className="text-xs text-muted-foreground">All caught up — no maps to review.</p>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            <div className="bg-card/30 border border-hairline/5 rounded-xl overflow-hidden">
                {error && items.length === 0 ? (
                    <div className="flex flex-col items-center gap-3 py-8 text-center">
                        <AlertTriangle className="size-6 text-red-500/50" />
                        <p className="text-sm text-red-400 font-medium">{error}</p>
                        <Button onClick={() => load(page)} variant="outline" size="sm" className="gap-2">
                            <RefreshCw className="size-3" /> Try Again
                        </Button>
                    </div>
                ) : loading && items.length === 0 ? (
                    Array.from({ length: PAGE_SIZE }).map((_, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2.5 border-b border-hairline/5 last:border-0">
                            <div className="size-10 rounded-md bg-hairline/5 animate-pulse shrink-0" />
                            <div className="flex-1 space-y-1.5">
                                <div className="h-3.5 w-1/2 bg-hairline/5 rounded animate-pulse" />
                                <div className="h-3 w-1/4 bg-hairline/5 rounded animate-pulse" />
                            </div>
                        </div>
                    ))
                ) : (
                    items.map(r => (
                        <div
                            key={r.id}
                            className="flex items-center gap-3 px-3 py-2.5 h-16 border-b border-hairline/5 last:border-0"
                        >
                            <MapNavLink
                                mapName={r.mapName}
                                onMapSelect={onMapSelect}
                                ariaLabel={displayMapName(r.mapName)}
                                className={cn('shrink-0', onMapSelect && 'cursor-pointer')}
                            >
                                <MapThumbnail mapName={r.mapName} className="size-10 rounded-md" />
                            </MapNavLink>
                            <div className="flex items-center gap-1 min-w-0">
                                <FavoriteStar
                                    name={r.mapName}
                                    isFavorited={favoriteMapNames.has(r.mapName)}
                                    onToggle={onToggleFavorite}
                                    size="sm"
                                />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 min-w-0">
                                    <MapNavLink
                                        mapName={r.mapName}
                                        onMapSelect={onMapSelect}
                                        className={cn(
                                            'min-w-0 truncate text-left text-sm font-semibold text-foreground leading-tight underline-offset-2',
                                            onMapSelect && 'cursor-pointer hover:underline',
                                        )}
                                    >
                                        {displayMapName(r.mapName)}
                                    </MapNavLink>
                                </div>
                                <span className="text-[11px] text-muted-foreground">Capped {r.timeAgo}</span>
                            </div>
                            <button
                                type="button"
                                onClick={() => onReview(r.mapName)}
                                className="shrink-0 inline-flex items-center h-7 px-2.5 rounded-md bg-orange-500/10 border border-orange-500/30 text-orange-300 hover:bg-orange-500/25 hover:text-foreground hover:border-orange-500/60 transition-colors text-xs font-semibold cursor-pointer"
                            >
                                Review
                            </button>
                        </div>
                    ))
                )}
            </div>

            {total > PAGE_SIZE && (
                <div className="flex items-center justify-between gap-3 px-1">
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                        {loading
                            ? <Loader2 className="inline size-3 animate-spin" />
                            : `Page ${page} of ${totalPages}`}
                    </span>
                    <div className="flex items-center gap-1">
                        <Button
                            size="icon"
                            variant="ghost"
                            disabled={page <= 1 || loading}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="size-7 bg-hairline/5 border border-hairline/5 hover:bg-hairline/10 disabled:opacity-30"
                        >
                            <ChevronLeft className="size-3" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            disabled={page >= totalPages || loading}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            className="size-7 bg-hairline/5 border border-hairline/5 hover:bg-hairline/10 disabled:opacity-30"
                        >
                            <ChevronRight className="size-3" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
