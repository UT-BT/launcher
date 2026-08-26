import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, Eye, LogIn, Play, Star } from 'lucide-react'
import { Tooltip } from '@/app/components/ui/tooltip'
import { Button } from '@/app/components/ui/button'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'
import type { Server } from '@/app/utils/server-utils'
import { getRegionFlag, getServerRegion, trimServerName } from '@/app/utils/server-utils'
import { displayMapName } from '@/app/utils/format'
import { cn } from '@/lib/utils'
import { capabilities } from '@/app/platform'

interface FavoriteServersCardProps {
    favoriteServerIds: Set<string>
    loadFailed: boolean
    liveServers: Server[]
    installationStatus?: 'valid' | 'no-install' | 'unsupported' | null
    signedIn: boolean
    onJoin: (server: Server, asSpectator: boolean) => void
    onToggleFavorite: (serverId: string) => void
    onSignIn: () => void
    onViewServers?: () => void
}

function EmptyState({ icon, children }: { icon?: ReactNode, children: ReactNode }) {
    return (
        <div className="bg-card/30 border border-hairline/5 rounded-xl flex flex-col items-center justify-center gap-3 px-4 py-8 text-center">
            {icon ?? <Star className="size-6 text-violet-300/70" />}
            {children}
        </div>
    )
}

export function FavoriteServersCard({
    favoriteServerIds, loadFailed, liveServers, installationStatus, signedIn,
    onJoin, onToggleFavorite, onSignIn, onViewServers,
}: FavoriteServersCardProps) {
    const liveById = useMemo(() => new Map(liveServers.map(server => [server.id, server])), [liveServers])
    const rows = useMemo(
        () => Array.from(favoriteServerIds)
            .map(serverId => liveById.get(serverId))
            .filter((server): server is Server => server !== undefined),
        [favoriteServerIds, liveById],
    )
    const [pingByIp, setPingByIp] = useState<Map<string, number>>(() => new Map())

    useEffect(() => {
        if (!capabilities.ping) return
        let cancelled = false
        const uniqueIps = Array.from(new Set(rows.map(server => server.ip)))
            .filter(ip => ip && !pingByIp.has(ip))
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
                .catch(() => undefined)
        })

        return () => { cancelled = true }
    }, [rows, pingByIp])

    if (!signedIn) {
        return (
            <EmptyState>
                <p className="text-xs text-muted-foreground">Sign in to keep your favorite servers here, on every device.</p>
                <Button size="sm" onClick={onSignIn} className="gap-1.5">
                    <LogIn className="size-3.5" />
                    Continue with Discord
                </Button>
            </EmptyState>
        )
    }

    if (loadFailed) {
        return (
            <EmptyState icon={<AlertTriangle className="size-6 text-amber-400/80" />}>
                <p className="text-xs text-muted-foreground">We couldn&apos;t load your favorite servers. Your stars are safe &mdash; refresh to try again.</p>
            </EmptyState>
        )
    }

    if (favoriteServerIds.size === 0) {
        return (
            <EmptyState>
                <p className="text-xs text-muted-foreground">Star a server on the Servers tab to pin it here.</p>
                {onViewServers && (
                    <Button size="sm" variant="outline" onClick={onViewServers}>Browse Servers</Button>
                )}
            </EmptyState>
        )
    }

    if (rows.length === 0) {
        return (
            <EmptyState>
                <p className="text-xs text-muted-foreground">None of your favorite servers are listed right now.</p>
            </EmptyState>
        )
    }

    return (
        <div className="@container/favservers bg-card/30 border border-hairline/5 rounded-xl overflow-hidden max-h-[10.75rem] sm:max-h-[14.25rem] overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:rgba(148,163,184,0.25)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-hairline/20">
            {rows.map(server => {
                const isFull = server.player_count >= server.max_players
                const canJoin = installationStatus === 'valid' && !isFull
                const canSpec = installationStatus === 'valid'
                const mapName = server.map_name ? displayMapName(server.map_name) : '-'
                const region = getServerRegion(server.hostname)
                const serverName = trimServerName(server.hostname)
                const ping = server.ping ?? pingByIp.get(server.ip)
                const pingColor = !ping ? 'text-muted-foreground' :
                    ping < 100 ? 'text-emerald-400' :
                        ping < 200 ? 'text-amber-300' : 'text-red-400'
                const playerTone = isFull ? 'text-rose-400' :
                    server.player_count > 0 ? 'text-emerald-400' : 'text-muted-foreground'
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
                    <div key={server.id} className="flex items-center gap-2 px-2 @sm/favservers:px-3 py-2.5 min-h-14 border-b border-hairline/5 last:border-0">
                        <FavoriteStar
                            name={serverName}
                            isFavorited
                            onToggle={() => onToggleFavorite(server.id)}
                            size="sm"
                            className="shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                            <div className="truncate text-sm font-semibold text-foreground">{serverName}</div>
                            <div className="text-[11px] text-muted-foreground truncate">{server.ip}:{server.hostport}</div>
                        </div>
                        <div className="hidden @lg/favservers:block w-32 shrink-0 min-w-0 text-xs font-medium text-muted-foreground truncate" title={mapName}>
                            {mapName}
                        </div>
                        <Tooltip content={region} side="top" className="shrink-0 justify-center">
                            <div className="flex w-9 flex-col items-center justify-center gap-1">
                                {capabilities.ping && (
                                    <span className={cn('text-[10px] font-bold leading-none tabular-nums', pingColor)}>
                                        {ping ? `${ping}ms` : '...'}
                                    </span>
                                )}
                                <img
                                    src={getRegionFlag(region)}
                                    alt={region}
                                    width={24}
                                    height={16}
                                    loading="lazy"
                                    decoding="async"
                                    className="h-4 w-6 object-cover rounded-[2px] border border-hairline/10"
                                />
                            </div>
                        </Tooltip>
                        <div className={cn('w-10 shrink-0 text-center text-xs font-bold tabular-nums', playerTone)}>
                            {server.player_count}/{server.max_players}
                        </div>
                        {capabilities.game && (
                            <div className="inline-flex items-center gap-1.5 shrink-0">
                                <Tooltip content={joinTooltip} side="top">
                                    <span className="inline-flex">
                                        <button
                                            type="button"
                                            onClick={() => onJoin(server, false)}
                                            disabled={!canJoin}
                                            className="inline-flex items-center justify-center gap-1.5 size-6 @md/favservers:size-auto @md/favservers:h-6 @md/favservers:px-2.5 rounded-md text-xs font-medium border border-accent-500/30 bg-accent-500/10 text-accent-300 hover:bg-accent-500/25 hover:text-accent-100 hover:border-accent-500/50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <Play className="size-3 fill-current" />
                                            <span className="hidden @md/favservers:inline">Join</span>
                                        </button>
                                    </span>
                                </Tooltip>
                                <Tooltip content={specTooltip} side="top">
                                    <span className="inline-flex">
                                        <button
                                            type="button"
                                            onClick={() => onJoin(server, true)}
                                            disabled={!canSpec}
                                            className="inline-flex items-center justify-center gap-1.5 size-6 @md/favservers:size-auto @md/favservers:h-6 @md/favservers:px-2.5 rounded-md text-xs font-medium border border-hairline/10 bg-hairline/5 text-muted-foreground hover:bg-hairline/10 hover:text-foreground hover:border-hairline/20 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        >
                                            <Eye className="size-3" />
                                            <span className="hidden @md/favservers:inline">Spec</span>
                                        </button>
                                    </span>
                                </Tooltip>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
