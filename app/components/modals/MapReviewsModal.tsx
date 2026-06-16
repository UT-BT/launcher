import { useState, useEffect, useMemo } from 'react'
import { Modal } from '@/app/components/ui/modal'
import { Loader2, Pencil, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchMapReviews, MapReview } from '@/app/utils/api'
import { ReviewModal } from './ReviewModal'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { Tooltip } from '@/app/components/ui/tooltip'
import { scoreTextColor, scoreBgColor } from '@/app/utils/scoreColors'
import { displayMapName } from '@/app/utils/format'

type MetricKey = 'overall' | 'aesthetics' | 'learning' | 'luck' | 'difficulty'
type SortKey = 'reviewer' | MetricKey
type SortDir = 'asc' | 'desc'

interface MapReviewsModalProps {
    open: boolean
    onClose: () => void
    accessToken?: string
    userId?: string | number
    mapName: string | null
    onReviewSubmitted?: () => void | Promise<void>
}

const METRICS: { key: MetricKey; label: string; inverted: boolean }[] = [
    { key: 'overall', label: 'Overall', inverted: false },
    { key: 'aesthetics', label: 'Aesthetics', inverted: false },
    { key: 'learning', label: 'Learning', inverted: true },
    { key: 'luck', label: 'Luck', inverted: true },
    { key: 'difficulty', label: 'Difficulty', inverted: true },
]

const SECONDARY_METRICS: MetricKey[] = ['aesthetics', 'learning', 'luck', 'difficulty']

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
    { value: 'overall', label: 'Overall' },
    { value: 'aesthetics', label: 'Aesthetics' },
    { value: 'learning', label: 'Learning' },
    { value: 'luck', label: 'Luck' },
    { value: 'difficulty', label: 'Difficulty' },
    { value: 'reviewer', label: 'Reviewer name' },
]

