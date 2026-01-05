import { useEffect, useMemo, useState, useCallback } from 'react'
import { Button } from '@/app/components/ui/button'
import { useLogger } from '@/app/hooks/use-logger'
import { RefreshCw, Play, Users, Trophy, Shield, Signal, Swords, Coffee, PanelLeft, User, ExternalLink, Twitch, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FilterState, getRegionFlag, getServerRegion, getServerType, SortOption, filterServers, sortServers } from '@/app/utils/server-utils'
import { ServerBrowserSidebar } from '@/app/components/ServerBrowserSidebar'
import { ErrorModal } from '@/app/components/ErrorModal'
import { Tooltip } from '@/app/components/ui/tooltip'

const STORAGE_KEY = 'utbt-server-browser-settings'

interface SavedSettings {
    filters: FilterState
    sortOption: SortOption
    isSidebarOpen: boolean
}

interface Player {
    id: string
    name: string
    ping: number
    time: number
    team: number
    deaths: number
    is_spectator: boolean
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

const MapThumbnail = ({ mapName, className }: { mapName: string, className?: string }) => {
    const [imgSrc, setImgSrc] = useState(`https://utbt.net/images/screenshots/${mapName}.png`)

    useEffect(() => {
        setImgSrc(`https://utbt.net/images/screenshots/${mapName}.png`)
    }, [mapName])

    return (
        <div className={cn("overflow-hidden bg-muted relative shrink-0 border border-white/10 shadow-lg shadow-black/20 group-hover:shadow-blue-900/20 transition-shadow", className)}>
            <img
                src={imgSrc}
                alt={mapName}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                onError={() => setImgSrc('https://utbt.net/images/screenshots/default.png')}
            />
        </div>
    )
}

const SPECTATOR_BOT_ID = '1348765109580861534'

const PlayerTag = ({ player }: { player: Player }) => {
    const isBot = player.id === SPECTATOR_BOT_ID
    const displayName = isBot ? 'UTBT Spectator Bot' : player.name

    const avatarUrl = player.id && player.id.length > 5
        ? `https://gateway.utbt.net/users/${player.id}/avatar`
        : null

    const pingColor = !player.ping ? "bg-muted-foreground/30" :
        player.ping < 100 ? "bg-green-500" :
            player.ping < 200 ? "bg-yellow-500" : "bg-red-500"

    const handleClick = () => {
        if (isBot) {
            window.open('https://twitch.tv/utbt_spectator', '_blank')
        }
    }

    const tagContent = (
        <div
            onClick={handleClick}
            className={cn(
                "flex items-center gap-2.5 px-2 py-1.5 rounded-lg transition-all border border-transparent hover:bg-white/5 hover:border-white/5 group/player",
                player.is_spectator ? "opacity-60" : "",
                isBot ? "cursor-pointer" : ""
            )}
        >
            <div className={cn(
                "size-5 rounded-md overflow-hidden bg-black/40 border border-white/5 shrink-0 transition-transform group-hover/player:scale-105 flex items-center justify-center",
                player.is_spectator && !isBot ? "grayscale opacity-50" : ""
            )}>
                {isBot ? (
                    <Twitch className="size-3.5 text-[#9146FF] fill-[#9146FF]/20" />
                ) : avatarUrl ? (
                    <img
                        src={avatarUrl}
                        alt={displayName}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://cdn.discordapp.com/embed/avatars/${parseInt(player.id) % 5}.png`
                        }}
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted/20">
                        <User className={cn("size-3", player.is_spectator ? "text-muted-foreground" : "text-white/70")} />
                    </div>
                )}
            </div>
            <div className="flex items-center gap-1.5 min-w-0">
                <span className={cn(
                    "text-xs font-semibold text-white/80 transition-colors truncate max-w-[120px]",
                    isBot ? "group-hover/player:text-[#9146FF]" : "group-hover/player:text-blue-400"
                )}>
                    {displayName}
                </span>
                {isBot && (
                    <ExternalLink className="size-2.5 text-[#9146FF] opacity-0 group-hover/join:opacity-100 transition-opacity" />
                )}
            </div>
            {!isBot && (
                <div className="flex items-center gap-1.5 shrink-0 opacity-40 group-hover/player:opacity-100 transition-opacity">
                    <div className={cn("size-1.5 rounded-full", pingColor)} />
                    <span className="text-[10px] tabular-nums font-bold tracking-tight">{player.ping}</span>
                </div>
            )}
        </div>
    )

    if (isBot) {
        return (
            <Tooltip content="Watch Live on Twitch">
                {tagContent}
            </Tooltip>
        )
    }

    return tagContent
}

