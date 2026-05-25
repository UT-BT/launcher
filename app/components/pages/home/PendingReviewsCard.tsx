import { useEffect, useState, useCallback } from 'react'
import { MessageSquarePlus, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow,
    DataTableCell, DataTableEmpty, DataTableSkeletonRow,
} from '@/app/components/shared/DataTable'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { Button } from '@/app/components/ui/button'
import { Tooltip } from '@/app/components/ui/tooltip'
import { fetchPendingReviews, PendingReview } from '@/app/utils/api'

const PAGE_SIZE = 5

interface PendingReviewsCardProps {
    accessToken?: string
    refreshKey?: number
    onReview: (mapName: string) => void
}

export function PendingReviewsCard({ accessToken, refreshKey = 0, onReview }: PendingReviewsCardProps) {
    const [page, setPage] = useState(1)
    const [items, setItems] = useState<PendingReview[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(false)

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    const load = useCallback(async (targetPage: number) => {
        if (!accessToken) return
        setLoading(true)
        try {
            const data = await fetchPendingReviews(accessToken, PAGE_SIZE, (targetPage - 1) * PAGE_SIZE)
            setItems(data.items)
            setTotal(data.total)
        } catch (err) {
            console.error('Failed to load pending reviews', err)
        } finally {
            setLoading(false)
        }
    }, [accessToken])

    useEffect(() => {
        load(page)
    }, [load, page, refreshKey])

    return (
        <div className="flex flex-col gap-2">
            <DataTableShell className="flex-none">
                <DataTableHeaderRow>
                    <DataTableHeaderCell width="3.5rem"> </DataTableHeaderCell>
                    <DataTableHeaderCell>Map</DataTableHeaderCell>
                    <DataTableHeaderCell align="right" width="6rem">Capped</DataTableHeaderCell>
                    <DataTableHeaderCell align="center" width="3rem"> </DataTableHeaderCell>
                </DataTableHeaderRow>
                <tbody>
                    {loading && items.length === 0 ? (
                        Array.from({ length: PAGE_SIZE }).map((_, i) => (
                            <DataTableSkeletonRow key={i} columnCount={4} />
                        ))
                    ) : items.length === 0 ? (
                        <DataTableEmpty colSpan={4} message="All caught up! No pending map reviews." />
                    ) : (
                        items.map(rev => (
                            <DataTableRow key={rev.id}>
                                <DataTableCell>
                                    <MapThumbnail mapName={rev.mapName} className="w-12 h-12" />
                                </DataTableCell>
                                <DataTableCell>
                                    <span className="font-bold text-white/90 truncate">
                                        {rev.mapName.replace('CTF-BT-', '')}
                                    </span>
                                </DataTableCell>
                                <DataTableCell align="right">
                                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                        {rev.timeAgo}
                                    </span>
                                </DataTableCell>
                                <DataTableCell align="center" className="px-2">
                                    <Tooltip content="Review this map" side="top">
                                        <Button
                                            size="icon"
                                            variant="ghost"
                                            onClick={() => onReview(rev.mapName)}
                                            className="inline-flex items-center justify-center size-7 rounded-md bg-orange-500/10 border border-orange-500/30 text-orange-300 hover:bg-orange-500/25 hover:border-orange-500/60 transition-colors cursor-pointer"
                                        >
                                            <MessageSquarePlus className="size-3" />
                                        </Button>
                                    </Tooltip>
                                </DataTableCell>
                            </DataTableRow>
                        ))
                    )}
                </tbody>
            </DataTableShell>

            {total > PAGE_SIZE && (
                <div className="flex items-center justify-between gap-3 px-1">
                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                        {loading
                            ? <Loader2 className="inline size-3 animate-spin" />
                            : `Page ${page} of ${totalPages}`
                        }
                    </span>
                    <div className="flex items-center gap-1">
                        <Button
                            size="icon"
                            variant="ghost"
                            disabled={page <= 1 || loading}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="size-7 bg-white/5 border border-white/5 hover:bg-white/10 disabled:opacity-30"
                        >
                            <ChevronLeft className="size-3" />
                        </Button>
                        <Button
                            size="icon"
                            variant="ghost"
                            disabled={page >= totalPages || loading}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            className="size-7 bg-white/5 border border-white/5 hover:bg-white/10 disabled:opacity-30"
                        >
                            <ChevronRight className="size-3" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    )
}
