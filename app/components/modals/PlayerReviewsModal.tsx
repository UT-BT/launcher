import { useEffect, useMemo, useState } from 'react'
import { Pencil, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Modal } from '@/app/components/ui/modal'
import { Tooltip } from '@/app/components/ui/tooltip'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { NavLink } from '@/app/components/navigation/NavLink'
import { displayMapName } from '@/app/utils/format'
import { scoreTextColor } from '@/app/utils/scoreColors'
import { fetchMapReviewsByUser, type MapReview } from '@/app/utils/api'
import { ReviewModal } from '@/app/components/modals/ReviewModal'
import { PaginationBar } from '@/app/components/ui/pagination'

interface PlayerReviewsModalProps {
    open: boolean
    onClose: () => void
    accessToken: string | undefined
    userId: string | number
    isSelf: boolean
    onMapSelect?: (mapName: string) => void
}

type MetricKey = 'aesthetics' | 'learning' | 'luck' | 'difficulty'

const METRICS: { key: MetricKey; short: string; label: string; inverted: boolean }[] = [
    { key: 'aesthetics', short: 'A', label: 'Aesthetics', inverted: false },
    { key: 'learning',   short: 'L', label: 'Learning',   inverted: true },
    { key: 'luck',       short: 'K', label: 'Luck',       inverted: true },
    { key: 'difficulty', short: 'D', label: 'Difficulty', inverted: true },
]

type SortKey = 'overall' | 'map'

