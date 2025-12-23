import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { useLogger } from '@/app/hooks/use-logger'
import { RefreshCw, Play, Users, Clock, Trophy, Shield, Signal, Swords, Coffee, PanelLeft, User, ExternalLink, Twitch } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FilterState, getRegionFlag, getServerRegion, getServerType, SortOption, filterServers, sortServers, trimServerName, getGameStatusText } from '@/app/utils/server-utils'
import { ServerBrowserSidebar } from '@/app/components/ServerBrowserSidebar'
import { JoinServerModal } from '@/app/components/JoinServerModal'
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

const MapThumbnail = ({ mapName }: { mapName: string }) => {
    const [imgSrc, setImgSrc] = useState(`https://utbt.net/images/screenshots/${mapName}.png`)

    return (
        <div className="size-20 rounded-lg overflow-hidden bg-muted relative shrink-0 border border-white/10 shadow-lg shadow-black/20 group-hover:shadow-blue-900/20 transition-shadow">
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

    return (
        <Tooltip
            content={isBot ? "Watch Live on Twitch" : `${player.name}${player.is_spectator ? ' (Spectator)' : ''} - ${player.ping}ms`}
        >
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
                        <ExternalLink className="size-2.5 text-[#9146FF] opacity-0 group-hover/player:opacity-100 transition-opacity" />
                    )}
                </div>
                {!isBot && (
                    <div className="flex items-center gap-1.5 shrink-0 opacity-40 group-hover/player:opacity-100 transition-opacity">
                        <div className={cn("size-1.5 rounded-full", pingColor)} />
                        <span className="text-[10px] tabular-nums font-bold tracking-tight">{player.ping}</span>
                    </div>
                )}
            </div>
        </Tooltip>
    )
}

const getTypeIcon = (type: string) => {
    switch (type) {
        case 'Certified': return <Shield className="size-4 text-yellow-500 fill-yellow-500/20" />
        case 'Duel': return <Swords className="size-4 text-red-500 fill-red-500/20" />
        case 'Casual': return <Coffee className="size-4 text-green-500 fill-green-500/20" />
        default: return null
    }
}

