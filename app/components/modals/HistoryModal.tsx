import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Loader2, MessageSquarePlus, Play } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { fetchSummaryCaps, SummaryCap } from '@/app/utils/api'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow,
    DataTableCell, DataTableEmpty, DataTableSkeletonRow,
} from '@/app/components/shared/DataTable'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { IconActionButton } from '@/app/components/shared/IconActionButton'
import { Tooltip } from '@/app/components/ui/tooltip'
import { ReplayVideoModal } from '@/app/components/shared/ReplayVideoModal'
import { useReplayWatch } from '@/app/hooks/useReplayWatch'
import { formatCapTime, formatAddedDate, displayMapName } from '@/app/utils/format'
import { getMedalIcon } from '@/app/utils/medals'

const PAGE_SIZE = 10

interface HistoryModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    accessToken?: string
    userAlias?: string | null
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
    onReview?: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
}

export function HistoryModal({
    open, onOpenChange, accessToken, userAlias, favoriteMapNames, onToggleFavorite, onReview, onMapSelect,
}: HistoryModalProps) {
    const [caps, setCaps] = useState<SummaryCap[]>([])
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [hasMore, setHasMore] = useState(false)

    const replay = useReplayWatch()

    const load = useCallback(async (targetPage: number) => {
        if (!accessToken) return
        setLoading(true)
        try {
            // Fetch one extra row to detect whether a next page exists.
            const data = await fetchSummaryCaps(accessToken, PAGE_SIZE + 1, (targetPage - 1) * PAGE_SIZE)
            setHasMore(data.length > PAGE_SIZE)
            setCaps(data.slice(0, PAGE_SIZE))
        } catch (err) {
            console.error('Failed to load history:', err)
            setCaps([])
            setHasMore(false)
        } finally {
            setLoading(false)
        }
    }, [accessToken])

    useEffect(() => {
        if (open && accessToken) load(page)
    }, [open, accessToken, page, load])

    useEffect(() => {
        if (!open) {
            setPage(1)
            setCaps([])
            setHasMore(false)
        }
    }, [open])

    return (
        <>
            <Modal
                isOpen={open}
                onClose={() => onOpenChange(false)}
                title="Recent Caps History"
                offsetSidebar
                maxWidth="min(95vw, 1100px)"
                className="bg-[#0a0a0b]/95 border-white/5 backdrop-blur-2xl"
            >
                <div className="flex flex-col gap-3">
                    <DataTableShell className="flex-none">
                        <DataTableHeaderRow>
                            <DataTableHeaderCell width="3.5rem"> </DataTableHeaderCell>
                            <DataTableHeaderCell>Map</DataTableHeaderCell>
                            <DataTableHeaderCell>Author</DataTableHeaderCell>
                            <DataTableHeaderCell align="right">Time</DataTableHeaderCell>
                            <DataTableHeaderCell align="right" width="8rem">Capped</DataTableHeaderCell>
                            <DataTableHeaderCell align="center" width="3rem"> </DataTableHeaderCell>
                            <DataTableHeaderCell align="center" width="3rem"> </DataTableHeaderCell>
                        </DataTableHeaderRow>
                        <tbody>
                            {loading && caps.length === 0 ? (
                                Array.from({ length: PAGE_SIZE }).map((_, i) => (
                                    <DataTableSkeletonRow key={i} columnCount={7} />
                                ))
                            ) : caps.length === 0 ? (
                                <DataTableEmpty colSpan={7} message="No cap history yet. Start capping!" />
                            ) : (
                                caps.map(cap => {
                                    const medalIcon = getMedalIcon(cap.medal)
                                    const isLoadingReplay = replay.loadingCapId === cap.id

                                    return (
                                        <DataTableRow key={cap.id}>
                                            <DataTableCell>
                                                <MapThumbnail mapName={cap.mapName} className="w-12 h-12" />
                                            </DataTableCell>
                                            <DataTableCell>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <FavoriteStar
                                                        name={cap.mapName}
                                                        isFavorited={favoriteMapNames.has(cap.mapName)}
                                                        onToggle={onToggleFavorite}
                                                        size="sm"
                                                    />
                                                    {onMapSelect ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => { onMapSelect(cap.mapName); onOpenChange(false) }}
                                                            className="font-bold text-white/90 truncate cursor-pointer hover:underline underline-offset-2 hover:text-white transition-colors text-left"
                                                        >
                                                            {displayMapName(cap.mapName)}
                                                        </button>
                                                    ) : (
                                                        <span className="font-bold text-white/90 truncate">
                                                            {displayMapName(cap.mapName)}
                                                        </span>
                                                    )}
                                                </div>
                                            </DataTableCell>
                                            <DataTableCell>
                                                <PlayerInfo alias={cap.author} size="sm" />
                                            </DataTableCell>
                                            <DataTableCell align="right">
                                                <div className="flex items-center justify-end gap-2">
                                                    {medalIcon && (
                                                        <Tooltip content={cap.medal} side="top">
                                                            <img
                                                                src={medalIcon}
                                                                alt={cap.medal}
                                                                className="h-4 w-auto object-contain shrink-0"
                                                            />
                                                        </Tooltip>
                                                    )}
                                                    <span className="font-mono font-black text-white/90 tracking-tight">
                                                        {formatCapTime(cap.time)}
                                                    </span>
                                                </div>
                                            </DataTableCell>
                                            <DataTableCell align="right">
                                                <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest whitespace-nowrap">
                                                    {formatAddedDate(cap.added)}
                                                </span>
                                            </DataTableCell>
                                            <DataTableCell align="center" className="px-2">
                                                <IconActionButton
                                                    variant="replay"
                                                    icon={Play}
                                                    iconFill
                                                    tooltip={!cap.verified ? 'No replay — cap not verified' : 'Watch run'}
                                                    disabled={!cap.verified}
                                                    loading={isLoadingReplay}
                                                    onClick={() => replay.openReplay({
                                                        capId: cap.id,
                                                        mapName: cap.mapName,
                                                        time: cap.time,
                                                        alias: userAlias ?? undefined,
                                                    })}
                                                />
                                            </DataTableCell>
                                            <DataTableCell align="center" className="px-2">
                                                {onReview && (
                                                    <IconActionButton
                                                        variant="review"
                                                        icon={MessageSquarePlus}
                                                        tooltip="Review this map"
                                                        onClick={() => onReview(cap.mapName)}
                                                    />
                                                )}
                                            </DataTableCell>
                                        </DataTableRow>
                                    )
                                })
                            )}
                        </tbody>
                    </DataTableShell>

                    <div className="flex items-center justify-between gap-3 px-1">
                        <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                            {loading
                                ? <Loader2 className="inline size-3 animate-spin" />
                                : `Page ${page}`
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
                                disabled={!hasMore || loading}
                                onClick={() => setPage(p => p + 1)}
                                className="size-7 bg-white/5 border border-white/5 hover:bg-white/10 disabled:opacity-30"
                            >
                                <ChevronRight className="size-3" />
                            </Button>
                        </div>
                    </div>
                </div>
            </Modal>

            <ReplayVideoModal state={replay.video} onClose={replay.clearVideo} />

            <Modal
                isOpen={replay.error !== null}
                onClose={replay.clearError}
                title="Replay not available"
                className="w-[95%] sm:w-[440px] max-w-md"
                offsetSidebar
            >
                <p className="text-sm text-muted-foreground">{replay.error}</p>
            </Modal>
        </>
    )
}
