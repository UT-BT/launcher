import { useCallback, useEffect, useMemo, useState } from 'react'
import { Play, Download, MessageSquareOff, ShieldCheck, Search, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchCapsForUser, type UserCapRow, type CapFilter } from '@/app/utils/api'
import { usePaginatedQuery } from '@/app/hooks/useAsync'
import { useNavState } from '@/app/components/navigation/useNavState'
import { formatAddedDate, displayMapName } from '@/app/utils/format'
import { getMedalIcon } from '@/app/utils/medals'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import { TeamRosterBadge } from '@/app/components/shared/TeamRosterBadge'
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
    type SortDirection, type ResponsiveColumn,
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

const DEBOUNCE_MS = 250

type SortField = 'added' | 'time' | 'map'

type CapColumnId = 'map' | 'medal' | 'time' | 'status' | 'added' | 'actions'

const CAP_COLUMNS: CapColumnId[] = ['map', 'medal', 'time', 'status', 'added', 'actions']

const COLUMN_WIDTH: Record<CapColumnId, string | undefined> = {
    map: '40%',
    medal: '3rem',
    time: '7rem',
    status: '6rem',
    added: '8rem',
    actions: '6rem',
}

const COLUMN_PRIORITY: Partial<Record<CapColumnId, number>> = {
    added: 40,
    status: 30,
    medal: 20,
    actions: 10,
}