const ServerRow = ({ server, onJoin }: { server: Server, onJoin: (server: Server) => void }) => {
    const [isExpanded, setIsExpanded] = useState(false)
    const type = getServerType(server.hostname)
    const trimmedName = trimServerName(server.hostname)
    const region = getServerRegion(server.hostname)
    const flag = getRegionFlag(region)
    const statusText = getGameStatusText(
        server.remaining_time_seconds,
        server.certified_records,
        type,
        server.red_team_score,
        server.blue_team_score
    )

    const hasManyPlayers = server.players.length > 8 // Arbitrary threshold for "too many"

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
            className="group relative bg-card/50 hover:bg-card/80 border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all duration-200 flex items-center gap-6 overflow-hidden"
        >
            {/* Hover Gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            {/* Map Image */}
            <MapThumbnail mapName={server.map_name} />

            <div className="flex-1 min-w-0 flex flex-col gap-4">
                <div className="flex items-center gap-6">
                    {/* Server Info */}
                    <div className="flex-1 min-w-0 z-10">
                        <div className="flex items-center gap-2 mb-1">
                            <div title={type}>
                                {getTypeIcon(type)}
                            </div>
                            <img
                                src={flag}
                                alt={region}
                                title={region}
                                className="h-3.5 w-5 object-cover rounded-sm shadow-sm"
                            />
                            <h3 className="font-bold text-lg truncate text-white group-hover:text-blue-400 transition-colors">
                                {trimmedName}
                            </h3>
                            <div className="flex items-center gap-1.5 ml-2">
                                <Signal className={cn("size-3.5",
                                    !server.ping ? "text-muted-foreground" :
                                        server.ping < 100 ? "text-green-500" :
                                            server.ping < 200 ? "text-yellow-500" : "text-red-500"
                                )} />
                                <span className="text-sm text-muted-foreground">{server.ping ? `${server.ping}ms` : '...'}</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <span className="text-white/80">{server.map_name.replace('CTF-BT-', '🐰 ').replace('CTF-BT+', '🔑 ')}</span>
                            </div>
                            <div className="w-px h-3 bg-white/10" />
                            <div className="flex items-center gap-1.5">
                                <Clock className="size-3.5" />
                                <span>{statusText}</span>
                            </div>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 z-10">

                        {/* Players Count */}
                        <div className="flex flex-col items-end min-w-[80px]">
                            <div className="flex items-center gap-2 text-white">
                                <Users className="size-4 text-blue-400" />
                                <span className="font-bold text-lg">{server.player_count}/{server.max_players}</span>
                            </div>
                            {server.spectators > 0 && (
                                <span className="text-xs text-muted-foreground">
                                    {server.spectators} spectator{server.spectators === 1 ? '' : 's'}
                                </span>
                            )}
                        </div>

                        {/* Join Button */}
                        <Button
                            onClick={() => onJoin(server)}
                            className="h-10 px-6 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                        >
                            <Play className="size-4 mr-2 fill-current" />
                            Join
                        </Button>
                    </div>
                </div>

                {/* Players List */}
                {server.players && server.players.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-white/5 pt-3 mt-1.5 z-10 relative">
                        <div className={cn(
                            "flex flex-wrap gap-2.5 transition-all duration-500 ease-in-out overflow-hidden relative",
                            !isExpanded && hasManyPlayers ? "max-h-[44px]" : "max-h-[500px]"
                        )}>
                            {sortedPlayers.map(player => (
                                <PlayerTag key={`${player.id}-${player.name}`} player={player} />
                            ))}

                            {!isExpanded && hasManyPlayers && (
                                <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-card/80 to-transparent pointer-events-none" />
                            )}
                        </div>

                        {hasManyPlayers && (
                            <button
                                onClick={() => setIsExpanded(!isExpanded)}
                                className="self-start text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-blue-400 transition-colors flex items-center gap-1.5 mt-1"
                            >
                                <div className="w-8 h-px bg-white/5" />
                                {isExpanded ? 'Show Less' : `Show all ${server.players.length} players`}
                                <div className="w-8 h-px bg-white/5" />
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

interface ServerBrowserPageProps {
    installationStatus: 'valid' | 'no-install' | 'unsupported' | null
}

export function ServerBrowserPage({ installationStatus }: ServerBrowserPageProps) {
    const logger = useLogger('ServerBrowserPage')
    const [servers, setServers] = useState<Server[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedServer, setSelectedServer] = useState<Server | null>(null)
    const [launchError, setLaunchError] = useState<string | null>(null)
    const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)

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

    const [sortOption, setSortOption] = useState<SortOption>(initialSettings?.sortOption ?? 'Name')
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

    const pingAllServers = async (serversToPing: Server[]) => {
        const uniqueIps = Array.from(new Set(serversToPing.map(s => s.ip)))

        uniqueIps.forEach(async (ip) => {
            try {
                const ping = await window.conveyor.game.pingServer(ip)
                setServers(prev => prev.map(s => s.ip === ip ? { ...s, ping } : s))
            } catch (err) {
                logger.error('Failed to ping server', { ip, error: err })
            }
        })
    }

    const fetchServers = async () => {
        setLoading(true)
        setError(null)
        try {
            logger.info('Fetching servers...')
            const data = await window.conveyor.game.fetchServers()
            setServers(data)
            logger.info('Servers fetched', { count: data.length })
            pingAllServers(data)
        } catch (err) {
            logger.error('Failed to fetch servers', { error: err })
            setError('Failed to load servers')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchServers()
    }, [logger])

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

    const handleJoin = (server: Server) => {
        setSelectedServer(server)
    }

    const handleConfirmJoin = async (asSpectator: boolean) => {
        if (!selectedServer) return

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

            logger.info('Joining server', { server: selectedServer, asSpectator })

            await window.conveyor.game.launchGame(selectedServer.ip, selectedServer.hostport)
            setSelectedServer(null)
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
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    {/* Sort Controls */}
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-1">Sort by</span>
                        <div className="flex items-center bg-background/50 rounded-lg p-1 border border-white/5 shadow-inner">
                            <Button
                                onClick={() => setSortOption('Name')}
                                variant={sortOption === 'Name' ? "secondary" : "ghost"}
                                size="sm"
                                className={cn(
                                    "h-8 gap-2 text-xs font-medium transition-all",
                                    sortOption === 'Name'
                                        ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-900/20"
                                        : "text-muted-foreground hover:text-white hover:bg-white/5"
                                )}
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-[10px] leading-none">A-Z</span>
                                    Name
                                </div>
                            </Button>
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

                    <Button onClick={fetchServers} disabled={loading} variant="outline" size="sm" className="gap-2 h-10">
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
                        isSidebarOpen ? "w-64 opacity-100 mr-0" : "w-0 opacity-0 -mr-6"
                    )}
                >
                    <ServerBrowserSidebar
                        filters={filters}
                        setFilters={setFilters}
                        availableRegions={availableRegions}
                        className="rounded-xl border border-white/5 h-full"
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

            <JoinServerModal
                server={selectedServer}
                isOpen={!!selectedServer}
                onClose={() => setSelectedServer(null)}
                onJoin={handleConfirmJoin}
                installationStatus={installationStatus}
            />

            <ErrorModal
                isOpen={isErrorModalOpen}
                onClose={() => setIsErrorModalOpen(false)}
                title="Launch Error"
                message={launchError || 'Unknown error'}
            />
        </div>
    )
}
