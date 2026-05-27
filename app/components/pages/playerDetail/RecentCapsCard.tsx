import { useEffect, useState } from 'react'
import { Play, Download, MessageSquareOff, ShieldCheck, Search, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchCapsForUser, type UserCapRow, type CapFilter } from '@/app/utils/api'
import { formatCapTime, formatAddedDate, displayMapName } from '@/app/utils/format'
import { getMedalIcon } from '@/app/utils/medals'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { IconActionButton } from '@/app/components/shared/IconActionButton'
import { ReplayVideoModal } from '@/app/components/shared/ReplayVideoModal'
import { DemoDownloadStatusModal } from '@/app/components/shared/DemoDownloadStatusModal'
import { useReplayWatch } from '@/app/hooks/useReplayWatch'
import { useDemoDownload } from '@/app/hooks/useDemoDownload'
import { Tooltip } from '@/app/components/ui/tooltip'
import { Modal } from '@/app/components/ui/modal'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell,
    DataTableRow, DataTableCell, DataTableEmpty, DataTableSkeletonRow,
    type SortDirection,
} from '@/app/components/shared/DataTable'
import { PaginationBar } from '@/app/components/ui/pagination'

interface RecentCapsCardProps {
    accessToken: string | undefined
    userId: string | number
    favoriteMapNames: Set<string>
    onToggleFavorite?: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
    canEditFavorites: boolean
    tabsSlot?: React.ReactNode
}

const SKELETON_COL_COUNT = 6
const DEBOUNCE_MS = 250

type SortField = 'added' | 'time' | 'map'

// CapType enum values (mirror data_service/endpoints/cap/model.py)
const CAP_TYPE_UTBT_CERTIFIED = 2
const CAP_TYPE_I4GAMES = 3

function renderCapStatus(cap: UserCapRow) {
    if (cap.disallowed) {
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-red-500/15 border border-red-500/40 text-red-300">
                Disallowed
            </span>
        )
    }
    if (cap.verified) {
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                <ShieldCheck className="size-2.5" />
                Verified
            </span>
        )
    }
    if (cap.cap_type === CAP_TYPE_UTBT_CERTIFIED) {
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 border border-blue-500/40 text-blue-300">
                Certified
            </span>
        )
    }
    if (cap.cap_type === CAP_TYPE_I4GAMES) {
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 border border-purple-500/40 text-purple-300">
                I4Games
            </span>
        )
    }
    return <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Casual</span>
}