export function MapReviewsModal({
    open, onClose, accessToken, userId, mapName, onReviewSubmitted,
}: MapReviewsModalProps) {
    const [reviews, setReviews] = useState<MapReview[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [reviewModalOpen, setReviewModalOpen] = useState(false)
    const [sortBy, setSortBy] = useState<SortKey>('overall')
    const [sortDir, setSortDir] = useState<SortDir>('desc')

    const load = async () => {
        if (!accessToken || !mapName) return
        setLoading(true)
        setError(null)
        try {
            const data = await fetchMapReviews(accessToken, mapName)
            setReviews(data)
        } catch {
            setError('Failed to load reviews.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (open && mapName) load()
        if (!open) {
            setReviews([])
            setError(null)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mapName, accessToken])

    const myReview = useMemo(() => {
        if (!userId) return undefined
        const idStr = String(userId)
        return reviews.find(r => String(r.user) === idStr)
    }, [reviews, userId])

    const otherReviews = useMemo(() => {
        const list = myReview ? reviews.filter(r => r.id !== myReview.id) : [...reviews]
        list.sort((a, b) => {
            let cmp = 0
            if (sortBy === 'reviewer') {
                const aN = (a.alias || String(a.user)).toLowerCase()
                const bN = (b.alias || String(b.user)).toLowerCase()
                cmp = aN.localeCompare(bN)
            } else {
                cmp = a[sortBy] - b[sortBy]
            }
            return sortDir === 'asc' ? cmp : -cmp
        })
        return list
    }, [reviews, myReview, sortBy, sortDir])

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

    return (
        <>
            <Modal
                isOpen={open}
                onClose={onClose}
                title={mapName ? `Reviews for ${displayMapName(mapName)}` : 'Reviews'}
                offsetSidebar
                maxWidth="880px"
                className="bg-[#0a0a0b]/98 border-white/5 backdrop-blur-3xl mx-auto"
                footer={null}
            >
                <div className="space-y-6">
                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {loading ? (
                        <div className="flex items-center justify-center py-16">
                            <Loader2 className="size-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : reviews.length === 0 ? (
                        <div className="space-y-3">
                            <div className="text-center space-y-1">
                                <div className="text-base text-white/80 font-medium">No reviews yet</div>
                                <div className="text-sm text-muted-foreground">Be the first to share your thoughts.</div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReviewModalOpen(true)}
                                disabled={!accessToken || !mapName}
                                className={cn(
                                    "group w-full rounded-xl border border-dashed border-accent-500/30 bg-accent-500/[0.04] p-4",
                                    "flex items-center justify-center gap-3 cursor-pointer",
                                    "hover:bg-accent-500/10 hover:border-accent-500/60 hover:text-accent-100 transition-colors",
                                    "text-accent-300/80 text-sm font-medium",
                                    "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent-500/[0.04] disabled:hover:border-accent-500/30",
                                )}
                            >
                                <span className="inline-flex items-center justify-center size-8 rounded-full border border-accent-500/40 bg-accent-500/10 group-hover:bg-accent-500/25 group-hover:border-accent-500/70 transition-colors">
                                    <Plus className="size-4" />
                                </span>
                                <span>Write your review</span>
                            </button>
                        </div>
                    ) : (
                        <>
                            {avgRow && (
                                <div className="rounded-xl bg-gradient-to-br from-accent-500/10 to-transparent border border-accent-500/20 p-5">
                                    <div className="text-[10px] font-bold uppercase tracking-widest text-accent-300 mb-4">
                                        Community Average
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="flex flex-col items-center shrink-0">
                                            <div className={cn("text-5xl font-bold font-mono leading-none", scoreTextColor(avgRow.overall, false))}>
                                                {avgRow.overall.toFixed(1)}
                                            </div>
                                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-2">Overall</div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-x-5 gap-y-2.5 flex-1">
                                            {SECONDARY_METRICS.map(key => {
                                                const m = METRICS.find(x => x.key === key)!
                                                const v = avgRow[key]
                                                return (
                                                    <div key={key} className="space-y-1">
                                                        <div className="flex items-baseline justify-between">
                                                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{m.label}</span>
                                                            <span className={cn("text-sm font-bold font-mono", scoreTextColor(v, m.inverted))}>{v.toFixed(1)}</span>
                                                        </div>
                                                        <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                                            <div
                                                                className={cn("h-full rounded-full transition-all", scoreBgColor(v, m.inverted))}
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

                            {(otherReviews.length > 0 || myReview) && (
                                <div className="flex items-center justify-between gap-3">
                                    <div className="text-xs uppercase tracking-widest text-muted-foreground">
                                        Individual Reviews
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Sort</label>
                                        <select
                                            value={sortBy}
                                            onChange={e => setSortBy(e.target.value as SortKey)}
                                            style={{ colorScheme: 'dark' }}
                                            className="px-2 py-1 bg-card/50 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-accent-500/50 cursor-pointer"
                                        >
                                            {SORT_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value} className="bg-[#0f1115] text-white">{o.label}</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}
                                            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
                                            className="px-2 py-1 bg-card/50 border border-white/10 rounded text-xs text-white hover:border-white/30 cursor-pointer"
                                        >
                                            {sortDir === 'asc' ? '↑' : '↓'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2.5">
                                {myReview ? (
                                    <ReviewCard
                                        review={myReview}
                                        highlight
                                        onEdit={() => setReviewModalOpen(true)}
                                    />
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setReviewModalOpen(true)}
                                        disabled={!accessToken || !mapName}
                                        className={cn(
                                            "group w-full rounded-xl border border-dashed border-accent-500/30 bg-accent-500/[0.04] p-4",
                                            "flex items-center justify-center gap-3 cursor-pointer",
                                            "hover:bg-accent-500/10 hover:border-accent-500/60 hover:text-accent-100 transition-colors",
                                            "text-accent-300/80 text-sm font-medium",
                                            "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-accent-500/[0.04] disabled:hover:border-accent-500/30",
                                        )}
                                    >
                                        <span className="inline-flex items-center justify-center size-8 rounded-full border border-accent-500/40 bg-accent-500/10 group-hover:bg-accent-500/25 group-hover:border-accent-500/70 transition-colors">
                                            <Plus className="size-4" />
                                        </span>
                                        <span>Write your review</span>
                                    </button>
                                )}
                                {otherReviews.map(r => <ReviewCard key={r.id} review={r} />)}
                            </div>
                        </>
                    )}
                </div>
            </Modal>

            <ReviewModal
                open={reviewModalOpen}
                onOpenChange={setReviewModalOpen}
                accessToken={accessToken}
                mapName={mapName}
                initialScores={myReview ? {
                    aesthetics: myReview.aesthetics,
                    learning: myReview.learning,
                    luck: myReview.luck,
                    difficulty: myReview.difficulty,
                    overall: myReview.overall,
                } : undefined}
                onSuccess={async () => {
                    await Promise.all([
                        load(),
                        onReviewSubmitted?.() ?? Promise.resolve(),
                    ])
                }}
            />
        </>
    )
}

function ReviewCard({ review, highlight, onEdit }: { review: MapReview; highlight?: boolean; onEdit?: () => void }) {
    return (
        <div className={cn(
            "rounded-xl border p-4 transition-colors",
            highlight
                ? "bg-emerald-500/[0.07] border-emerald-500/30"
                : "bg-white/[0.02] border-white/5"
        )}>
            <div className="flex items-center justify-between mb-3 gap-3">
                <PlayerInfo
                    userId={review.user}
                    alias={review.alias}
                    title={review.active_title}
                    size="md"
                    highlight={highlight}
                    showYouBadge={highlight}
                    className="min-w-0 flex-1"
                />
                <div className="flex items-center gap-2 shrink-0">
                    {onEdit && (
                        <Tooltip content="Update your review" side="top">
                            <button
                                type="button"
                                onClick={onEdit}
                                aria-label="Update your review"
                                className="p-1.5 rounded-md text-accent-300 hover:text-accent-200 hover:bg-accent-500/15 transition-colors cursor-pointer"
                            >
                                <Pencil className="size-3.5" />
                            </button>
                        </Tooltip>
                    )}
                    <div>
                        <span className={cn("text-2xl font-bold font-mono leading-none", scoreTextColor(review.overall, false))}>
                            {review.overall}
                        </span>
                        <span className="text-xs text-muted-foreground/50 ml-1 font-mono">/10</span>
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
                {SECONDARY_METRICS.map(key => {
                    const m = METRICS.find(x => x.key === key)!
                    const v = review[key]
                    return (
                        <div key={key} className="space-y-1">
                            <div className="flex items-baseline justify-between">
                                <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{m.label}</span>
                                <span className={cn("text-xs font-bold font-mono", scoreTextColor(v, m.inverted))}>{v}</span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className={cn("h-full rounded-full", scoreBgColor(v, m.inverted))}
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