const REQUIRED_COLUMNS = new Set<CapColumnId>(['map', 'time'])

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
    const [query, setQuery] = useNavState('caps.query', '')
    const [queryRaw, setQueryRaw] = useState(query)
    const [capFilter, setCapFilter] = useNavState<CapFilter>('caps.capFilter', 'all')
    const [favoritesOnly, setFavoritesOnly] = useNavState('caps.favoritesOnly', false)
    const [sortField, setSortField] = useNavState<SortField>('caps.sortField', 'added')
    const [sortDir, setSortDir] = useNavState<'asc' | 'desc'>('caps.sortDir', 'desc')
    const [capsPage, setCapsPage] = useNavState('caps.page', 1)
    const [capsPageSize, setCapsPageSize] = useNavState('caps.pageSize', 10)

    const replay = useReplayWatch()
    const demoDownload = useDemoDownload()

    const responsiveColumns = useMemo<ResponsiveColumn[]>(
        () => CAP_COLUMNS.map(id => ({
            id,
            width: COLUMN_WIDTH[id],
            priority: COLUMN_PRIORITY[id],
            required: REQUIRED_COLUMNS.has(id),
        })),
        [],
    )
    const [resolved, setResolved] = useState<Set<CapColumnId> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => {
        setResolved(ids as Set<CapColumnId>)
    }, [])
    const isVisible = (id: CapColumnId) => !resolved || resolved.has(id)
    const visibleColumnCount = CAP_COLUMNS.reduce((n, id) => n + (isVisible(id) ? 1 : 0), 0)

    // Debounce query input
    useEffect(() => {
        const t = setTimeout(() => setQuery(queryRaw), DEBOUNCE_MS)
        return () => clearTimeout(t)
    }, [queryRaw, setQuery])

    const {
        page, pageSize, items, total, totalPages, loading, error, setPage, setPageSize,
    } = usePaginatedQuery<UserCapRow>({
        enabled: true,
        errorMessage: 'Failed to load caps.',
        deps: [accessToken, userId, query, capFilter, favoritesOnly, sortField, sortDir],
        page: capsPage,
        pageSize: capsPageSize,
        onPageChange: setCapsPage,
        onPageSizeChange: setCapsPageSize,
        fetchPage: ({ limit, offset }) =>
            fetchCapsForUser(accessToken ?? '', userId, {
                limit, offset,
                mapFuzzy: query || undefined,
                capFilter,
                favoritesOnly,
                sort: sortField,
                order: sortDir,
            }),
    })

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir(field === 'map' ? 'asc' : 'desc')
        }
    }

    const dir = (field: SortField): SortDirection => sortField === field ? sortDir : null

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between gap-3 gap-y-2 px-4 py-3 border-b border-hairline/5 flex-wrap">
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
                            className="w-full sm:w-44 pl-7 pr-2 py-1 bg-card/50 border border-hairline/10 rounded text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-accent-500/50"
                        />
                    </div>
                    <select
                        value={capFilter}
                        onChange={e => setCapFilter(e.target.value as CapFilter)}
                        style={{ colorScheme: 'dark' }}
                        className="px-2 py-1 bg-card/50 border border-hairline/10 rounded text-xs text-foreground focus:outline-none focus:border-accent-500/50 cursor-pointer"
                    >
                        <option value="all" className="bg-[#0f1115]">All Caps</option>
                        <option value="verified" className="bg-[#0f1115]">Verified Caps</option>
                        <option value="certified" className="bg-[#0f1115]">Certified Caps</option>
                        <option value="casual" className="bg-[#0f1115]">Casual Caps</option>
                    </select>
                    <Tooltip content={favoritesOnly ? 'Showing favorites only' : 'Show favorites only'} side="top">
                        <button
                            type="button"
                            onClick={() => setFavoritesOnly(!favoritesOnly)}
                            aria-pressed={favoritesOnly}
                            className={cn(
                                'inline-flex items-center justify-center size-7 rounded-md border transition-colors cursor-pointer',
                                favoritesOnly
                                    ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/25'
                                    : 'bg-card/50 border-hairline/10 text-muted-foreground hover:text-foreground hover:border-hairline/20',
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

            <DataTableShell
                className="!flex-none !min-h-0 !overflow-visible !rounded-none !border-0"
                responsive={{ columns: responsiveColumns, onResolve: handleResolve }}
            >
                <DataTableHeaderRow>
                    {isVisible('map') && <DataTableHeaderCell width="40%" sortable sortDirection={dir('map')} onSort={() => handleSort('map')}>Map</DataTableHeaderCell>}
                    {isVisible('medal') && <DataTableHeaderCell align="center" width="3rem"><span className="sr-only">Medal</span></DataTableHeaderCell>}
                    {isVisible('time') && <DataTableHeaderCell align="right" width="7rem" sortable sortDirection={dir('time')} onSort={() => handleSort('time')}>Time</DataTableHeaderCell>}
                    {isVisible('status') && <DataTableHeaderCell align="center" width="6rem">Status</DataTableHeaderCell>}
                    {isVisible('added') && <DataTableHeaderCell align="right" width="8rem" sortable sortDirection={dir('added')} onSort={() => handleSort('added')}>Date</DataTableHeaderCell>}
                    {isVisible('actions') && <DataTableHeaderCell align="center" width="6rem"><span className="sr-only">Actions</span></DataTableHeaderCell>}
                </DataTableHeaderRow>
                <tbody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <DataTableSkeletonRow key={i} columnCount={visibleColumnCount} />
                        ))
                    ) : items.length === 0 ? (
                        <DataTableEmpty colSpan={visibleColumnCount} message={query ? 'No caps match that search.' : 'No caps yet.'} />
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
                                    {isVisible('map') && (
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
                                                <div className="flex flex-col gap-1 min-w-0">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="text-sm font-semibold text-foreground truncate min-w-0">
                                                            {displayMapName(cap.mapName)}
                                                        </span>
                                                        {cap.isTeam && (
                                                            <TeamRosterBadge members={cap.teamMembers} currentUserId={String(userId)} />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </DataTableCell>
                                    )}
                                    {isVisible('medal') && (
                                        <DataTableCell align="center">
                                            {medalIcon && (
                                                <Tooltip content={cap.medal} side="top">
                                                    <img src={medalIcon} alt={cap.medal} className="size-4 inline-block shrink-0 object-contain max-w-none" />
                                                </Tooltip>
                                            )}
                                        </DataTableCell>
                                    )}
                                    {isVisible('time') && (
                                        <DataTableCell align="right">
                                            <CapTimeLink
                                                capId={cap.isTeam ? undefined : cap.id}
                                                teamCapId={cap.isTeam ? cap.teamCapId ?? undefined : undefined}
                                                seconds={cap.time}
                                                className="text-sm font-mono tabular-nums font-bold text-foreground"
                                            />
                                        </DataTableCell>
                                    )}
                                    {isVisible('status') && (
                                        <DataTableCell align="center">
                                            {renderCapStatus(cap)}
                                        </DataTableCell>
                                    )}
                                    {isVisible('added') && (
                                        <DataTableCell align="right">
                                            <Tooltip content={exactTimestamp} side="top">
                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                    {cap.added ? formatAddedDate(cap.added) : '—'}
                                                </span>
                                            </Tooltip>
                                        </DataTableCell>
                                    )}
                                    {isVisible('actions') && (
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
                                    )}
                                </DataTableRow>
                            )
                        })
                    )}
                </tbody>
            </DataTableShell>

            {!loading && total > 0 && (
                <div className="px-4 py-3 border-t border-hairline/5">
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
