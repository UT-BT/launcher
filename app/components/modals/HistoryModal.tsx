import { useState, useEffect, useCallback, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Loader2, MessageSquarePlus, Play } from 'lucide-react'
import { Modal } from '@/app/components/ui/modal'
import { Button } from '@/app/components/ui/button'
import { fetchSummaryCaps, SummaryCap } from '@/app/utils/api'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow,
    DataTableCell, DataTableEmpty, DataTableSkeletonRow, type ResponsiveColumn,
} from '@/app/components/shared/DataTable'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { TeamHolders } from '@/app/components/shared/TeamHolders'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { NavLink } from '@/app/components/navigation/NavLink'
import { IconActionButton } from '@/app/components/shared/IconActionButton'
import { Tooltip } from '@/app/components/ui/tooltip'
import { ReplayVideoModal } from '@/app/components/shared/ReplayVideoModal'
import { useReplayWatch } from '@/app/hooks/useReplayWatch'
import { useAutoPageSize } from '@/app/hooks/useAutoPageSize'
import { formatAddedDate, displayMapName } from '@/app/utils/format'
import { getMedalIcon } from '@/app/utils/medals'

const TABLE_ROW_HEIGHT_PX = 72
const MODAL_CHROME_PX = 290
const AUTO_PAGE_SIZE_MIN_ROWS = 4
const AUTO_PAGE_SIZE_MAX_ROWS = 20

type HistoryColumnId = 'thumbnail' | 'map' | 'author' | 'time' | 'capped' | 'replay' | 'review'

const HISTORY_COLUMNS: ResponsiveColumn[] = [
    { id: 'thumbnail', width: '3.5rem', required: true },
    { id: 'map', required: true },
    { id: 'author', width: '8rem', required: true },
    { id: 'time', width: '9rem', required: true },
    { id: 'capped', width: '9rem', priority: 20 },
    { id: 'replay', width: '3rem', required: true },
    { id: 'review', width: '3rem', required: true },
]

