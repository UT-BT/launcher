import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { useLogger } from '@/app/hooks/use-logger'
import { RefreshCw, Play, Users, Clock, Trophy, Shield, Signal, Swords, Coffee, PanelLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FilterState, getRegionFlag, getServerRegion, getServerType, SortOption, filterServers, sortServers, trimServerName, getGameStatusText } from '@/app/utils/server-utils'
import { ServerBrowserSidebar } from '@/app/components/ServerBrowserSidebar'
import { JoinServerModal } from '@/app/components/JoinServerModal'

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

export function ServerBrowserPage() {
    const logger = useLogger('ServerBrowserPage')
    const [servers, setServers] = useState<Server[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [selectedServer, setSelectedServer] = useState<Server | null>(null)

    const [sortOption, setSortOption] = useState<SortOption>('Name')
    const [isSidebarOpen, setIsSidebarOpen] = useState(true)
    const [filters, setFilters] = useState<FilterState>({
        types: { Certified: true, Duel: true, Casual: true, Other: true },
        hideEmpty: false,
        hideFull: false,
        regions: {}
    })
    const [isInitialized, setIsInitialized] = useState(false)

    useEffect(() => {
        try {
            const saved = localStorage.getItem(STORAGE_KEY)
            if (saved) {
                const parsed: SavedSettings = JSON.parse(saved)
                if (parsed.filters) setFilters(parsed.filters)
                if (parsed.sortOption) setSortOption(parsed.sortOption)
                if (typeof parsed.isSidebarOpen === 'boolean') setIsSidebarOpen(parsed.isSidebarOpen)
            }
        } catch (err) {
            logger.error('Failed to load settings', { error: err })
        } finally {
            setIsInitialized(true)
        }
    }, [])

    useEffect(() => {
        if (!isInitialized) return
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
    }, [filters, sortOption, isSidebarOpen, isInitialized])

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
    }, [])

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
            logger.info('Joining server', { server: selectedServer, asSpectator })
            await window.conveyor.game.launchGame(selectedServer.ip, selectedServer.hostport, undefined, asSpectator)
            setSelectedServer(null)
        } catch (err) {
            logger.error('Failed to launch game', { error: err })
        }
    }

    const getTypeIcon = (type: string) => {
        switch (type) {
            case 'Certified': return <Shield className="size-4 text-yellow-500 fill-yellow-500/20" />
            case 'Duel': return <Swords className="size-4 text-red-500 fill-red-500/20" />
            case 'Casual': return <Coffee className="size-4 text-green-500 fill-green-500/20" />
            default: return null
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
                    {processedServers.map((server) => {
                        const type = getServerType(server.hostname)
                        const trimmedName = trimServerName(server.hostname)
                        const region = getServerRegion(server.hostname)
                        const flag = getRegionFlag(region)
                        const statusText = getGameStatusText(
                            server.remaining_time_seconds,
                            server.certified_records,
                            type as any,
                            server.red_team_score,
                            server.blue_team_score
                        )

                        return (
                            <div
                                key={server.id}
                                className="group relative bg-card/50 hover:bg-card/80 border border-white/5 hover:border-white/10 rounded-xl p-4 transition-all duration-200 flex items-center gap-6 overflow-hidden"
                            >
                                {/* Hover Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

                                {/* Map Image */}
                                <MapThumbnail mapName={server.map_name} />

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
                                            <span className="text-white/80">{server.map_name}</span>
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

                                    {/* Players */}
                                    <div className="flex flex-col items-end min-w-[80px]">
                                        <div className="flex items-center gap-2 text-white">
                                            <Users className="size-4 text-blue-400" />
                                            <span className="font-bold text-lg">{server.player_count}/{server.max_players}</span>
                                        </div>
                                        {server.spectators > 0 && (
                                            <span className="text-xs text-muted-foreground">
                                                +{server.spectators} specs
                                            </span>
                                        )}
                                    </div>

                                    {/* Join Button */}
                                    <Button
                                        onClick={() => handleJoin(server)}
                                        className="h-10 px-6 bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                                    >
                                        <Play className="size-4 mr-2 fill-current" />
                                        Join
                                    </Button>
                                </div>
                            </div>
                        )
                    })}

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
            />
        </div>
    )
}
