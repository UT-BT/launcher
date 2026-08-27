import { useCallback, useEffect, useMemo, useState } from 'react'
import { Play, Download, MessageSquareOff, ShieldCheck, Search, Trophy, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fetchPersonalBestsForUser, type UserPersonalBestRow, type CapFilter } from '@/app/utils/api'
import { usePaginatedQuery } from '@/app/hooks/useAsync'
import { useNavState } from '@/app/components/navigation/useNavState'
import { formatAddedDate, displayMapName } from '@/app/utils/format'
import { getMedalIcon } from '@/app/utils/medals'
import { CapTimeLink } from '@/app/components/shared/CapTimeLink'
import { capRowDemoCapId } from '@/app/components/shared/runDemo'
import { TeamRosterBadge } from '@/app/components/shared/TeamRosterBadge'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { MapNavLink } from '@/app/components/shared/MapNavLink'
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

interface PersonalBestsCardProps {
    accessToken: string | undefined
    userId: string | number
    favoriteMapNames: Set<string>
    onToggleFavorite?: (mapName: string) => void
    onMapSelect?: (mapName: string) => void
    canEditFavorites: boolean
    tabsSlot?: React.ReactNode
}

const DEBOUNCE_MS = 250
type SortField = 'time' | 'added' | 'map'

type PbColumnId = 'map' | 'medal' | 'time' | 'status' | 'added' | 'actions'

const PB_COLUMNS: PbColumnId[] = ['map', 'medal', 'time', 'status', 'added', 'actions']

const COLUMN_WIDTH: Record<PbColumnId, string | undefined> = {
    map: undefined,
    medal: '3rem',
    time: '8rem',
    status: '6rem',
    added: '8rem',
    actions: '6rem',
}

const COLUMN_PRIORITY: Partial<Record<PbColumnId, number>> = {
    added: 40,
    status: 30,
    medal: 20,
    actions: 10,
}

const REQUIRED_COLUMNS = new Set<PbColumnId>(['map', 'time'])

const CAP_TYPE_UTBT_CERTIFIED = 2
const CAP_TYPE_I4GAMES = 3

function renderPbStatus(pb: UserPersonalBestRow) {
    if (pb.verified) {
        return (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
                <ShieldCheck className="size-2.5" />
                Verified
            </span>
        )
    }
    if (pb.cap_type === CAP_TYPE_UTBT_CERTIFIED) {
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-500/15 border border-blue-500/40 text-blue-300">
                Certified
            </span>
        )
    }
    if (pb.cap_type === CAP_TYPE_I4GAMES) {
        return (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-purple-500/15 border border-purple-500/40 text-purple-300">
                I4Games
            </span>
        )
    }
    return <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Casual</span>
}

