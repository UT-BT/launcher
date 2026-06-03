import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRefreshCooldown } from '@/app/hooks/useRefreshCooldown'
import {
    RefreshCw, Play, BadgeCheck, Signal, Swords, Gamepad2, HelpCircle, User, ExternalLink,
    Twitch, Eye, SlidersHorizontal, AlertCircle,
    Clock, Flag,
} from 'lucide-react'
import type { ActiveTitle } from '@/app/utils/api'
import { Modal } from '@/app/components/ui/modal'
import { Tutorial } from '@/app/components/shared/Tutorial'
import { useTutorialState } from '@/app/components/shared/useTutorialState'
import { buildSteps as buildServerTutorialSteps } from '@/app/components/pages/servers/serversTutorialSteps'
import { cn } from '@/lib/utils'
import { useLogger } from '@/app/hooks/use-logger'
import {
    CapacityValue, DEFAULT_FILTERS, FilterState, ServerPreset, ServerPresetFilters,
    ServerSortField, ServerType, SortDir, filterServers, getGameStatusText, getRegionFlag,
    getServerRegion, getServerType, sortServers, trimServerName,
} from '@/app/utils/server-utils'
import { ErrorModal } from '@/app/components/ErrorModal'
import { Tooltip } from '@/app/components/ui/tooltip'
import { Button } from '@/app/components/ui/button'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import { MapThumbnail } from '@/app/components/shared/MapThumbnail'
import { MultiFilterDropdown } from '@/app/components/ui/multi-filter-dropdown'
import { FilterPanelRow } from '@/app/components/ui/filter-panel-row'
import { FilterPresetsMenu } from '@/app/components/shared/FilterPresetsMenu'
import { ColumnsMenu } from '@/app/components/shared/ColumnsMenu'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { ActiveFilterChip } from '@/app/components/shared/ActiveFilterChip'
import { displayMapName } from '@/app/utils/format'
import {
    DataTableShell, DataTableHeaderRow, DataTableHeaderCell, DataTableRow,
    DataTableCell, DataTableEmpty, DataTableSkeletonRow,
} from '@/app/components/shared/DataTable'
import {
    DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
} from '@/app/components/ui/dropdown-menu'

interface Player {
    id: string
    name: string
    ping: number
    time: number
    team: number
    deaths: number
    is_spectator: boolean
    alias?: string | null
    active_title?: ActiveTitle | null
}

export interface Server {
    id: string
    ip: string
    hostname: string
    hostport: number
    map_name: string
    player_count: number
    max_players: number
    spectators: number
    time_limit_minutes: number
    remaining_time_seconds: number
    goal_team_score: number
    red_team_score: number
    blue_team_score: number
    certified_records: boolean
    players: Player[]
    ping?: number
}

export type ServerColumnId =
    | 'thumbnail' | 'type' | 'name' | 'map' | 'region' | 'ping'
    | 'players' | 'spectators' | 'status' | 'actions'

export interface ServerBrowserState {
    filters: FilterState
    sortBy: ServerSortField
    sortDir: SortDir
    filtersPanelOpen: boolean
    columnVisibility: Record<ServerColumnId, boolean>
    columnOrder: ServerColumnId[]
    scrollTop: number
}

export interface ServerBrowserCaches {
    servers: Server[]
    lastRefreshIso: string | null
}

const SERVER_COLUMN_LABELS: Record<ServerColumnId, string> = {
    thumbnail: 'Thumbnail',
    type: 'Type',
    name: 'Server',
    map: 'Map',
    region: 'Region',
    ping: 'Ping',
    players: 'Players',
    spectators: 'Spectators',
    status: 'Status',
    actions: 'Actions',
}

const DEFAULT_COLUMN_ORDER: ServerColumnId[] = [
    'thumbnail', 'type', 'name', 'map', 'region', 'ping', 'players', 'spectators', 'status', 'actions',
]

const DEFAULT_COLUMN_VISIBILITY: Record<ServerColumnId, boolean> = {
    thumbnail: true,
    type: true,
    name: true,
    map: true,
    region: true,
    ping: true,
    players: true,
    spectators: true,
    status: true,
    actions: true,
}

const REQUIRED_COLUMNS: ReadonlySet<ServerColumnId> = new Set(['name', 'actions'])

const SORTABLE_COLUMNS: Partial<Record<ServerColumnId, ServerSortField>> = {
    name: 'name',
    map: 'map',
    region: 'region',
    ping: 'ping',
    players: 'players',
    spectators: 'spectators',
}

export const DEFAULT_SERVERS_STATE: ServerBrowserState = {
    filters: DEFAULT_FILTERS,
    sortBy: 'players',
    sortDir: 'desc',
    filtersPanelOpen: false,
    columnVisibility: DEFAULT_COLUMN_VISIBILITY,
    columnOrder: DEFAULT_COLUMN_ORDER,
    scrollTop: 0,
}

