import { useEffect, useState, useCallback } from 'react'
import { MessageSquarePlus, ChevronLeft, ChevronRight, Loader2, AlertTriangle, RefreshCw } from 'lucide-react'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow,
    DataTableCell, DataTableEmpty, DataTableSkeletonRow,
} from '@/app/components/shared/DataTable'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { IconActionButton } from '@/app/components/shared/IconActionButton'
import { Button } from '@/app/components/ui/button'
import { displayMapName } from '@/app/utils/format'
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
    const [error, setError] = useState<string | null>(null)

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    const load = useCallback(async (targetPage: number) => {
        if (!accessToken) return
        setLoading(true)
        setError(null)
        try {
            const data = await fetchPendingReviews(accessToken, PAGE_SIZE, (targetPage - 1) * PAGE_SIZE)
            setItems(data.items)
            setTotal(data.total)
        } catch (err) {
            console.error('Failed to load pending reviews', err)
            setError('Failed to load pending reviews.')
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
                    {error && items.length === 0 ? (
                        <tr>
                            <td colSpan={4} className="px-4 py-8">
                                <div className="flex flex-col items-center gap-3 text-center">
                                    <AlertTriangle className="size-6 text-red-500/50" />
                                    <p className="text-sm text-red-400 font-medium">{error}</p>
                                    <Button onClick={() => load(page)} variant="outline" size="sm" className="gap-2">
                                        <RefreshCw className="size-3" /> Try Again
                                    </Button>
                                </div>
                            </td>
                        </tr>
                    ) : loading && items.length === 0 ? (
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
                                        {displayMapName(rev.mapName)}
                                    </span>
                                </DataTableCell>
                                <DataTableCell align="right">
                                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                                        {rev.timeAgo}
                                    </span>
                                </DataTableCell>
                                <DataTableCell align="center" className="px-2">
                                    <IconActionButton
                                        variant="review"
                                        icon={MessageSquarePlus}
                                        tooltip="Review this map"
                                        onClick={() => onReview(rev.mapName)}
                                    />
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
