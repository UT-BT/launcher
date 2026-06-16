import { useEffect, useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchMapReviewsByUser, type MapReview } from '@/app/utils/api'
import { displayMapName } from '@/app/utils/format'
import { scoreTextColor } from '@/app/utils/scoreColors'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { PlayerReviewsModal } from '@/app/components/modals/PlayerReviewsModal'

interface ReviewsAuthoredCardProps {
    accessToken: string | undefined
    userId: string | number
    isSelf: boolean
    totalCount?: number
    onMapSelect?: (mapName: string) => void
}

const PREVIEW_LIMIT = 3

export function ReviewsAuthoredCard({
    accessToken, userId, isSelf, totalCount, onMapSelect,
}: ReviewsAuthoredCardProps) {
    const [reviews, setReviews] = useState<MapReview[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)

    useEffect(() => {
        let cancelled = false
        if (!accessToken) return
        setLoading(true)
        fetchMapReviewsByUser(accessToken, userId)
            .then(rows => {
                if (cancelled) return
                rows.sort((a, b) => b.overall - a.overall)
                setReviews(rows)
            })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [accessToken, userId])

    const preview = reviews.slice(0, PREVIEW_LIMIT)
    const count = totalCount ?? reviews.length

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl p-3 space-y-2">
            <div className="flex items-center gap-2">
                <MessageSquare className="size-3.5 text-purple-300" />
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                    Reviews Written {count > 0 && <span className="text-foreground/60 ml-1">({count.toLocaleString()})</span>}
                </div>
            </div>

            {loading ? (
                <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-10 bg-hairline/5 rounded-lg animate-pulse" />
                    ))}
                </div>
            ) : reviews.length === 0 ? (
                <div className="text-center py-4 text-xs text-muted-foreground">
                    No reviews written.
                </div>
            ) : (
                <div className="space-y-1.5">
                    {preview.map(r => (
                        <button
                            key={r.id}
                            type="button"
                            onClick={() => onMapSelect?.(r.map_name)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md bg-hairline/[0.02] border border-hairline/5 hover:bg-hairline/[0.05] hover:border-hairline/15 transition-colors cursor-pointer text-left"
                        >
                            <MapThumbnail mapName={r.map_name} className="size-7 shrink-0" />
                            <span className="text-xs font-semibold text-foreground truncate flex-1 min-w-0">
                                {displayMapName(r.map_name)}
                            </span>
                            <span className={cn(
                                'text-sm font-bold font-mono shrink-0',
                                scoreTextColor(r.overall, false),
                            )}>
                                {r.overall}
                                <span className="text-[9px] text-muted-foreground/60 font-normal ml-0.5">/10</span>
                            </span>
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => setModalOpen(true)}
                        className="w-full px-2 py-1 rounded-md bg-hairline/[0.02] border border-hairline/5 text-[10px] uppercase tracking-wider font-medium text-muted-foreground hover:text-foreground hover:border-hairline/20 transition-colors cursor-pointer"
                    >
                        View all
                    </button>
                </div>
            )}

            <PlayerReviewsModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                accessToken={accessToken}
                userId={userId}
                isSelf={isSelf}
                onMapSelect={onMapSelect}
            />
        </div>
    )
}