export function RecentCapsCard({
    accessToken, userId, favoriteMapNames, onToggleFavorite, onMapSelect, canEditFavorites, tabsSlot,
}: RecentCapsCardProps) {
    const [page, setPage] = useState(1)
    const [pageSize, setPageSize] = useState(10)
    const [items, setItems] = useState<UserCapRow[]>([])
    const [total, setTotal] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [queryRaw, setQueryRaw] = useState('')
    const [query, setQuery] = useState('')
    const [capFilter, setCapFilter] = useState<CapFilter>('all')
    const [favoritesOnly, setFavoritesOnly] = useState(false)
    const [sortField, setSortField] = useState<SortField>('added')
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

    const replay = useReplayWatch()
    const demoDownload = useDemoDownload()

    // Debounce query input
    useEffect(() => {
        const t = setTimeout(() => setQuery(queryRaw), DEBOUNCE_MS)
        return () => clearTimeout(t)
    }, [queryRaw])

    // Reset to page 1 when filters change
    useEffect(() => { setPage(1) }, [query, capFilter, favoritesOnly, sortField, sortDir])

    useEffect(() => {
        let cancelled = false
        if (!accessToken) return
        setLoading(true)
        setError(null)
        const offset = (page - 1) * pageSize
        fetchCapsForUser(accessToken, userId, {
            limit: pageSize, offset,
            mapFuzzy: query || undefined,
            capFilter,
            favoritesOnly,
            sort: sortField,
            order: sortDir,
        })
            .then(res => {
                if (cancelled) return
                setItems(res.items)
                setTotal(res.total)
            })
            .catch(err => {
                if (cancelled) return
                console.error('Failed to load caps:', err)
                setError('Failed to load caps.')
            })
            .finally(() => { if (!cancelled) setLoading(false) })
        return () => { cancelled = true }
    }, [accessToken, userId, page, pageSize, query, capFilter, favoritesOnly, sortField, sortDir])

    const totalPages = Math.max(1, Math.ceil(total / pageSize))

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir(field === 'map' ? 'asc' : 'desc')
        }
    }

    const dir = (field: SortField): SortDirection => sortField === field ? sortDir : null

    return (
        <div className="bg-card/30 border border-white/5 rounded-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 gap-y-2 px-4 py-3 border-b border-white/5 flex-wrap">
                <div className="flex items-center gap-3 flex-wrap">
                    {tabsSlot}
                </div>
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                    <div className="relative flex-1 sm:flex-none">
                        <Search className="size-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                            type="text"
                            value={queryRaw}
                            onChange={e => setQueryRaw(e.target.value)}
                            placeholder="Search map…"
                            className="w-full sm:w-44 pl-7 pr-2 py-1 bg-card/50 border border-white/10 rounded text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-blue-500/50"
                        />
                    </div>
                    <select
                        value={capFilter}
                        onChange={e => setCapFilter(e.target.value as CapFilter)}
                        style={{ colorScheme: 'dark' }}
                        className="px-2 py-1 bg-card/50 border border-white/10 rounded text-xs text-white focus:outline-none focus:border-blue-500/50 cursor-pointer"
                    >
                        <option value="all" className="bg-[#0f1115]">All Caps</option>
                        <option value="verified" className="bg-[#0f1115]">Verified Caps</option>
                        <option value="certified" className="bg-[#0f1115]">Certified Caps</option>
                        <option value="casual" className="bg-[#0f1115]">Casual Caps</option>
                    </select>
                    <Tooltip content={favoritesOnly ? 'Showing favorites only' : 'Show favorites only'} side="top">
                        <button
                            type="button"
                            onClick={() => setFavoritesOnly(v => !v)}
                            aria-pressed={favoritesOnly}
                            className={cn(
                                'inline-flex items-center justify-center size-7 rounded-md border transition-colors cursor-pointer',
                                favoritesOnly
                                    ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/25'
                                    : 'bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20',
                            )}
                        >
                            <Star className={cn('size-3.5', favoritesOnly && 'fill-current')} />
                        </button>
                    </Tooltip>
                </div>
            </div>

            {error && (
                <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-red-400 text-xs">
                    {error}
                </div>
            )}

            <DataTableShell className="!flex-none !min-h-0 !overflow-visible !rounded-none !border-0">
                <DataTableHeaderRow>
                    <DataTableHeaderCell width="40%" sortable sortDirection={dir('map')} onSort={() => handleSort('map')}>Map</DataTableHeaderCell>
                    <DataTableHeaderCell align="center" width="3rem"><span className="sr-only">Medal</span></DataTableHeaderCell>
                    <DataTableHeaderCell align="right" width="7rem" sortable sortDirection={dir('time')} onSort={() => handleSort('time')}>Time</DataTableHeaderCell>
                    <DataTableHeaderCell align="center" width="6rem">Status</DataTableHeaderCell>
                    <DataTableHeaderCell align="right" width="8rem" sortable sortDirection={dir('added')} onSort={() => handleSort('added')}>Date</DataTableHeaderCell>
                    <DataTableHeaderCell align="center" width="6rem"><span className="sr-only">Actions</span></DataTableHeaderCell>
                </DataTableHeaderRow>
                <tbody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <DataTableSkeletonRow key={i} columnCount={SKELETON_COL_COUNT} />
                        ))
                    ) : items.length === 0 ? (
                        <DataTableEmpty colSpan={SKELETON_COL_COUNT} message={query ? 'No caps match that search.' : 'No caps yet.'} />
                    ) : (
                        items.map(cap => {
                            const medalIcon = getMedalIcon(cap.medal.toLowerCase())
                            const exactTimestamp = cap.added ? (() => {
                                const d = new Date(cap.added)
                                return isNaN(d.getTime()) ? cap.added : d.toLocaleString()
                            })() : '—'
                            const canPlay = cap.verified && !cap.disallowed
                            return (
                                <DataTableRow
                                    key={cap.id}
                                    className={cn('cursor-pointer', cap.disallowed && 'opacity-60')}
                                    onClick={() => onMapSelect?.(cap.mapName)}
                                >
                                    <DataTableCell>
                                        <div className="flex items-center gap-2 min-w-0">
                                            <MapThumbnail mapName={cap.mapName} className="size-8 shrink-0" />
                                            {onToggleFavorite && (
                                                <FavoriteStar
                                                    name={cap.mapName}
                                                    isFavorited={favoriteMapNames.has(cap.mapName)}
                                                    onToggle={onToggleFavorite}
                                                    size="sm"
                                                    disabled={!canEditFavorites}
                                                />
                                            )}
                                            <span className="text-sm font-semibold text-white truncate min-w-0">
                                                {displayMapName(cap.mapName)}
                                            </span>
                                        </div>
                                    </DataTableCell>
                                    <DataTableCell align="center">
                                        {medalIcon && (
                                            <Tooltip content={cap.medal} side="top">
                                                <img src={medalIcon} alt={cap.medal} className="size-4 inline-block" />
                                            </Tooltip>
                                        )}
                                    </DataTableCell>
                                    <DataTableCell align="right">
                                        <span className="text-sm font-mono tabular-nums font-bold text-white">
                                            {formatCapTime(cap.time)}
                                        </span>
                                    </DataTableCell>
                                    <DataTableCell align="center">
                                        {renderCapStatus(cap)}
                                    </DataTableCell>
                                    <DataTableCell align="right">
                                        <Tooltip content={exactTimestamp} side="top">
                                            <span className="text-xs text-muted-foreground tabular-nums">
                                                {cap.added ? formatAddedDate(cap.added) : '—'}
                                            </span>
                                        </Tooltip>
                                    </DataTableCell>
                                    <DataTableCell align="center" className="px-2">
                                        <div className="inline-flex items-center gap-1">
                                            <IconActionButton
                                                variant="replay"
                                                icon={canPlay ? Play : MessageSquareOff}
                                                iconFill={canPlay}
                                                tooltip={canPlay ? 'Watch run' : 'No replay — cap not verified'}
                                                disabled={!canPlay}
                                                loading={replay.loadingCapId === cap.id}
                                                onClick={() => replay.openReplay({
                                                    capId: cap.id,
                                                    mapName: cap.mapName,
                                                    time: cap.time,
                                                })}
                                            />
                                            <IconActionButton
                                                variant="download"
                                                icon={Download}
                                                tooltip={canPlay ? 'Download demo' : 'No demo — cap not verified'}
                                                disabled={!canPlay}
                                                onClick={() => demoDownload.start(
                                                    { id: cap.id, alias: undefined, cap_time_seconds: cap.time } as any,
                                                    cap.mapName,
                                                )}
                                            />
                                        </div>
                                    </DataTableCell>
                                </DataTableRow>
                            )
                        })
                    )}
                </tbody>
            </DataTableShell>

            {!loading && total > 0 && (
                <div className="px-4 py-3 border-t border-white/5">
                    <PaginationBar
                        page={page}
                        totalPages={totalPages}
                        pageSize={pageSize}
                        totalForCount={total}
                        pageSizePreference={pageSize}
                        autoPageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(pref) => { setPageSize(pref === 'auto' ? 10 : pref); setPage(1) }}
                    />
                </div>
            )}

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
            <DemoDownloadStatusModal state={demoDownload.download} onClose={demoDownload.clear} />
        </div>
    )
}
