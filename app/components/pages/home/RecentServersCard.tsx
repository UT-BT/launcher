import { useEffect, useMemo, useState } from 'react'
import { Eye, Minus, Play, Server as ServerIcon } from 'lucide-react'
import { Tooltip } from '@/app/components/ui/tooltip'
import type { Server } from '@/app/components/pages/ServerBrowserPage'
import {
    getRegionFlag, getServerRegion, trimServerName, type RecentServerEntry,
} from '@/app/utils/server-utils'
import { displayMapName } from '@/app/utils/format'
import { cn } from '@/lib/utils'

interface RecentServersCardProps {
    recentServers: RecentServerEntry[]
    liveServers: Server[]
    installationStatus?: 'valid' | 'no-install' | 'unsupported' | null
    onJoin: (server: Server | RecentServerEntry, asSpectator: boolean) => void
    onHide: (serverId: string) => void
}

export function RecentServersCard({ recentServers, liveServers, installationStatus, onJoin, onHide }: RecentServersCardProps) {
    const liveById = useMemo(() => new Map(liveServers.map(server => [server.id, server])), [liveServers])
    const rows = useMemo(
        () => recentServers.map(entry => ({ entry, live: liveById.get(entry.id) ?? null })),
        [liveById, recentServers],
    )
    const [pingByIp, setPingByIp] = useState<Map<string, number>>(() => new Map())

    useEffect(() => {
        let cancelled = false
        const uniqueIps = Array.from(new Set(rows.map(({ entry, live }) => (live ?? entry).ip)))
            .filter(ip => !pingByIp.has(ip))
        if (uniqueIps.length === 0) return

        uniqueIps.forEach(ip => {
            window.conveyor.game.pingServer(ip)
                .then(ping => {
                    if (cancelled) return
                    setPingByIp(prev => {
                        const next = new Map(prev)
                        next.set(ip, ping)
                        return next
                    })
                })
                .catch(() => {
                    // Ping is supplemental for this compact feed; leave it pending if it fails.
                })
        })

        return () => { cancelled = true }
    }, [rows, pingByIp])

    if (rows.length === 0) {
        return (
            <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col items-center justify-center gap-2 py-8 text-center">
                <ServerIcon className="size-6 text-violet-300/70" />
                <p className="text-xs text-muted-foreground">Join a server to pin it here.</p>
            </div>
        )
    }

    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl overflow-hidden max-h-[10.75rem] sm:max-h-[14.25rem] overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.25)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-hairline/20">
            {rows.map(({ entry, live }) => {
                const server = live ?? entry
                const isFull = live ? live.player_count >= live.max_players : false
                const canJoin = installationStatus === 'valid' && !isFull
                const canSpec = installationStatus === 'valid'
                const players = live ? `${live.player_count}/${live.max_players}` : 'Offline'
                const mapName = live?.map_name ? displayMapName(live.map_name) : '-'
                const region = getServerRegion(server.hostname)
                const ping = live?.ping ?? pingByIp.get(server.ip)
                const pingColor = !ping ? 'text-muted-foreground' :
                    ping < 100 ? 'text-emerald-400' :
                        ping < 200 ? 'text-amber-300' : 'text-red-400'
                const playerTone = !live ? 'text-muted-foreground' :
                    isFull ? 'text-rose-400' :
                        live.player_count > 0 ? 'text-emerald-400' : 'text-muted-foreground'
                const joinTooltip =
                    installationStatus === 'no-install' ? 'No valid UT99 installation found' :
                        installationStatus === 'unsupported' ? 'Unsupported game version' :
                            isFull ? 'Server is full' :
                                'Join Server'
                const specTooltip =
                    installationStatus === 'no-install' ? 'No valid UT99 installation found' :
                        installationStatus === 'unsupported' ? 'Unsupported game version' :
                            'Spectate'
                return (
                    <div key={entry.id} className="grid grid-cols-[minmax(0,1fr)_minmax(8rem,0.72fr)_2rem_2.5rem_auto] [@media(min-height:761px)]:grid-cols-[minmax(0,1fr)_minmax(6.4rem,0.72fr)_2.75rem_1.5rem_2.5rem_auto] items-center gap-2 px-3 py-2.5 min-h-14 border-b border-hairline/5 last:border-0">
                        <div className="flex-1 min-w-0">
                            <div className="truncate text-sm font-semibold text-foreground">{trimServerName(server.hostname)}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{server.ip}:{server.hostport}</div>
                        </div>
                        <div className="min-w-0 text-xs font-medium text-muted-foreground truncate" title={mapName}>
                            {mapName}
                        </div>
                        <Tooltip content={region} side="top" className="justify-center [@media(min-height:761px)]:hidden">
                            <div className="flex flex-col items-center justify-center gap-1 min-w-0">
                                <span className={cn('text-[10px] font-bold leading-none tabular-nums', pingColor)}>
                                    {ping ? `${ping}ms` : '...'}
                                </span>
                                <img
                                    src={getRegionFlag(region)}
                                    alt={region}
                                    className="h-3.5 w-5 object-cover rounded-[2px] border border-hairline/10"
                                />
                            </div>
                        </Tooltip>
                        <div className={cn('hidden [@media(min-height:761px)]:block justify-self-center text-xs font-bold leading-none tabular-nums', pingColor)}>
                            {ping ? `${ping}ms` : '...'}
                        </div>
                        <Tooltip content={region} side="top" className="hidden [@media(min-height:761px)]:inline-flex justify-center">
                            <img
                                src={getRegionFlag(region)}
                                alt={region}
                                className="h-4 w-6 object-cover rounded-[2px] border border-hairline/10"
                            />
                        </Tooltip>
                        <div className={`w-10 justify-self-center text-center text-xs font-bold tabular-nums ${playerTone}`}>
                            {players}
                        </div>
                        <div className="inline-flex items-center gap-1.5 shrink-0">
                            <Tooltip content={joinTooltip} side="top">
                                <span className="inline-flex">
                                    <button
                                        type="button"
                                        onClick={() => onJoin(server, false)}
                                        disabled={!canJoin}
                                        className="inline-flex items-center justify-center gap-1.5 size-6 [@media(min-height:761px)]:size-auto [@media(min-height:761px)]:h-6 [@media(min-height:761px)]:px-2.5 rounded-md text-xs font-medium border border-accent-500/30 bg-accent-500/10 text-accent-300 hover:bg-accent-500/25 hover:text-accent-100 hover:border-accent-500/50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Play className="size-3 fill-current" />
                                        <span className="hidden [@media(min-height:761px)]:inline">Join</span>
                                    </button>
                                </span>
                            </Tooltip>
                            <Tooltip content={specTooltip} side="top">
                                <span className="inline-flex">
                                    <button
                                        type="button"
                                        onClick={() => onJoin(server, true)}
                                        disabled={!canSpec}
                                        className="inline-flex items-center justify-center gap-1.5 size-6 [@media(min-height:761px)]:size-auto [@media(min-height:761px)]:h-6 [@media(min-height:761px)]:px-2.5 rounded-md text-xs font-medium border border-hairline/10 bg-hairline/5 text-muted-foreground hover:bg-hairline/10 hover:text-foreground hover:border-hairline/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <Eye className="size-3" />
                                        <span className="hidden [@media(min-height:761px)]:inline">Spec</span>
                                    </button>
                                </span>
                            </Tooltip>
                            <Tooltip content="Hide Server" side="top">
                                <span className="inline-flex">
                                    <button
                                        type="button"
                                        aria-label="Hide Server"
                                        onClick={() => onHide(entry.id)}
                                        className="inline-flex items-center justify-center size-5 rounded-md border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/25 hover:text-red-100 hover:border-red-500/50 transition-colors cursor-pointer"
                                    >
                                        <Minus className="size-2.5" />
                                    </button>
                                </span>
                            </Tooltip>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
