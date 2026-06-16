import { useMemo } from 'react'
import { Pencil, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavState } from '@/app/components/navigation/useNavState'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { Tooltip } from '@/app/components/ui/tooltip'
import { scoreTextColor, scoreBgColor } from '@/app/utils/scoreColors'
import type { MapReview } from '@/app/utils/api'

type MetricKey = 'overall' | 'aesthetics' | 'learning' | 'luck' | 'difficulty'

const METRICS: { key: MetricKey; label: string; inverted: boolean }[] = [
    { key: 'overall', label: 'Overall', inverted: false },
    { key: 'aesthetics', label: 'Aesthetics', inverted: false },
    { key: 'learning', label: 'Learning', inverted: true },
    { key: 'luck', label: 'Luck', inverted: true },
    { key: 'difficulty', label: 'Difficulty', inverted: true },
]

const SECONDARY_METRICS: MetricKey[] = ['aesthetics', 'learning', 'luck', 'difficulty']
const COLLAPSED_LIMIT = 2

interface ReviewsCardProps {
    reviews: MapReview[]
    currentUserId?: string | number
    loading: boolean
    canSubmit: boolean
    onOpenReviewModal: () => void
}

export function ReviewsCard({
    reviews, currentUserId, loading, canSubmit, onOpenReviewModal,
}: ReviewsCardProps) {
    const [showAll, setShowAll] = useNavState('reviews.showAll', false)

    const myReview = useMemo(() => {
        if (!currentUserId) return undefined
        const idStr = String(currentUserId)
        return reviews.find(r => String(r.user) === idStr)
    }, [reviews, currentUserId])

    const otherReviews = useMemo(() => {
        const list = myReview ? reviews.filter(r => r.id !== myReview.id) : [...reviews]
        list.sort((a, b) => b.overall - a.overall)
        return list
    }, [reviews, myReview])

    const avgRow = useMemo(() => {
        if (reviews.length === 0) return null
        const sum: Record<MetricKey, number> = { overall: 0, aesthetics: 0, learning: 0, luck: 0, difficulty: 0 }
        for (const r of reviews) {
            sum.overall += r.overall
            sum.aesthetics += r.aesthetics
            sum.learning += r.learning
            sum.luck += r.luck
            sum.difficulty += r.difficulty
        }
        const n = reviews.length
        return {
            overall: sum.overall / n,
            aesthetics: sum.aesthetics / n,
            learning: sum.learning / n,
            luck: sum.luck / n,
            difficulty: sum.difficulty / n,
        }
    }, [reviews])

    const visibleOthers = showAll ? otherReviews : otherReviews.slice(0, COLLAPSED_LIMIT)
    const hiddenCount = otherReviews.length - visibleOthers.length

    return (
        <div className="bg-card/30 border border-white/5 rounded-xl p-3 space-y-3">
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium truncate">
                        Reviews {reviews.length > 0 && <span className="text-white/60 ml-1">({reviews.length})</span>}
                    </div>
                </div>
                {canSubmit && !myReview && (
                    <button
                        type="button"
                        onClick={onOpenReviewModal}
                        className="inline-flex items-center gap-1 h-6 px-2 rounded-md bg-accent-500/15 border border-accent-500/40 text-accent-200 hover:bg-accent-500/25 hover:text-white hover:border-accent-500/60 transition-colors text-[10px] font-bold uppercase tracking-wider cursor-pointer shrink-0"
                    >
                        <Plus className="size-3" />
                        Add a Review
                    </button>
                )}
            </div>

            {loading ? (
                <div className="space-y-2">
                    <div className="h-20 bg-white/5 rounded-lg animate-pulse" />
                    <div className="h-14 bg-white/5 rounded-lg animate-pulse" />
                </div>
            ) : reviews.length === 0 ? (
                <div className="text-center py-6 space-y-1">
                    <p className="text-xs text-white/70">No reviews yet.</p>
                    <p className="text-[10px] text-muted-foreground">
                        Share your thoughts to help others.
                    </p>
                </div>
            ) : (
                <>
                    {avgRow && (
                        <div className="rounded-lg bg-gradient-to-br from-accent-500/10 to-transparent border border-accent-500/20 p-3">
                            <div className="flex items-center gap-3">
                                <div className="flex flex-col items-center shrink-0">
                                    <div className={cn('text-3xl font-bold font-mono leading-none', scoreTextColor(avgRow.overall, false))}>
                                        {avgRow.overall.toFixed(1)}
                                    </div>
                                    <div className="text-[9px] uppercase tracking-widest text-muted-foreground mt-1">Overall</div>
                                </div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 flex-1 min-w-0">
                                    {SECONDARY_METRICS.map(key => {
                                        const m = METRICS.find(x => x.key === key)!
                                        const v = avgRow[key]
                                        return (
                                            <div key={key} className="space-y-0.5 min-w-0">
                                                <div className="flex items-baseline justify-between gap-1">
                                                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground truncate">{m.label}</span>
                                                    <span className={cn('text-xs font-bold font-mono', scoreTextColor(v, m.inverted))}>{v.toFixed(1)}</span>
                                                </div>
                                                <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
                                                    <div
                                                        className={cn('h-full rounded-full transition-all', scoreBgColor(v, m.inverted))}
                                                        style={{ width: `${(v / 10) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-2">
                        {myReview && (
                            <ReviewCard review={myReview} highlight onEdit={canSubmit ? onOpenReviewModal : undefined} />
                        )}
                        {visibleOthers.map(r => <ReviewCard key={r.id} review={r} />)}
                        {hiddenCount > 0 && (
                            <button
                                type="button"
                                onClick={() => setShowAll(true)}
                                className="w-full px-2 py-1.5 rounded-md bg-white/[0.02] border border-white/5 text-[10px] uppercase tracking-wider font-medium text-muted-foreground hover:text-white hover:border-white/20 transition-colors cursor-pointer"
                            >
                                Show {hiddenCount} more
                            </button>
                        )}
                        {showAll && otherReviews.length > COLLAPSED_LIMIT && (
                            <button
                                type="button"
                                onClick={() => setShowAll(false)}
                                className="w-full px-2 py-1.5 rounded-md bg-white/[0.02] border border-white/5 text-[10px] uppercase tracking-wider font-medium text-muted-foreground hover:text-white hover:border-white/20 transition-colors cursor-pointer"
                            >
                                Show less
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

function ReviewCard({ review, highlight, onEdit }: { review: MapReview; highlight?: boolean; onEdit?: () => void }) {
    return (
        <div className={cn(
            'rounded-lg border p-2.5 transition-colors',
            highlight ? 'bg-emerald-500/[0.07] border-emerald-500/30' : 'bg-white/[0.02] border-white/5',
        )}>
            <div className="flex items-center justify-between mb-2 gap-2">
                <PlayerInfo
                    userId={review.user}
                    alias={review.alias}
                    title={review.active_title}
                    size="sm"
                    highlight={highlight}
                    showYouBadge={highlight}
                    className="min-w-0 flex-1"
                />
                <div className="flex items-center gap-1.5 shrink-0">
                    {onEdit && (
                        <Tooltip content="Update your review" side="top">
                            <button
                                type="button"
                                onClick={onEdit}
                                aria-label="Update your review"
                                className="p-1 rounded text-accent-300 hover:text-accent-200 hover:bg-accent-500/15 transition-colors cursor-pointer"
                            >
                                <Pencil className="size-3" />
                            </button>
                        </Tooltip>
                    )}
                    <div>
                        <span className={cn('text-base font-bold font-mono leading-none', scoreTextColor(review.overall, false))}>
                            {review.overall}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50 ml-0.5 font-mono">/10</span>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
                {SECONDARY_METRICS.map(key => {
                    const m = METRICS.find(x => x.key === key)!
                    const v = review[key]
                    return (
                        <div key={key} className="space-y-0.5">
                            <div className="flex items-baseline justify-between gap-1">
                                <span className="text-[8px] uppercase tracking-wider text-muted-foreground truncate">{m.label}</span>
                                <span className={cn('text-[10px] font-bold font-mono', scoreTextColor(v, m.inverted))}>{v}</span>
                            </div>
                            <div className="h-0.5 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={cn('h-full rounded-full', scoreBgColor(v, m.inverted))}
                                    style={{ width: `${(v / 10) * 100}%` }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
