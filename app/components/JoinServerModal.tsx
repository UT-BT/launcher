import { Button } from '@/app/components/ui/button'
import { Server } from '@/app/components/pages/ServerBrowserPage'
import { X, Eye, Play } from 'lucide-react'
import { cn } from '@/lib/utils'
import { trimServerName, getServerRegion } from '@/app/utils/server-utils'
import { useState } from 'react'

interface JoinServerModalProps {
    server: Server | null
    isOpen: boolean
    onClose: () => void
    onJoin: (asSpectator: boolean) => void
}

export function JoinServerModal({ server, isOpen, onClose, onJoin }: JoinServerModalProps) {
    const [imgError, setImgError] = useState(false)

    if (!isOpen || !server) return null

    const isFull = server.player_count >= server.max_players
    const region = getServerRegion(server.hostname)
    const trimmedName = `${trimServerName(server.hostname)} (${region})`
    const imgSrc = imgError
        ? 'https://utbt.net/images/screenshots/default.png'
        : `https://utbt.net/images/screenshots/${server.map_name}.png`

    return (
        <div className="fixed top-[var(--window-titlebar-height)] right-0 bottom-0 left-64 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md bg-card border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5">
                    <h3 className="font-bold text-lg truncate pr-4">Join Server</h3>
                    <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 rounded-full hover:bg-white/10">
                        <X className="size-4" />
                    </Button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    <div className="space-y-4 text-center">
                        <h4 className="font-bold text-xl text-white break-words">{trimmedName}</h4>

                        <div className="relative aspect-video w-full rounded-lg overflow-hidden border border-white/10 shadow-lg bg-black/50">
                            <img
                                src={imgSrc}
                                alt={server.map_name}
                                className="w-full h-full object-cover"
                                onError={() => setImgError(true)}
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                            <div className="absolute bottom-2 left-3 text-white font-medium text-sm drop-shadow-md">
                                {server.map_name}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-black/20 rounded-lg p-3 text-center border border-white/5">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Players</div>
                            <div className={cn("text-2xl font-bold", isFull ? "text-red-400" : "text-white")}>
                                {server.player_count}/{server.max_players}
                            </div>
                        </div>
                        <div className="bg-black/20 rounded-lg p-3 text-center border border-white/5">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Spectators</div>
                            <div className="text-2xl font-bold text-white">
                                {server.spectators}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3 pt-2">
                        <div className="relative group">
                            <Button
                                onClick={() => onJoin(false)}
                                disabled={isFull}
                                className="w-full h-12 text-base font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <Play className="size-5 mr-2 fill-current" />
                                Join as Player
                            </Button>
                            {isFull && (
                                <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-destructive text-destructive-foreground text-xs font-medium rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                                    Server is full
                                    <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 w-2 h-2 bg-destructive rotate-45" />
                                </div>
                            )}
                        </div>

                        <Button
                            onClick={() => onJoin(true)}
                            variant="secondary"
                            className="w-full h-12 text-base font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/5"
                        >
                            <Eye className="size-5 mr-2" />
                            Join as Spectator
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
