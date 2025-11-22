import { useEffect, useState } from 'react'
import { Button } from '@/app/components/ui/button'
import { useLogger } from '@/app/hooks/use-logger'
import { RefreshCw, Play } from 'lucide-react'

interface Server {
    ip: string
    hostport: number
    hostname: string
    mapname: string
    numplayers: number
    maxplayers: number
    gametype?: string
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

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Server Browser</h2>
                    <p className="text-muted-foreground">Join active UT99 BunnyTrack servers</p>
                </div>
                <Button onClick={fetchServers} disabled={loading} variant="outline" size="sm" className="gap-2">
                    <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                </Button>
            </div>

            {error && (
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive">
                    {error}
                </div>
            )}

            <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-muted/50">
                            <tr>
                                <th className="p-4 font-medium text-muted-foreground">Server Name</th>
                                <th className="p-4 font-medium text-muted-foreground">Map</th>
                                <th className="p-4 font-medium text-muted-foreground">Players</th>
                                <th className="p-4 font-medium text-muted-foreground text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {servers.map((server) => (
                                <tr key={`${server.ip}:${server.hostport}`} className="group hover:bg-muted/50 transition-colors">
                                    <td className="p-4 font-medium">
                                        <div className="truncate max-w-[300px]" title={server.hostname}>
                                            {server.hostname}
                                        </div>
                                    </td>
                                    <td className="p-4 text-muted-foreground">{server.mapname}</td>
                                    <td className="p-4 text-muted-foreground">
                                        <span className={server.numplayers > 0 ? 'text-primary font-medium' : ''}>
                                            {server.numplayers}
                                        </span>
                                        <span className="text-muted-foreground/50">/{server.maxplayers}</span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <Button
                                            onClick={() => handleJoin(server)}
                                            size="sm"
                                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Play className="size-3 mr-1" /> Join
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                            {servers.length === 0 && !loading && !error && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                                        No servers found.
                                    </td>
                                </tr>
                            )}
                            {loading && servers.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="p-8 text-center text-muted-foreground">
                                        Searching for servers...
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