function computePageSize(): number {
    if (typeof window === 'undefined') return 9
    const modalHeight = window.innerHeight * 0.9
    const usable = Math.max(modalHeight - MODAL_CHROME_PX, TABLE_ROW_HEIGHT_PX * AUTO_PAGE_SIZE_MIN_ROWS)
    return Math.min(AUTO_PAGE_SIZE_MAX_ROWS, Math.max(AUTO_PAGE_SIZE_MIN_ROWS, Math.floor(usable / TABLE_ROW_HEIGHT_PX)))
}

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
    const pageSize = useAutoPageSize(computePageSize)
    const [caps, setCaps] = useState<SummaryCap[]>([])
    const [page, setPage] = useState(1)
    const [loading, setLoading] = useState(false)
    const [hasMore, setHasMore] = useState(false)

    const replay = useReplayWatch()

    const [resolved, setResolved] = useState<Set<HistoryColumnId> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => { setResolved(ids as Set<HistoryColumnId>) }, [])
    const isVisible = useCallback(
        (id: HistoryColumnId) => !resolved || resolved.has(id),
        [resolved],
    )
    const visibleColumnCount = useMemo(
        () => HISTORY_COLUMNS.reduce((n, c) => (!resolved || resolved.has(c.id as HistoryColumnId) ? n + 1 : n), 0),
        [resolved],
    )

    const load = useCallback(async (targetPage: number) => {

        setLoading(true)
        try {
            // Fetch one extra row to detect whether a next page exists.
            const data = await fetchSummaryCaps(accessToken ?? '', pageSize + 1, (targetPage - 1) * pageSize)
            setHasMore(data.length > pageSize)
            setCaps(data.slice(0, pageSize))
        } catch (err) {
            console.error('Failed to load history:', err)
            setCaps([])
            setHasMore(false)
        } finally {
            setLoading(false)
        }
    }, [accessToken, pageSize])

    useEffect(() => {
        if (open) load(page)
    }, [open, accessToken, page, load])

    useEffect(() => {
        if (!open) {
            setPage(1)
            setCaps([])
            setHasMore(false)
        }
    }, [open])

    const compactRows = loading && caps.length === 0 ? (
        Array.from({ length: pageSize }).map((_, i) => (
            <div key={i} role="listitem" className="p-3 border-b border-hairline/5 last:border-0 animate-pulse">
                <div className="h-14 rounded bg-hairline/5" />
            </div>
        ))
    ) : caps.length === 0 ? (
        <div role="listitem" className="px-4 py-12 text-center text-sm text-muted-foreground">
            No cap history yet. Start capping!
        </div>
    ) : caps.map(cap => {
        const medalIcon = getMedalIcon(cap.medal)
        return (
            <div key={cap.id} role="listitem" className="grid grid-cols-[3rem_minmax(0,1fr)_auto] gap-3 p-3 border-b border-hairline/5 last:border-0">
                <MapThumbnail mapName={cap.mapName} className="size-12" />
                <div className="min-w-0 space-y-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                        <FavoriteStar name={cap.mapName} isFavorited={favoriteMapNames.has(cap.mapName)} onToggle={onToggleFavorite} size="md" />
                        {onMapSelect ? (
                            <NavLink
                                view="maps-detail"
                                params={{ mapName: cap.mapName }}
                                onActivate={() => { onMapSelect(cap.mapName); onOpenChange(false) }}
                                className="font-bold text-foreground hover:text-accent-300 text-left truncate"
                            >
                                {displayMapName(cap.mapName)}
                            </NavLink>
                        ) : <span className="font-bold text-foreground truncate">{displayMapName(cap.mapName)}</span>}
                    </div>
                    {cap.isTeam && cap.teamMembers?.length ? (
                        <TeamHolders members={cap.teamMembers} size="sm" />
                    ) : (
                        <PlayerInfo alias={cap.author} size="sm" />
                    )}
                    <span className="block text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">
                        {formatAddedDate(cap.added)}
                    </span>
                </div>
                <div className="flex flex-col items-end justify-between gap-2">
                    <div className="inline-flex items-center gap-1.5">
                        {medalIcon && <img src={medalIcon} alt={cap.medal} className="size-4 object-contain" />}
                        <CapTimeLink
                            capId={cap.isTeam ? undefined : cap.id}
                            teamCapId={cap.isTeam ? cap.teamCapId ?? undefined : undefined}
                            seconds={cap.time}
                            onNavigate={() => onOpenChange(false)}
                            className="font-mono font-black text-foreground/90"
                        />
                    </div>
                    <div className="flex items-center gap-1">
                        {cap.verified && (
                            <IconActionButton
                                variant="replay"
                                icon={Play}
                                iconFill
                                tooltip={cap.demoCapId ? 'Watch run' : 'No replay available for this run'}
                                disabled={!cap.demoCapId}
                                loading={replay.loadingCapId === cap.id}
                                onClick={() => replay.openReplay({
                                    capId: cap.demoCapId ?? null,
                                    loadingKey: cap.id,
                                    mapName: cap.mapName,
                                    time: cap.time,
                                    alias: userAlias ?? undefined,
                                })}
                            />
                        )}
                        {onReview && (
                            <IconActionButton variant="review" icon={MessageSquarePlus} tooltip="Review this map" onClick={() => onReview(cap.mapName)} />
                        )}
                    </div>
                </div>
            </div>
        )
    })

    return (
        <>
            <Modal
                isOpen={open}
                onClose={() => onOpenChange(false)}
                title="Recent Caps History"
                offsetSidebar
                maxWidth="min(95vw, 1100px)"
                className="bg-card/95 border-hairline/5 backdrop-blur-2xl"
            >
                <div className="flex flex-col gap-3">
                    <DataTableShell
                        className="flex-none"
                        responsive={{
                            columns: HISTORY_COLUMNS,
                            onResolve: handleResolve,
                            compactContent: compactRows,
                            compactAriaLabel: 'Recent caps',
                        }}
                    >
                        <DataTableHeaderRow>
                            {isVisible('thumbnail') && <DataTableHeaderCell width="3.5rem"> </DataTableHeaderCell>}
                            <DataTableHeaderCell className="pl-24">Map</DataTableHeaderCell>
                            {isVisible('author') && <DataTableHeaderCell align="center" width="8rem">Author</DataTableHeaderCell>}
                            {isVisible('time') && <DataTableHeaderCell align="center" width="9rem">Time</DataTableHeaderCell>}
                            {isVisible('capped') && <DataTableHeaderCell align="center" width="7rem">Capped</DataTableHeaderCell>}
                            {isVisible('replay') && <DataTableHeaderCell align="center" width="3rem"> </DataTableHeaderCell>}
                            {isVisible('review') && <DataTableHeaderCell align="center" width="3rem"> </DataTableHeaderCell>}
                        </DataTableHeaderRow>
                        <tbody>
                            {loading && caps.length === 0 ? (
                                Array.from({ length: pageSize }).map((_, i) => (
                                    <DataTableSkeletonRow key={i} columnCount={visibleColumnCount} />
                                ))
                            ) : caps.length === 0 ? (
                                <DataTableEmpty colSpan={visibleColumnCount} message="No cap history yet. Start capping!" />
                            ) : (
                                caps.map(cap => {
                                    const medalIcon = getMedalIcon(cap.medal)
                                    const isLoadingReplay = replay.loadingCapId === cap.id

                                    return (
                                        <DataTableRow key={cap.id}>
                                            {isVisible('thumbnail') && (
                                                <DataTableCell>
                                                    <MapThumbnail mapName={cap.mapName} className="w-12 h-12" />
                                                </DataTableCell>
                                            )}
                                            <DataTableCell>
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <FavoriteStar
                                                        name={cap.mapName}
                                                        isFavorited={favoriteMapNames.has(cap.mapName)}
                                                        onToggle={onToggleFavorite}
                                                        size="md"
                                                    />
                                                    <div className="flex flex-col gap-1 min-w-0">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            {onMapSelect ? (
                                                                <NavLink
                                                                    view="maps-detail"
                                                                    params={{ mapName: cap.mapName }}
                                                                    onActivate={() => { onMapSelect(cap.mapName); onOpenChange(false) }}
                                                                    className="font-bold text-foreground hover:text-accent-300 underline-offset-4 transition-colors cursor-pointer text-left text-md truncate"
                                                                >
                                                                    {displayMapName(cap.mapName)}
                                                                </NavLink>
                                                            ) : (
                                                                <span className="font-bold text-foreground text-md truncate">
                                                                    {displayMapName(cap.mapName)}
                                                                </span>
                                                            )}
                                                            {cap.isTeam && (
                                                                <span className="shrink-0 inline-flex items-center h-4 px-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[9px] font-bold uppercase tracking-wider">
                                                                    Team
                                                                </span>
                                                            )}
                                                        </div>
                                                        {cap.isTeam && cap.teamMembers && cap.teamMembers.length > 0 && (
                                                            <TeamHolders members={cap.teamMembers} size="sm" />
                                                        )}
                                                    </div>
                                                </div>
                                            </DataTableCell>
                                            {isVisible('author') && (
                                                <DataTableCell align="center" className="text-muted-foreground">
                                                    <PlayerInfo alias={cap.author} size="md" className="mx-auto" />
                                                </DataTableCell>
                                            )}
                                            {isVisible('time') && (
                                                <DataTableCell align="center" className="font-mono text-sm text-muted-foreground">
                                                    <div className="inline-flex items-center justify-center gap-2">
                                                        {medalIcon && (
                                                            <Tooltip content={cap.medal} side="top">
                                                                <img
                                                                    src={medalIcon}
                                                                    alt={cap.medal}
                                                                    className="size-4 object-contain shrink-0 max-w-none"
                                                                />
                                                            </Tooltip>
                                                        )}
                                                        <CapTimeLink
                                                            capId={cap.isTeam ? undefined : cap.id}
                                                            teamCapId={cap.isTeam ? cap.teamCapId ?? undefined : undefined}
                                                            seconds={cap.time}
                                                            onNavigate={() => onOpenChange(false)}
                                                            className="font-black text-foreground/90 hover:text-foreground tracking-tight"
                                                        />
                                                    </div>
                                                </DataTableCell>
                                            )}
                                            {isVisible('capped') && (
                                                <DataTableCell align="center" className="text-sm text-muted-foreground whitespace-nowrap">
                                                    <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest whitespace-nowrap">
                                                        {formatAddedDate(cap.added)}
                                                    </span>
                                                </DataTableCell>
                                            )}
                                            {isVisible('replay') && (
                                                <DataTableCell align="center" className="px-2">
                                                    {cap.verified && (
                                                        <IconActionButton
                                                            variant="replay"
                                                            icon={Play}
                                                            iconFill
                                                            tooltip={cap.demoCapId ? 'Watch run' : 'No replay available for this run'}
                                                            disabled={!cap.demoCapId}
                                                            loading={isLoadingReplay}
                                                            onClick={() => replay.openReplay({
                                                                capId: cap.demoCapId ?? null,
                                                                loadingKey: cap.id,
                                                                mapName: cap.mapName,
                                                                time: cap.time,
                                                                alias: userAlias ?? undefined,
                                                            })}
                                                        />
                                                    )}
                                                </DataTableCell>
                                            )}
                                            {isVisible('review') && (
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
                                            )}
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
                                className="size-7 bg-hairline/5 border border-hairline/5 hover:bg-hairline/10 disabled:opacity-30"
                            >
                                <ChevronLeft className="size-3" />
                            </Button>
                            <Button
                                size="icon"
                                variant="ghost"
                                disabled={!hasMore || loading}
                                onClick={() => setPage(p => p + 1)}
                                className="size-7 bg-hairline/5 border border-hairline/5 hover:bg-hairline/10 disabled:opacity-30"
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