export const DEFAULT_SERVERS_CACHES: ServerBrowserCaches = {
    servers: [],
    lastRefreshIso: null,
}

const SPECTATOR_BOT_ID = '1348765109580861534'
const AUTO_REFRESH_MS = 60_000

const TYPE_OPTIONS: [ServerType, string][] = [
    ['Certified', 'Certified'],
    ['Duel', 'Duel'],
    ['Casual', 'Casual'],
    ['Unknown', 'Unknown'],
]

const CAPACITY_OPTIONS: [CapacityValue, string][] = [
    ['has-players', 'Has players'],
    ['empty', 'Empty'],
    ['full', 'Full'],
]

const newPresetId = (): string => {
    try { return crypto.randomUUID() }
    catch { return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }
}

const filtersEqual = (a: FilterState, b: FilterState): boolean => {
    const sameArr = (x: string[], y: string[]) => {
        if (x.length !== y.length) return false
        const sx = [...x].sort(); const sy = [...y].sort()
        return sx.every((v, i) => v === sy[i])
    }
    return (
        a.favoritesOnly === b.favoritesOnly &&
        sameArr(a.types, b.types) &&
        sameArr(a.regions, b.regions) &&
        sameArr(a.capacity, b.capacity)
    )
}

const TypeIcon = ({ type, className = 'size-4' }: { type: ServerType, className?: string }) => {
    switch (type) {
        case 'Certified': return <BadgeCheck className={cn(className, 'text-yellow-500 fill-yellow-500/20')} />
        case 'Duel': return <Swords className={cn(className, 'text-red-500 fill-red-500/20')} />
        case 'Casual': return <Gamepad2 className={cn(className, 'text-green-500')} />
        default: return <HelpCircle className={cn(className, 'text-muted-foreground')} />
    }
}

const avatarUrlFor = (player: Player): string | null =>
    player.id && player.id.length > 5
        ? `https://gateway.utbt.net/users/${player.id}/avatar`
        : null

const PlayerRow = ({ player }: { player: Player }) => {
    const isBot = player.id === SPECTATOR_BOT_ID
    const pingColor = !player.ping ? 'text-muted-foreground' :
        player.ping < 100 ? 'text-green-500' :
            player.ping < 200 ? 'text-yellow-500' : 'text-red-500'

    const onClick = (e: React.MouseEvent) => {
        e.stopPropagation()
        if (isBot) window.open('https://twitch.tv/utbt_spectator', '_blank')
    }

    return (
        <div
            onClick={onClick}
            className={cn(
                'flex items-center gap-2.5 px-2 py-1.5 rounded-md transition-colors group/player',
                isBot ? 'cursor-pointer hover:bg-[#9146FF]/10' : 'hover:bg-white/5',
                player.is_spectator && !isBot && 'opacity-60',
            )}
        >
            <span className="flex-1 min-w-0">
                {isBot ? (
                    <span className="flex items-center gap-2.5 min-w-0">
                        <span className="size-6 rounded-md overflow-hidden bg-black/40 border border-white/5 shrink-0 flex items-center justify-center">
                            <Twitch className="size-3.5 text-[#9146FF] fill-[#9146FF]/20" />
                        </span>
                        <span className="text-xs font-semibold text-white truncate group-hover/player:text-[#9146FF]">
                            UTBT Spectator Bot
                        </span>
                    </span>
                ) : (
                    <PlayerInfo
                        userId={player.id}
                        alias={player.alias ?? player.name}
                        title={player.active_title}
                        size="sm"
                    />
                )}
            </span>
            {isBot && <ExternalLink className="size-3 text-[#9146FF] opacity-60 shrink-0" />}
            {!isBot && (
                <div className={cn('inline-flex items-center gap-1 text-xs font-bold tabular-nums shrink-0', pingColor)}>
                    <Signal className="size-3.5" />
                    {player.ping ? `${player.ping}ms` : '...'}
                </div>
            )}
        </div>
    )
}

const AvatarStack = ({ players }: { players: Player[] }) => {
    const visible = players.slice(0, 3)
    const remaining = players.length - visible.length
    return (
        <div className="flex items-center -space-x-1.5">
            {visible.map(p => {
                const isBot = p.id === SPECTATOR_BOT_ID
                const avatar = avatarUrlFor(p)
                return (
                    <div
                        key={`${p.id}-${p.name}`}
                        className={cn(
                            'size-5 rounded-full overflow-hidden border-2 border-card bg-black/40 shrink-0 flex items-center justify-center',
                            p.is_spectator && 'opacity-50',
                        )}
                    >
                        {isBot ? (
                            <Twitch className="size-3 text-[#9146FF] fill-[#9146FF]/20" />
                        ) : avatar ? (
                            <img
                                src={avatar}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src =
                                        `https://cdn.discordapp.com/embed/avatars/${parseInt(p.id) % 5}.png`
                                }}
                            />
                        ) : (
                            <User className="size-3 text-white/70" />
                        )}
                    </div>
                )
            })}
            {remaining > 0 && (
                <div className="size-5 rounded-full border-2 border-card bg-white/10 text-[9px] font-bold text-white/80 flex items-center justify-center shrink-0">
                    +{remaining}
                </div>
            )}
        </div>
    )
}