export function PersonalBestsCard({
    accessToken, userId, favoriteMapNames, onToggleFavorite, onMapSelect, canEditFavorites, tabsSlot,
}: PersonalBestsCardProps) {
    const [query, setQuery] = useNavState('pbs.query', '')
    const [queryRaw, setQueryRaw] = useState(query)
    const [capFilter, setCapFilter] = useNavState<CapFilter>('pbs.capFilter', 'all')
    const [favoritesOnly, setFavoritesOnly] = useNavState('pbs.favoritesOnly', false)
    const [sortField, setSortField] = useNavState<SortField>('pbs.sortField', 'time')
    const [sortDir, setSortDir] = useNavState<'asc' | 'desc'>('pbs.sortDir', 'asc')
    const [pbsPage, setPbsPage] = useNavState('pbs.page', 1)
    const [pbsPageSize, setPbsPageSize] = useNavState('pbs.pageSize', 10)

    const replay = useReplayWatch()
    const demoDownload = useDemoDownload()

    const responsiveColumns = useMemo<ResponsiveColumn[]>(
        () => PB_COLUMNS.map(id => ({
            id,
            width: COLUMN_WIDTH[id],
            priority: COLUMN_PRIORITY[id],
            required: REQUIRED_COLUMNS.has(id),
        })),
        [],
    )
    const [resolved, setResolved] = useState<Set<PbColumnId> | null>(null)
    const handleResolve = useCallback((ids: Set<string>) => {
        setResolved(ids as Set<PbColumnId>)
    }, [])
    const isVisible = (id: PbColumnId) => !resolved || resolved.has(id)
    const visibleColumnCount = PB_COLUMNS.reduce((n, id) => n + (isVisible(id) ? 1 : 0), 0)

    useEffect(() => {
        const t = setTimeout(() => setQuery(queryRaw), DEBOUNCE_MS)
        return () => clearTimeout(t)
    }, [queryRaw, setQuery])

    const {
        page, pageSize, items, total, totalPages, loading, error, setPage, setPageSize,
    } = usePaginatedQuery<UserPersonalBestRow>({
        enabled: true,
        errorMessage: 'Failed to load personal bests.',
        deps: [accessToken, userId, query, capFilter, favoritesOnly, sortField, sortDir],
        page: pbsPage,
        pageSize: pbsPageSize,
        onPageChange: setPbsPage,
        onPageSizeChange: setPbsPageSize,
        fetchPage: ({ limit, offset }) =>
            fetchPersonalBestsForUser(accessToken ?? '', userId, {
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
            setSortDir(field === 'map' || field === 'time' ? 'asc' : 'desc')
        }
    }
    const dir = (field: SortField): SortDirection => sortField === field ? sortDir : null

    const compactRows = loading ? (
        Array.from({ length: 5 }).map((_, i) => (
            <div key={i} role="listitem" className="p-3 border-b border-hairline/5 last:border-0 animate-pulse">
                <div className="h-10 rounded bg-hairline/5" />
            </div>
        ))
    ) : items.length === 0 ? (
        <div role="listitem" className="px-4 py-12 text-center text-sm text-muted-foreground">
            {query || capFilter !== 'all' ? 'No personal bests match the filter.' : 'No personal bests yet.'}
        </div>
    ) : items.map(pb => {
        const medalIcon = getMedalIcon(pb.medal.toLowerCase())
        return (
            <div
                key={pb.id}
                role="listitem"
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-3 border-b border-hairline/5 last:border-0 cursor-pointer"
                onClick={() => onMapSelect?.(pb.mapName)}
            >
                <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 min-w-0">
                        {onToggleFavorite && (
                            <FavoriteStar
                                name={pb.mapName}
                                isFavorited={favoriteMapNames.has(pb.mapName)}
                                onToggle={onToggleFavorite}
                                size="sm"
                                disabled={!canEditFavorites}
                            />
                        )}
                        <MapNavLink mapName={pb.mapName} onMapSelect={onMapSelect} className="text-sm font-semibold text-foreground truncate min-w-0">{displayMapName(pb.mapName)}</MapNavLink>
                    </div>
                    <div className="flex items-center gap-2">{renderPbStatus(pb)}</div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                    <span className="inline-flex items-center gap-1.5">
                        {medalIcon && (
                            <img src={medalIcon} alt={pb.medal} className="size-4 inline-block shrink-0 object-contain max-w-none" />
                        )}
                        <CapTimeLink
                            capId={pb.isTeam ? undefined : pb.id}
                            teamCapId={pb.isTeam ? pb.teamCapId ?? undefined : undefined}
                            seconds={pb.time}
                            className={cn(
                                'text-sm font-mono tabular-nums font-bold',
                                pb.medal === 'World Record' ? 'text-blue-200' : 'text-foreground',
                            )}
                        />
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {pb.added ? formatAddedDate(pb.added) : '—'}
                    </span>
                </div>
            </div>
        )
    })

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
                className="!flex-none !min-h-0 !rounded-none !border-0"
                responsive={{
                    columns: responsiveColumns,
                    nameFloorRem: 14,
                    onResolve: handleResolve,
                    compactContent: compactRows,
                    compactAriaLabel: 'Personal bests',
                }}
            >
                <DataTableHeaderRow>
                    {isVisible('map') && <DataTableHeaderCell sortable sortDirection={dir('map')} onSort={() => handleSort('map')}>Map</DataTableHeaderCell>}
                    {isVisible('medal') && <DataTableHeaderCell align="center" width="3rem"><span className="sr-only">Medal</span></DataTableHeaderCell>}
                    {isVisible('time') && <DataTableHeaderCell align="right" width="8rem" sortable sortDirection={dir('time')} onSort={() => handleSort('time')}>PB Time</DataTableHeaderCell>}
                    {isVisible('status') && <DataTableHeaderCell align="center" width="6rem">Status</DataTableHeaderCell>}
                    {isVisible('added') && <DataTableHeaderCell align="right" width="8rem" sortable sortDirection={dir('added')} onSort={() => handleSort('added')}>Set</DataTableHeaderCell>}
                    {isVisible('actions') && <DataTableHeaderCell align="center" width="6rem"><span className="sr-only">Actions</span></DataTableHeaderCell>}
                </DataTableHeaderRow>
                <tbody>
                    {loading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <DataTableSkeletonRow key={i} columnCount={visibleColumnCount} />
                        ))
                    ) : items.length === 0 ? (
                        <DataTableEmpty colSpan={visibleColumnCount} message={query || capFilter !== 'all' ? 'No personal bests match the filter.' : 'No personal bests yet.'} />
                    ) : (
                        items.map(pb => {
                            const medalIcon = getMedalIcon(pb.medal.toLowerCase())
                            const exact = pb.added ? (() => {
                                const d = new Date(pb.added)
                                return isNaN(d.getTime()) ? pb.added : d.toLocaleString()
                            })() : '—'
                            const demoCapId = capRowDemoCapId(pb)
                            const canPlay = pb.verified && !!demoCapId
                            return (
                                <DataTableRow
                                    key={pb.id}
                                    className="cursor-pointer"
                                    onClick={() => onMapSelect?.(pb.mapName)}
                                >
                                    {isVisible('map') && (
                                        <DataTableCell>
                                            <div className="flex items-center gap-2 min-w-0">
                                                <MapThumbnail mapName={pb.mapName} className="size-8 shrink-0" />
                                                {onToggleFavorite && (
                                                    <FavoriteStar
                                                        name={pb.mapName}
                                                        isFavorited={favoriteMapNames.has(pb.mapName)}
                                                        onToggle={onToggleFavorite}
                                                        size="sm"
                                                        disabled={!canEditFavorites}
                                                    />
                                                )}
                                                <div className="flex flex-col gap-1 min-w-0">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <MapNavLink mapName={pb.mapName} onMapSelect={onMapSelect} className="text-sm font-semibold text-foreground truncate min-w-0">{displayMapName(pb.mapName)}</MapNavLink>
                                                        {pb.isTeam && (
                                                            <TeamRosterBadge members={pb.teamMembers} currentUserId={String(userId)} />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </DataTableCell>
                                    )}
                                    {isVisible('medal') && (
                                        <DataTableCell align="center">
                                            {medalIcon && (
                                                <Tooltip content={pb.medal} side="top">
                                                    <img src={medalIcon} alt={pb.medal} className="size-4 inline-block shrink-0 object-contain max-w-none" />
                                                </Tooltip>
                                            )}
                                        </DataTableCell>
                                    )}
                                    {isVisible('time') && (
                                        <DataTableCell align="right">
                                            <span className="inline-flex items-center gap-1.5">
                                                {pb.medal === 'World Record' && <Trophy className="size-3 text-blue-300" />}
                                                <CapTimeLink
                                                    capId={pb.isTeam ? undefined : pb.id}
                                                    teamCapId={pb.isTeam ? pb.teamCapId ?? undefined : undefined}
                                                    seconds={pb.time}
                                                    className={cn(
                                                        'text-sm font-mono tabular-nums font-bold',
                                                        pb.medal === 'World Record' ? 'text-blue-200' : 'text-foreground',
                                                    )}
                                                />
                                            </span>
                                        </DataTableCell>
                                    )}
                                    {isVisible('status') && (
                                        <DataTableCell align="center">
                                            {renderPbStatus(pb)}
                                        </DataTableCell>
                                    )}
                                    {isVisible('added') && (
                                        <DataTableCell align="right">
                                            <Tooltip content={exact} side="top">
                                                <span className="text-xs text-muted-foreground tabular-nums">
                                                    {pb.added ? formatAddedDate(pb.added) : '—'}
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
                                                    tooltip={canPlay ? 'Watch run' : pb.verified ? 'No replay available for this run' : 'No replay — cap not verified'}
                                                    disabled={!canPlay}
                                                    loading={replay.loadingCapId === pb.id}
                                                    onClick={() => replay.openReplay({
                                                        capId: demoCapId,
                                                        loadingKey: pb.id,
                                                        mapName: pb.mapName,
                                                        time: pb.time,
                                                    })}
                                                />
                                                <IconActionButton
                                                    variant="download"
                                                    icon={Download}
                                                    tooltip={canPlay ? 'Download demo' : pb.verified ? 'No demo available for this run' : 'No demo — cap not verified'}
                                                    disabled={!canPlay}
                                                    onClick={() => demoDownload.start(
                                                        { id: pb.id, alias: undefined, cap_time_seconds: pb.time } as any,
                                                        pb.mapName,
                                                        demoCapId,
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