const getTypeIcon = (type: string) => {
    switch (type) {
        case 'Certified': return <Shield className="size-4 text-yellow-500 fill-yellow-500/20" />
        case 'Duel': return <Swords className="size-4 text-red-500 fill-red-500/20" />
        case 'Casual': return <Coffee className="size-4 text-green-500 fill-green-500/20" />
        default: return null
    }
}

const ServerRow = ({ server, onJoin }: { server: Server, onJoin: (server: Server, asSpectator: boolean) => void }) => {
    const type = getServerType(server.hostname)
    const region = getServerRegion(server.hostname)
    const flag = getRegionFlag(region)

    const sortedPlayers = useMemo(() => {
        return [...server.players].sort((a, b) => {
            if (a.is_spectator !== b.is_spectator) {
                return a.is_spectator ? 1 : -1
            }
            return a.name.localeCompare(b.name)
        })
    }, [server.players])

    return (
        <div
            className="group relative bg-card/50 hover:bg-card/80 border border-transparent hover:border-white/5 rounded-xl p-3 transition-all duration-200 flex items-start gap-4 overflow-hidden"
        >
            {/* Hover Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            {/* Map Image */}
            <div className="relative shrink-0 self-center">
                <MapThumbnail mapName={server.map_name} className="w-48 aspect-video rounded-md shadow-sm" />
                <div className="absolute top-1.5 left-1.5 rounded bg-black/60 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm flex items-center gap-1">
                    {getTypeIcon(type)}
                    {type}
                </div>
            </div>

            <div className="flex-1 min-w-0 flex flex-col gap-3 py-1">
                {/* Header Line */}
                <div className="flex items-center gap-4 flex-wrap">
                    {/* Map Name */}
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-lg font-black text-white truncate tracking-tight group-hover:text-blue-400 transition-colors">
                            {server.map_name.replace('CTF-BT-', '🐰 ').replace('CTF-BT+', '🔑 ')}
                        </span>
                    </div>

                    {/* Metadata Badges */}
                    <div className="flex items-center gap-2">
                        {/* Region */}
                        <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded text-xs font-bold text-muted-foreground uppercase tracking-wider border border-white/5" title={region}>
                            <img
                                src={flag}
                                alt={region}
                                className="h-2.5 w-4 object-cover rounded-[1px] opacity-70"
                            />
                            {region}
                        </div>

                        {/* Ping */}
                        <div className="flex items-center gap-1 bg-white/5 px-2 py-1 rounded text-xs font-bold text-muted-foreground tabular-nums border border-white/5">
                            <Signal className={cn("size-3",
                                !server.ping ? "text-muted-foreground" :
                                    server.ping < 100 ? "text-green-500" :
                                        server.ping < 200 ? "text-yellow-500" : "text-red-500"
                            )} />
                            {server.ping ? `${server.ping}ms` : '...'}
                        </div>

                        {/* Player Count */}
                        <div className={cn(
                            "flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded text-xs font-bold tabular-nums border border-white/5",
                            server.player_count >= server.max_players ? "text-rose-400" :
                                server.player_count > 0 ? "text-emerald-400" : "text-muted-foreground"
                        )}>
                            <Users className="size-3" />
                            {server.player_count}/{server.max_players}
                        </div>

                        {server.spectators > 0 && (
                            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded text-xs font-bold text-muted-foreground tabular-nums border border-white/5">
                                <Eye className="size-3" />
                                {server.spectators}
                            </div>
                        )}
                    </div>
                </div>

                {/* Player List (Inline) */}
                <div className="flex flex-wrap gap-2 items-start content-start min-h-[28px]">
                    {sortedPlayers.length > 0 ? (
                        sortedPlayers.map(player => (
                            <PlayerTag key={`${player.id}-${player.name}`} player={player} />
                        ))
                    ) : null}
                </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 shrink-0 self-center pl-2 items-center">
                <Tooltip content={server.player_count >= server.max_players ? "Server is full" : "Join Server"}>
                    <div className="inline-flex">
                        <Button
                            onClick={() => onJoin(server, false)}
                            size="sm"
                            disabled={server.player_count >= server.max_players}
                            className="h-9 px-6 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg shadow-lg hover:shadow-primary/20 transition-all active:scale-95 group/join uppercase text-[10px] font-bold tracking-widest disabled:opacity-50"
                        >
                            <Play className="size-3 mr-2 fill-current transition-transform group-hover/join:translate-x-0.5" />
                            Join
                        </Button>
                    </div>
                </Tooltip>
                <Button
                    onClick={() => onJoin(server, true)}
                    size="sm"
                    variant="ghost"
                    className="h-8 px-4 text-muted-foreground hover:text-foreground rounded-lg hover:bg-white/5 transition-all text-[10px] font-bold uppercase tracking-widest gap-2"
                >
                    <Eye className="size-3" />
                    Spectate
                </Button>
            </div>
        </div>
    )
}

