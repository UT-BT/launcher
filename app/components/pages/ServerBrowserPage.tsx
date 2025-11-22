import { useEffect, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { useLogger } from '@/app/hooks/use-logger'
import { RefreshCw, Play, Users, Clock, Trophy, Shield } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Player {
    id: string
    name: string
    ping: number
    time: number
    team: number
    deaths: number
    is_spectator: boolean
}

interface Server {
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

    const fetchServers = async () => {
        setLoading(true)
        setError(null)
        try {
            logger.info('Fetching servers...')
            const data = await window.conveyor.game.fetchServers()
            setServers(data)
            logger.info('Servers fetched', { count: data.length })
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

    const handleJoin = async (server: Server) => {
        try {
            logger.info('Joining server', { server })
            await window.conveyor.game.launchGame(server.ip, server.hostport)
        } catch (err) {
            logger.error('Failed to launch game', { error: err })
        }
    }

    const formatTime = (seconds: number) => {
        if (seconds <= 0) return '0:00'
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Server Browser</h2>
                    <p className="text-muted-foreground">Join active UT99 BunnyTrack servers</p>
                </div>
                <Button onClick={fetchServers} disabled={loading} variant="outline" size="sm" className="gap-2">
                    <RefreshCw className={cn("size-4", loading && "animate-spin")} />
                    Refresh
                </Button>
            </div>

            {error && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive shrink-0">
                    {error}
                </div>
            )}

            <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                {servers.map((server) => (
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
                                {server.certified_records && (
                                    <div title="Certified Records">
                                        <Shield className="size-4 text-yellow-500 fill-yellow-500/20" />
                                    </div>
                                )}
                                <h3 className="font-bold text-lg truncate text-white group-hover:text-blue-400 transition-colors">
                                    {server.hostname}
                                </h3>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-white/80">{server.map_name}</span>
                                </div>
                                <div className="w-px h-3 bg-white/10" />
                                <div className="flex items-center gap-1.5">
                                    <Clock className="size-3.5" />
                                    <span>{formatTime(server.remaining_time_seconds)} left</span>
                                </div>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-6 z-10">
                            {/* Score (if relevant) */}
                            {(server.red_team_score > 0 || server.blue_team_score > 0) && (
                                <div className="flex items-center gap-3 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-sm border border-white/5">
                                    <span className="text-red-500 font-bold">{server.red_team_score}</span>
                                    <span className="text-muted-foreground text-xs">VS</span>
                                    <span className="text-blue-500 font-bold">{server.blue_team_score}</span>
                                </div>
                            )}

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
                ))}

                {servers.length === 0 && !loading && !error && (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground bg-card/30 rounded-xl border border-white/5 border-dashed">
                        <Trophy className="size-12 mb-4 opacity-20" />
                        <p>No servers found online.</p>
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
    )
}