export function PlayerReviewsModal({
    open, onClose, accessToken, userId, isSelf, onMapSelect,
}: PlayerReviewsModalProps) {
    const [reviews, setReviews] = useState<MapReview[]>([])
    const [loading, setLoading] = useState(true)
    const [query, setQuery] = useState('')
    const [sortKey, setSortKey] = useState<SortKey>('overall')
    const [reviewModalMap, setReviewModalMap] = useState<string | null>(null)
    const [refreshKey, setRefreshKey] = useState(0)
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)

    useEffect(() => {
        if (!open) return
        let cancelled = false
        setLoading(true)
        fetchMapReviewsByUser(accessToken ?? '', userId)
            .then(rows => { if (!cancelled) setReviews(rows) })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [open, accessToken, userId, refreshKey])

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        const arr = q
            ? reviews.filter(r => r.map_name.toLowerCase().includes(q))
            : reviews
        const sorted = [...arr]
        if (sortKey === 'overall') {
            sorted.sort((a, b) => b.overall - a.overall || a.map_name.localeCompare(b.map_name))
        } else {
            sorted.sort((a, b) => a.map_name.localeCompare(b.map_name))
        }
        return sorted
    }, [reviews, query, sortKey])

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize))
    const safePage = Math.min(page, totalPages)
    const pageRows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize)

    // Reset to page 1 on search/sort changes
    useEffect(() => { setPage(1) }, [query, sortKey])

    const activeReview = useMemo(
        () => reviews.find(r => r.map_name === reviewModalMap),
        [reviews, reviewModalMap],
    )

    return (
        <>
            <Modal
                isOpen={open}
                onClose={onClose}
                title={`Reviews Written${reviews.length > 0 ? ` (${reviews.length})` : ''}`}
                className="w-[95%] sm:w-[760px] max-w-4xl"
                offsetSidebar
            >
                <div className="space-y-3">
                    <div className="flex items-center gap-2 sticky top-0 z-10 bg-card pb-2 -mt-2 pt-2">
                        <div className="relative flex-1">
                            <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                            <input
                                type="text"
                                value={query}
                                onChange={e => setQuery(e.target.value)}
                                placeholder="Search by map name…"
                                className="w-full pl-7 pr-3 py-1.5 bg-card/50 border border-hairline/10 rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent-500/50"
                            />
                        </div>
                        <select
                            value={sortKey}
                            onChange={e => setSortKey(e.target.value as SortKey)}
                            style={{ colorScheme: 'dark' }}
                            className="px-2 py-1.5 bg-card/50 border border-hairline/10 rounded text-xs text-foreground focus:outline-none focus:border-accent-500/50 cursor-pointer"
                        >
                            <option value="overall" className="bg-[#0f1115]">Sort: Overall (high→low)</option>
                            <option value="map" className="bg-[#0f1115]">Sort: Map name (A→Z)</option>
                        </select>
                    </div>

                    <div className="space-y-1.5">
                        {loading ? (
                            Array.from({ length: 6 }).map((_, i) => (
                                <div key={i} className="h-14 bg-hairline/5 rounded-lg animate-pulse" />
                            ))
                        ) : filtered.length === 0 ? (
                            <div className="text-center py-12 text-sm text-muted-foreground">
                                {reviews.length === 0 ? 'No reviews written yet.' : 'No matches for that search.'}
                            </div>
                        ) : (
                            pageRows.map(r => (
                                <div
                                    key={r.id}
                                    className="flex items-center gap-3 px-3 py-2 rounded-lg bg-hairline/[0.02] border border-hairline/5 hover:bg-hairline/[0.05] hover:border-hairline/15 transition-colors"
                                >
                                    <NavLink
                                        view="maps-detail"
                                        params={{ mapName: r.map_name }}
                                        onActivate={() => { onMapSelect?.(r.map_name); onClose() }}
                                        className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer text-left"
                                    >
                                        <MapThumbnail mapName={r.map_name} className="size-10 shrink-0" />
                                        <span className="text-sm font-semibold text-foreground truncate min-w-0 hover:underline underline-offset-2">
                                            {displayMapName(r.map_name)}
                                        </span>
                                    </NavLink>

                                    <div className="hidden sm:flex items-center gap-1 shrink-0">
                                        {METRICS.map(m => (
                                            <Tooltip key={m.key} content={m.label} side="top">
                                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-hairline/[0.04] border border-hairline/10">
                                                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold">{m.short}</span>
                                                    <span className={cn('text-[11px] font-bold font-mono tabular-nums', scoreTextColor(r[m.key], m.inverted))}>
                                                        {r[m.key]}
                                                    </span>
                                                </span>
                                            </Tooltip>
                                        ))}
                                    </div>

                                    <div className="shrink-0 text-right min-w-[3.5rem]">
                                        <span className={cn('text-lg font-bold font-mono leading-none', scoreTextColor(r.overall, false))}>
                                            {r.overall}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground/50 ml-0.5 font-mono">/10</span>
                                    </div>

                                    {isSelf && (
                                        <Tooltip content="Edit review" side="top">
                                            <button
                                                type="button"
                                                onClick={() => setReviewModalMap(r.map_name)}
                                                aria-label="Edit review"
                                                className="shrink-0 p-1.5 rounded text-accent-300 hover:text-accent-200 hover:bg-accent-500/15 transition-colors cursor-pointer"
                                            >
                                                <Pencil className="size-3.5" />
                                            </button>
                                        </Tooltip>
                                    )}
                                </div>
                            ))
                        )}
                    </div>

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
                                onPageSizeChange={(pref) => { setPageSize(pref === 'auto' ? 10 : pref); setPage(1) }}
                            />
                        </div>
                    )}
                </div>
            </Modal>

            <ReviewModal
                open={reviewModalMap !== null}
                onOpenChange={open => { if (!open) setReviewModalMap(null) }}
                accessToken={accessToken}
                mapName={reviewModalMap}
                initialScores={activeReview ? {
                    aesthetics: activeReview.aesthetics,
                    learning: activeReview.learning,
                    luck: activeReview.luck,
                    difficulty: activeReview.difficulty,
                    overall: activeReview.overall,
                } : undefined}
                onSuccess={() => { setReviewModalMap(null); setRefreshKey(k => k + 1) }}
            />
        </>
    )
}