interface ServerBrowserPageProps { }

export function ServerBrowserPage({ }: ServerBrowserPageProps) {
    const logger = useLogger('ServerBrowserPage')
    const [servers, setServers] = useState<Server[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [launchError, setLaunchError] = useState<string | null>(null)
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)
    const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

    // Helper to load settings synchronously
    const getInitialSettings = (): SavedSettings | null => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) return JSON.parse(saved)
        } catch (err) {
            console.error('Failed to load settings', err)
        }
        return null
    }

    // Initialize state from localStorage if available
    const [initialSettings] = useState(() => getInitialSettings())

    const [sortOption, setSortOption] = useState<SortOption>(initialSettings?.sortOption ?? 'Players')
    const [isSidebarOpen, setIsSidebarOpen] = useState(initialSettings?.isSidebarOpen ?? true)
    const [filters, setFilters] = useState<FilterState>(initialSettings?.filters ?? {
        types: { Certified: true, Duel: true, Casual: true, Other: true },
        hideEmpty: false,
        hideFull: false,
        regions: {}
    })

    useEffect(() => {
        try {
            const settings: SavedSettings = {
                filters,
                sortOption,
                isSidebarOpen
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
        } catch (err) {
            logger.error('Failed to save settings', { error: err })
        }
    }, [filters, sortOption, isSidebarOpen])

    const pingAllServers = useCallback(async (serversToPing: Server[]) => {
        const uniqueIps = Array.from(new Set(serversToPing.map(s => s.ip)))

        uniqueIps.forEach(async (ip) => {
            try {
                const ping = await window.conveyor.game.pingServer(ip)
                setServers(prev => prev.map(s => s.ip === ip ? { ...s, ping } : s))
            } catch (err) {
                logger.error('Failed to ping server', { ip, error: err })
            }
        })
    }, [logger])

    const fetchServers = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            logger.info('Fetching servers...')
            const data = await window.conveyor.game.fetchServers()
            setServers(data)
            setLastRefresh(new Date())
            logger.info('Servers fetched', { count: data.length })
            pingAllServers(data)
        } catch (err) {
            logger.error('Failed to fetch servers', { error: err })
            setError('Failed to load servers')
        } finally {
            setLoading(false)
        }
    }, [logger, pingAllServers])

    useEffect(() => {
        fetchServers()

        const interval = setInterval(async () => {
            try {
                const isRunning = await window.conveyor.game.isGameRunning()
                if (!isRunning) {
                    fetchServers()
                }
            } catch (err) {
                console.error('Failed to check game status during auto-refresh', err)
            }
        }, 60000)

        return () => clearInterval(interval)
    }, [fetchServers])

    const availableRegions = useMemo(() => {
        const regions = new Set<string>()
        servers.forEach(s => {
            const region = getServerRegion(s.hostname)
            if (region) regions.add(region)
        })
        return Array.from(regions).sort()
    }, [servers])

    const processedServers = useMemo(() => {
        let result = filterServers(servers, filters)
        result = sortServers(result, sortOption)
        return result
    }, [servers, filters, sortOption])

    const handleJoin = async (server: Server, asSpectator: boolean) => {
        try {
            logger.info('Configuring player settings...', { asSpectator })

            if (window.conveyor?.ini) {
                if (asSpectator) {
                    // Join as Spectator
                    await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'OverrideClass', 'Botpack.CHSpectator')
                } else {
                    // Join as Player
                    const currentClass = await window.conveyor.ini.readIniValue('User.ini', 'DefaultPlayer', 'Class')
                    if (currentClass === 'Botpack.CHSpectator') {
                        await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'Class', '')
                    }

                    await window.conveyor.ini.writeIniValue('User.ini', 'DefaultPlayer', 'OverrideClass', '')
                }
            } else {
                logger.warn('INI API not available, skipping configuration')
            }

            logger.info('Joining server', { server, asSpectator })

            await window.conveyor.game.launchGame(server.ip, server.hostport)
        } catch (err) {
            logger.error('Failed to launch game', { error: err })
            setLaunchError(err instanceof Error ? err.message : 'An unknown error occurred while trying to launch the game.')
            setIsErrorModalOpen(true)
        }
    }

    return (
        <div className="h-full flex flex-col relative">
            {/* Header */}
            <div className="flex justify-between items-center shrink-0 mb-6 px-1">
                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="text-muted-foreground hover:text-white"
                        title={isSidebarOpen ? "Collapse Sidebar" : "Expand Sidebar"}
                    >
                        <PanelLeft className="size-5" />
                    </Button>
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight">Server Browser</h2>
                        {lastRefresh && (
                            <p className="text-[10px] font-bold text-muted-foreground/25 uppercase tracking-[0.2em] mt-0.5 ml-0.5">
                                Last refreshed: {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                            </p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Sort Controls */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">Sort by</span>
                        <div className="flex items-center bg-background/50 rounded-lg p-1 border border-white/5 shadow-inner">
                            <Button
                                onClick={() => setSortOption('Players')}
                                variant={sortOption === 'Players' ? "secondary" : "ghost"}
                                size="sm"
                                className={cn(
                                    "h-8 gap-2 text-xs font-medium transition-all",
                                    sortOption === 'Players'
                                        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/20"
                                        : "text-muted-foreground hover:text-white hover:bg-white/5"
                                )}
                            >
                                <Users className="size-3.5" />
                                Players
                            </Button>
                            <Button
                                onClick={() => setSortOption('Ping')}
                                variant={sortOption === 'Ping' ? "secondary" : "ghost"}
                                size="sm"
                                className={cn(
                                    "h-8 gap-2 text-xs font-medium transition-all",
                                    sortOption === 'Ping'
                                        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/20"
                                        : "text-muted-foreground hover:text-white hover:bg-white/5"
                                )}
                            >
                                <Signal className="size-3.5" />
                                Ping
                            </Button>
                        </div>
                    </div>

                    <Button onClick={fetchServers} disabled={loading} variant="outline" size="sm" className="gap-2 h-10 min-w-[120px]">
                        <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                        Refresh
                    </Button>
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive shrink-0 mb-4">
                    {error}
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex gap-6 min-h-0 relative overflow-hidden">
                {/* Sidebar */}
                <div
                    className={cn(
                        "transition-all duration-300 ease-in-out overflow-hidden",
                        isSidebarOpen ? "w-72 opacity-100 mr-0" : "w-0 opacity-0 -mr-6"
                    )}
                >
                    <ServerBrowserSidebar
                        filters={filters}
                        setFilters={setFilters}
                        availableRegions={availableRegions}
                        className="h-full"
                    />
                </div>

                {/* Server List */}
                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                    {processedServers.map((server) => (
                        <ServerRow
                            key={server.id}
                            server={server}
                            onJoin={handleJoin}
                        />
                    ))}

                    {processedServers.length === 0 && !loading && !error && (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-card/30 rounded-xl border border-white/5 border-dashed">
                            <Trophy className="size-12 mb-4 opacity-20" />
                            <p>No servers found matching filters.</p>
                        </div>
                    )}

                    {loading && servers.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                            <RefreshCw className="size-8 animate-spin mb-4 opacity-50" />
                            <p>Searching for servers...</p>
                        </div>
                    )}
                </div>
            </div>

            <ErrorModal
                isOpen={isErrorModalOpen}
                onClose={() => setIsErrorModalOpen(false)}
                title="Launch Error"
                message={launchError || 'Unknown error'}
            />
        </div>
    )
}