interface PlayerListCellProps {
    players: Player[]
    displayText: string
    displayColor: string
    singular: string
    plural: string
}

const PlayerListCell = ({ players, displayText, displayColor, singular, plural }: PlayerListCellProps) => {
    const sorted = useMemo(
        () => [...players].sort((a, b) => a.name.localeCompare(b.name)),
        [players],
    )

    const trigger = (
        <div className={cn(
            'inline-flex items-center gap-2 px-2 py-1 rounded border transition-colors',
            sorted.length > 0
                ? 'bg-card/50 border-white/5 hover:border-white/20 hover:bg-card/80 cursor-pointer'
                : 'bg-card/30 border-white/5 cursor-default',
        )}>
            <span className={cn('text-xs font-bold tabular-nums', displayColor)}>
                {displayText}
            </span>
            {sorted.length > 0 && <AvatarStack players={sorted} />}
        </div>
    )

    if (sorted.length === 0) return trigger

    return (
        <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                <button type="button" className="inline-flex">{trigger}</button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                className="min-w-64 max-w-80 max-h-[60vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-2 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
                    {sorted.length} {sorted.length === 1 ? singular : plural}
                </div>
                <div className="p-1 space-y-0.5">
                    {sorted.map(p => <PlayerRow key={`${p.id}-${p.name}`} player={p} />)}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

interface ServerBrowserPageProps {
    installationStatus?: 'valid' | 'no-install' | 'unsupported' | null
    state: ServerBrowserState
    onStateChange: (updater: (prev: ServerBrowserState) => ServerBrowserState) => void
    caches: ServerBrowserCaches
    onCachesChange: (updater: (prev: ServerBrowserCaches) => ServerBrowserCaches) => void
    favoriteServerIds: Set<string>
    onToggleServerFavorite: (serverId: string) => void
    presets: ServerPreset[]
    onPresetsChange: (next: ServerPreset[]) => void
    onMapSelect?: (mapName: string) => void
}

export function ServerBrowserPage({
    installationStatus, state, onStateChange, caches, onCachesChange,
    favoriteServerIds, onToggleServerFavorite, presets, onPresetsChange,
    onMapSelect,
}: ServerBrowserPageProps) {
    const logger = useLogger('ServerBrowserPage')
    const refreshCooldown = useRefreshCooldown()
    const [loading, setLoading] = useState(caches.servers.length === 0)
    const [error, setError] = useState<string | null>(null)
    const [launchError, setLaunchError] = useState<string | null>(null)
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)
    const [activePresetId, setActivePresetId] = useState<string | null>(null)

    const scrollContainerRef = useRef<HTMLDivElement | null>(null)
    const refreshButtonRef = useRef<HTMLButtonElement | null>(null)
    const filtersButtonRef = useRef<HTMLButtonElement | null>(null)
    const columnsButtonRef = useRef<HTMLButtonElement | null>(null)
    const presetsButtonRef = useRef<HTMLButtonElement | null>(null)
    const sortHeaderRef = useRef<HTMLButtonElement | null>(null)
    const firstRowFavRef = useRef<HTMLElement | null>(null)
    const firstRowPlayersRef = useRef<HTMLElement | null>(null)
    const firstRowSpectatorsRef = useRef<HTMLElement | null>(null)
    const firstRowStatusRef = useRef<HTMLElement | null>(null)
    const firstRowJoinRef = useRef<HTMLElement | null>(null)

    const tutorial = useTutorialState('utbt:serversPageTutorial:v1')
    const [tutorialActive, setTutorialActive] = useState(false)
    const [tutorialStep, setTutorialStep] = useState(0)
    const [presetsMenuOpen, setPresetsMenuOpen] = useState(false)
    const [columnsMenuOpen, setColumnsMenuOpen] = useState(false)

    const startTutorial = useCallback(() => {
        setTutorialStep(0)
        setTutorialActive(true)
    }, [])
    const closeTutorial = useCallback(() => {
        setTutorialActive(false)
        setTutorialStep(0)
        setPresetsMenuOpen(false)
        setColumnsMenuOpen(false)
        onStateChange(prev => ({ ...prev, filtersPanelOpen: false }))
    }, [onStateChange])

    const pingAllServers = useCallback(async (serversToPing: Server[]) => {
        const uniqueIps = Array.from(new Set(serversToPing.map(s => s.ip)))
        const PING_CONCURRENCY = 6
        for (let i = 0; i < uniqueIps.length; i += PING_CONCURRENCY) {
            const batch = uniqueIps.slice(i, i + PING_CONCURRENCY)
            const results = await Promise.all(batch.map(async (ip) => {
                try {
                    return { ip, ping: await window.conveyor.game.pingServer(ip) }
                } catch (err) {
                    logger.error('Failed to ping server', { ip, error: err })
                    return null
                }
            }))
            const pingByIp = new Map<string, number>()
            for (const r of results) {
                if (r) pingByIp.set(r.ip, r.ping)
            }
            if (pingByIp.size === 0) continue
            onCachesChange(prev => ({
                ...prev,
                servers: prev.servers.map(s => {
                    const ping = pingByIp.get(s.ip)
                    return ping === undefined ? s : { ...s, ping }
                }),
            }))
        }
    }, [logger, onCachesChange])

    const fetchServers = useCallback(async (opts?: { silent?: boolean }) => {
        const silent = opts?.silent === true
        if (!silent) setLoading(true)
        setError(null)
        try {
            const data = await window.conveyor.game.fetchServers() as Server[]
            onCachesChange(() => ({
                servers: data,
                lastRefreshIso: new Date().toISOString(),
            }))
            pingAllServers(data)
        } catch (err) {
            logger.error('Failed to fetch servers', { error: err })
            setError('Failed to load servers')
        } finally {
            if (!silent) setLoading(false)
        }
    }, [logger, onCachesChange, pingAllServers])

    useEffect(() => {
        if (caches.servers.length === 0) fetchServers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                const isRunning = await window.conveyor.game.isGameRunning()
                if (!isRunning) fetchServers({ silent: true })
            } catch (err) {
                console.error('Failed to check game status during auto-refresh', err)
            }
        }, AUTO_REFRESH_MS)
        return () => clearInterval(interval)
    }, [fetchServers])

    useEffect(() => {
        const node = scrollContainerRef.current
        if (node) node.scrollTop = state.scrollTop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const availableRegions = useMemo(() => {
        const regions = new Set<string>()
        caches.servers.forEach(s => {
            const region = getServerRegion(s.hostname)
            if (region) regions.add(region)
        })
        return Array.from(regions).sort()
    }, [caches.servers])

    const processedServers = useMemo(() => {
        let result = filterServers(caches.servers, state.filters, favoriteServerIds)
        result = sortServers(result, state.sortBy, state.sortDir)
        return result
    }, [caches.servers, state.filters, state.sortBy, state.sortDir, favoriteServerIds])

    const totalPlayerCount = useMemo(
        () => processedServers.reduce((sum, s) => sum + s.player_count, 0),
        [processedServers],
    )

    const handleJoin = async (server: Server, asSpectator: boolean) => {
        try {
            if (window.conveyor?.ini) {
                if (asSpectator) {
                    await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'OverrideClass', 'Botpack.CHSpectator')
                } else {
                    const currentClass = await window.conveyor.ini.readIniValue('User.ini', 'DefaultPlayer', 'Class')
                    if (currentClass === 'Botpack.CHSpectator') {
                        await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'Class', '')
                    }
                    await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'OverrideClass', '')
                }
            }
            await window.conveyor.game.launchGame(server.ip, server.hostport)
        } catch (err) {
            logger.error('Failed to launch game', { error: err })
            setLaunchError(err instanceof Error ? err.message : 'An unknown error occurred while trying to launch the game.')
            setIsErrorModalOpen(true)
        }
    }

    const updateFilters = useCallback((next: FilterState) => {
        onStateChange(prev => ({ ...prev, filters: next }))
    }, [onStateChange])

    const handleSort = useCallback((field: ServerSortField) => {
        onStateChange(prev => {
            if (prev.sortBy === field) {
                return { ...prev, sortDir: prev.sortDir === 'asc' ? 'desc' : 'asc' }
            }
            return { ...prev, sortBy: field, sortDir: 'asc' }
        })
    }, [onStateChange])

    const toggleColumn = useCallback((id: ServerColumnId) => {
        if (REQUIRED_COLUMNS.has(id)) return
        onStateChange(prev => ({
            ...prev,
            columnVisibility: { ...prev.columnVisibility, [id]: !prev.columnVisibility[id] },
        }))
    }, [onStateChange])

    const reorderColumn = useCallback((source: ServerColumnId, target: ServerColumnId) => {
        if (source === target) return
        onStateChange(prev => {
            const order = [...prev.columnOrder]
            const fromIdx = order.indexOf(source)
            const toIdx = order.indexOf(target)
            if (fromIdx === -1 || toIdx === -1) return prev
            order.splice(fromIdx, 1)
            const insertAt = order.indexOf(target)
            order.splice(insertAt, 0, source)
            return { ...prev, columnOrder: order }
        })
    }, [onStateChange])

    const toggleFiltersPanel = useCallback(() => {
        onStateChange(prev => ({ ...prev, filtersPanelOpen: !prev.filtersPanelOpen }))
    }, [onStateChange])

    const onScroll = useCallback(() => {
        const node = scrollContainerRef.current
        if (!node) return
        const top = node.scrollTop
        onStateChange(prev => Math.abs(prev.scrollTop - top) > 24 ? { ...prev, scrollTop: top } : prev)
    }, [onStateChange])

    const resetFilters = useCallback(() => {
        onStateChange(prev => ({ ...prev, filters: DEFAULT_FILTERS }))
        setActivePresetId(null)
    }, [onStateChange])

    const activeFilterCount = (
        (state.filters.types.length > 0 ? 1 : 0) +
        (state.filters.regions.length > 0 ? 1 : 0) +
        (state.filters.capacity.length > 0 ? 1 : 0) +
        (state.filters.favoritesOnly ? 1 : 0)
    )
    const hasActiveFilters = activeFilterCount > 0

    const captureCurrentPreset = useCallback((): ServerPresetFilters => ({
        filters: state.filters,
        sortBy: state.sortBy,
        sortDir: state.sortDir,
    }), [state.filters, state.sortBy, state.sortDir])

    const handleSavePreset = (name: string, payload: ServerPresetFilters) => {
        const id = newPresetId()
        const next = [...presets, { id, name, filters: payload }]
        onPresetsChange(next)
        setActivePresetId(id)
    }

    const handleLoadPreset = (p: ServerPreset) => {
        setActivePresetId(p.id)
        onStateChange(prev => ({
            ...prev,
            filters: p.filters.filters,
            sortBy: p.filters.sortBy,
            sortDir: p.filters.sortDir,
            scrollTop: 0,
        }))
    }

    const handleDeletePreset = (p: ServerPreset) => {
        onPresetsChange(presets.filter(x => x.id !== p.id))
        if (activePresetId === p.id) setActivePresetId(null)
    }

    const activePreset = activePresetId ? presets.find(p => p.id === activePresetId) ?? null : null

    useEffect(() => {
        if (!activePreset) return
        const matches = filtersEqual(state.filters, activePreset.filters.filters)
            && state.sortBy === activePreset.filters.sortBy
            && state.sortDir === activePreset.filters.sortDir
        if (!matches) setActivePresetId(null)
    }, [activePreset, state.filters, state.sortBy, state.sortDir])

    const lastRefreshLabel = useMemo(() => {
        if (!caches.lastRefreshIso) return null
        try {
            return new Date(caches.lastRefreshIso).toLocaleTimeString(
                [], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false },
            )
        } catch { return null }
    }, [caches.lastRefreshIso])

    const showSkeleton = loading && caches.servers.length === 0

    const isVisible = (id: ServerColumnId) => state.columnVisibility[id]

    const renderHeader = (id: ServerColumnId): React.ReactNode => {
        if (!isVisible(id)) return null
        const sortField = SORTABLE_COLUMNS[id]
        if (sortField) {
            return (
                <DataTableHeaderCell
                    key={id}
                    sortable
                    sortDirection={state.sortBy === sortField ? state.sortDir : null}
                    onSort={() => handleSort(sortField)}
                    buttonRef={id === 'name' ? sortHeaderRef : undefined}
                >
                    {SERVER_COLUMN_LABELS[id]}
                </DataTableHeaderCell>
            )
        }
        const showLabel = id !== 'thumbnail' && id !== 'actions' && id !== 'type'
        return (
            <DataTableHeaderCell key={id}>
                {showLabel ? SERVER_COLUMN_LABELS[id] : null}
            </DataTableHeaderCell>
        )
    }

    const renderCell = (id: ServerColumnId, server: Server, isFirstRow: boolean): React.ReactNode => {
        if (!isVisible(id)) return null
        const type = getServerType(server.hostname)
        const region = getServerRegion(server.hostname)
        switch (id) {
            case 'thumbnail':
                return (
                    <DataTableCell key={id}>
                        <MapThumbnail mapName={server.map_name} className="w-12 h-12 rounded shadow-sm" />
                    </DataTableCell>
                )
            case 'type':
                return (
                    <DataTableCell key={id}>
                        <Tooltip content={type} side="top">
                            <span className="inline-flex"><TypeIcon type={type} /></span>
                        </Tooltip>
                    </DataTableCell>
                )
            case 'name': {
                const trimmed = trimServerName(server.hostname).replace(/\s*\([^)]+\)\s*$/, '')
                return (
                    <DataTableCell key={id}>
                        <div className="flex items-center gap-2">
                            <span ref={isFirstRow ? firstRowFavRef : undefined} className="inline-flex">
                                <FavoriteStar
                                    name={server.id}
                                    isFavorited={favoriteServerIds.has(server.id)}
                                    onToggle={onToggleServerFavorite}
                                    size="sm"
                                />
                            </span>
                            <span className="text-sm font-bold text-white">{trimmed}</span>
                        </div>
                    </DataTableCell>
                )
            }
            case 'map':
                return (
                    <DataTableCell key={id}>
                        {onMapSelect ? (
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onMapSelect(server.map_name) }}
                                className="text-sm font-semibold text-white truncate inline-block max-w-[220px] align-middle text-left hover:text-blue-300 hover:underline underline-offset-2 transition-colors cursor-pointer"
                            >
                                {displayMapName(server.map_name)}
                            </button>
                        ) : (
                            <span className="text-sm font-semibold text-white truncate inline-block max-w-[220px] align-middle">
                                {displayMapName(server.map_name)}
                            </span>
                        )}
                    </DataTableCell>
                )
            case 'region':
                return (
                    <DataTableCell key={id}>
                        <Tooltip content={region} side="top">
                            <img
                                src={getRegionFlag(region)}
                                alt={region}
                                className="h-4 w-6 object-cover rounded-[2px] border border-white/10"
                            />
                        </Tooltip>
                    </DataTableCell>
                )
            case 'ping': {
                const ping = server.ping
                const pingColor = !ping ? 'text-muted-foreground' :
                    ping < 100 ? 'text-green-500' :
                        ping < 200 ? 'text-yellow-500' : 'text-red-500'
                return (
                    <DataTableCell key={id}>
                        <div className={cn('inline-flex items-center gap-1.5 text-xs font-bold tabular-nums', pingColor)}>
                            <Signal className="size-3.5" />
                            {ping ? `${ping}ms` : '...'}
                        </div>
                    </DataTableCell>
                )
            }
            case 'players': {
                const activePlayers = server.players.filter(p => !p.is_spectator)
                const playerColor =
                    server.player_count >= server.max_players ? 'text-rose-400' :
                        server.player_count > 0 ? 'text-emerald-400' : 'text-muted-foreground'
                return (
                    <DataTableCell key={id} ref={isFirstRow ? (firstRowPlayersRef as React.RefObject<HTMLTableCellElement>) : undefined}>
                        <PlayerListCell
                            players={activePlayers}
                            displayText={`${server.player_count}/${server.max_players}`}
                            displayColor={playerColor}
                            singular="player"
                            plural="players"
                        />
                    </DataTableCell>
                )
            }
            case 'spectators': {
                const specPlayers = server.players.filter(p => p.is_spectator)
                return (
                    <DataTableCell key={id} ref={isFirstRow ? (firstRowSpectatorsRef as React.RefObject<HTMLTableCellElement>) : undefined}>
                        <PlayerListCell
                            players={specPlayers}
                            displayText={String(server.spectators)}
                            displayColor="text-muted-foreground"
                            singular="spectator"
                            plural="spectators"
                        />
                    </DataTableCell>
                )
            }
            case 'status': {
                const text = getGameStatusText(
                    server.remaining_time_seconds,
                    server.certified_records,
                    type,
                    server.red_team_score,
                    server.blue_team_score,
                )
                const isEnded = text === 'Match Ended' || text === 'Overtime'
                return (
                    <DataTableCell key={id} ref={isFirstRow ? (firstRowStatusRef as React.RefObject<HTMLTableCellElement>) : undefined}>
                        <div className={cn(
                            'inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider border',
                            isEnded
                                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                                : 'bg-white/5 border-white/5 text-muted-foreground',
                        )}>
                            {isEnded ? <Flag className="size-3" /> : <Clock className="size-3" />}
                            {text}
                        </div>
                    </DataTableCell>
                )
            }
            case 'actions': {
                const canJoin = installationStatus === 'valid' && server.player_count < server.max_players
                const canSpec = installationStatus === 'valid'
                const joinTooltip =
                    installationStatus === 'no-install' ? 'No valid UT99 installation found' :
                        installationStatus === 'unsupported' ? 'Unsupported game version' :
                            server.player_count >= server.max_players ? 'Server is full' :
                                'Join Server'
                const specTooltip =
                    installationStatus === 'no-install' ? 'No valid UT99 installation found' :
                        installationStatus === 'unsupported' ? 'Unsupported game version' :
                            'Spectate'
                return (
                    <DataTableCell key={id} align="right" ref={isFirstRow ? (firstRowJoinRef as React.RefObject<HTMLTableCellElement>) : undefined}>
                        <div className="inline-flex items-center gap-1.5">
                            <Tooltip content={joinTooltip} side="top">
                                <span className="inline-flex">
                                    <button
                                        type="button"
                                        onClick={() => handleJoin(server, false)}
                                        disabled={!canJoin}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border border-blue-500/30 bg-blue-500/10 text-blue-300 hover:bg-blue-500/25 hover:text-blue-100 hover:border-blue-500/50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-blue-500/10 disabled:hover:text-blue-300 disabled:hover:border-blue-500/30"
                                    >
                                        <Play className="size-3 fill-current" />
                                        Join
                                    </button>
                                </span>
                            </Tooltip>
                            <Tooltip content={specTooltip} side="top">
                                <span className="inline-flex">
                                    <button
                                        type="button"
                                        onClick={() => handleJoin(server, true)}
                                        disabled={!canSpec}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium border border-white/10 bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-white hover:border-white/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white/5 disabled:hover:text-muted-foreground disabled:hover:border-white/10"
                                    >
                                        <Eye className="size-3" />
                                        Spec
                                    </button>
                                </span>
                            </Tooltip>
                        </div>
                    </DataTableCell>
                )
            }
        }
    }

    const visibleColumnCount = state.columnOrder.filter(isVisible).length

    return (
        <div className="space-y-4 h-full flex flex-col overflow-hidden">
            <div className="flex items-end justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-white leading-tight">Servers</h1>
                    {!showSkeleton ? (
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Currently {totalPlayerCount.toLocaleString()} {totalPlayerCount === 1 ? 'player' : 'players'} on {processedServers.length.toLocaleString()} {processedServers.length === 1 ? 'server' : 'servers'}
                            <i>{lastRefreshLabel && <> (Refreshed at {lastRefreshLabel})</>}</i>
                        </p>
                    ) : (
                        <div className="h-3 w-40 bg-white/5 rounded mt-1.5 animate-pulse" />
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Tooltip content="Launch tutorial" side="bottom">
                        <button
                            type="button"
                            onClick={startTutorial}
                            aria-label="Restart Servers tutorial"
                            className="p-2 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                        >
                            <HelpCircle className="size-4" />
                        </button>
                    </Tooltip>
                    <Tooltip content={refreshCooldown.canRefresh ? 'Refresh servers' : `Wait ${refreshCooldown.remainingSeconds}s`} side="bottom">
                        <button
                            ref={refreshButtonRef}
                            type="button"
                            onClick={() => refreshCooldown.trigger(fetchServers)}
                            disabled={loading || !refreshCooldown.canRefresh}
                            className="p-2 rounded-md text-muted-foreground hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
                        </button>
                    </Tooltip>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                    ref={filtersButtonRef}
                    type="button"
                    onClick={toggleFiltersPanel}
                    className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors cursor-pointer',
                        state.filtersPanelOpen
                            ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                            : 'bg-card/50 border-white/10 text-muted-foreground hover:text-white hover:border-white/20',
                    )}
                >
                    <SlidersHorizontal className="size-4" />
                    Filters
                    {activeFilterCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-500 text-white">
                            {activeFilterCount}
                        </span>
                    )}
                </button>

                <ColumnsMenu<ServerColumnId>
                    columnOrder={state.columnOrder}
                    columnVisibility={state.columnVisibility}
                    columnLabels={SERVER_COLUMN_LABELS}
                    onToggle={toggleColumn}
                    onReorder={reorderColumn}
                    requiredColumns={REQUIRED_COLUMNS}
                    triggerRef={columnsButtonRef}
                    menuOpen={columnsMenuOpen}
                    onMenuOpenChange={setColumnsMenuOpen}
                />

                <div className="ml-auto flex items-center gap-3 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5"><TypeIcon type="Certified" className="size-3.5" /> Certified</span>
                    <span className="inline-flex items-center gap-1.5"><TypeIcon type="Duel" className="size-3.5" /> Duel</span>
                    <span className="inline-flex items-center gap-1.5"><TypeIcon type="Casual" className="size-3.5" /> Casual</span>
                </div>
            </div>

            {hasActiveFilters && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {state.filters.types.map(t => (
                        <ActiveFilterChip
                            key={`type-${t}`}
                            label="Type"
                            value={t}
                            onClear={() => updateFilters({
                                ...state.filters,
                                types: state.filters.types.filter(x => x !== t),
                            })}
                        />
                    ))}
                    {state.filters.regions.map(r => (
                        <ActiveFilterChip
                            key={`region-${r}`}
                            label="Region"
                            value={r}
                            onClear={() => updateFilters({
                                ...state.filters,
                                regions: state.filters.regions.filter(x => x !== r),
                            })}
                        />
                    ))}
                    {state.filters.capacity.map(c => (
                        <ActiveFilterChip
                            key={`capacity-${c}`}
                            label="Capacity"
                            value={CAPACITY_OPTIONS.find(([v]) => v === c)?.[1] ?? c}
                            onClear={() => updateFilters({
                                ...state.filters,
                                capacity: state.filters.capacity.filter(x => x !== c),
                            })}
                        />
                    ))}
                    {state.filters.favoritesOnly && (
                        <ActiveFilterChip
                            label="Favorites only"
                            value="On"
                            onClear={() => updateFilters({ ...state.filters, favoritesOnly: false })}
                        />
                    )}
                </div>
            )}

            {state.filtersPanelOpen && (
                <div className="bg-card/30 border border-white/10 rounded-xl p-4 space-y-4 shrink-0">
                    <FilterPanelRow label="Server">
                        <MultiFilterDropdown
                            label="Type"
                            values={state.filters.types}
                            onChange={v => updateFilters({ ...state.filters, types: v as ServerType[] })}
                            options={TYPE_OPTIONS}
                        />
                        <MultiFilterDropdown
                            label="Region"
                            values={state.filters.regions}
                            onChange={v => updateFilters({ ...state.filters, regions: v })}
                            options={availableRegions.map(r => [r, r] as [string, string])}
                            searchable
                        />
                    </FilterPanelRow>

                    <FilterPanelRow label="Status">
                        <MultiFilterDropdown
                            label="Capacity"
                            values={state.filters.capacity}
                            onChange={v => updateFilters({ ...state.filters, capacity: v as CapacityValue[] })}
                            options={CAPACITY_OPTIONS}
                        />
                        <label className="flex items-center gap-2 px-3 py-2 bg-card/50 border border-white/10 rounded-md text-sm text-white cursor-pointer hover:border-white/20 self-end">
                            <input
                                type="checkbox"
                                checked={state.filters.favoritesOnly}
                                onChange={e => updateFilters({ ...state.filters, favoritesOnly: e.target.checked })}
                                className="accent-yellow-400 cursor-pointer"
                            />
                            <span>Favorites only</span>
                            {favoriteServerIds.size > 0 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-300 border border-yellow-500/30">
                                    {favoriteServerIds.size}
                                </span>
                            )}
                        </label>
                    </FilterPanelRow>

                    <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
                        <FilterPresetsMenu<ServerPresetFilters>
                            presets={presets}
                            activePreset={activePreset}
                            hasActiveFilters={hasActiveFilters}
                            onSave={handleSavePreset}
                            onLoad={handleLoadPreset}
                            onDelete={handleDeletePreset}
                            captureCurrentFilters={captureCurrentPreset}
                            onResetFilters={resetFilters}
                            placeholderExample="e.g. EU Certified only"
                            triggerRef={presetsButtonRef}
                            menuOpen={presetsMenuOpen}
                            onMenuOpenChange={setPresetsMenuOpen}
                        />
                    </div>
                </div>
            )}

            {error && (
                <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm shrink-0">
                    <span className="inline-flex items-center gap-2">
                        <AlertCircle className="size-4" />
                        {error}
                    </span>
                    <Button variant="ghost" size="sm" onClick={() => fetchServers()} className="text-red-400 hover:text-red-300">
                        <RefreshCw className="size-4 mr-1" /> Retry
                    </Button>
                </div>
            )}

            <DataTableShell scrollRef={scrollContainerRef} onScroll={onScroll}>
                <DataTableHeaderRow theadDataAttr="data-utbt-servers-thead">
                    {state.columnOrder.map(id => renderHeader(id))}
                </DataTableHeaderRow>
                <tbody>
                    {showSkeleton ? (
                        Array.from({ length: 8 }).map((_, i) => (
                            <DataTableSkeletonRow key={i} columnCount={visibleColumnCount} />
                        ))
                    ) : processedServers.length === 0 ? (
                        <DataTableEmpty colSpan={visibleColumnCount} message="No servers match your filters." />
                    ) : (
                        processedServers.map((server, index) => (
                            <DataTableRow key={server.id}>
                                {state.columnOrder.map(id => renderCell(id, server, index === 0))}
                            </DataTableRow>
                        ))
                    )}
                </tbody>
            </DataTableShell>

            <ErrorModal
                isOpen={isErrorModalOpen}
                onClose={() => setIsErrorModalOpen(false)}
                title="Launch Error"
                message={launchError || 'Unknown error'}
            />

            <Modal
                isOpen={!tutorial.seen && !tutorialActive}
                onClose={tutorial.markSeen}
                title="First time here?"
                className="w-[95%] sm:w-[440px] max-w-md"
                offsetSidebar
                footer={
                    <div className="p-4 border-t border-border bg-muted/50 flex justify-end gap-2 shrink-0">
                        <Button variant="ghost" onClick={tutorial.markSeen}>
                            Skip
                        </Button>
                        <Button onClick={() => { tutorial.markSeen(); startTutorial() }}>
                            Start tutorial
                        </Button>
                    </div>
                }
            >
                <p className="text-sm text-muted-foreground">
                    Looks like your first time on the Servers page. Want a quick tour of the features? <br /><br />
                    You can reopen it anytime with the <HelpCircle className="inline size-3.5 align-text-bottom" /> icon in the top right.
                </p>
            </Modal>

            {tutorialActive && (
                <Tutorial
                    ariaLabel="Servers page tutorial"
                    steps={buildServerTutorialSteps(
                        {
                            refreshButtonRef,
                            filtersButtonRef,
                            columnsButtonRef,
                            presetsButtonRef,
                            sortHeaderRef,
                            firstRowFavRef,
                            firstRowPlayersRef,
                            firstRowSpectatorsRef,
                            firstRowStatusRef,
                            firstRowJoinRef,
                        },
                        {
                            openFilterPanel: () => onStateChange(prev => ({ ...prev, filtersPanelOpen: true })),
                            closeFilterPanel: () => onStateChange(prev => ({ ...prev, filtersPanelOpen: false })),
                            setPresetsMenuOpen,
                            setColumnsMenuOpen,
                        },
                    )}
                    step={tutorialStep}
                    setStep={setTutorialStep}
                    onClose={closeTutorial}
                />
            )}
        </div>
    )
}
