import { useState, useEffect } from 'react'
import { Modal } from '@/app/components/ui/modal'
import { fetchSummaryCaps, SummaryCap } from '@/app/utils/api'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PlayerInfo } from '@/app/components/shared/PlayerInfo'
import { FavoriteStar } from '@/app/components/shared/FavoriteStar'

import worldRecordIcon from '@/app/assets/world_record.png'
import championIcon from '@/app/assets/champion.png'
import goldIcon from '@/app/assets/gold.png'
import silverIcon from '@/app/assets/silver.png'
import bronzeIcon from '@/app/assets/bronze.png'
import certifiedIcon from '@/app/assets/certified.png'
import casualIcon from '@/app/assets/casual.png'

const getMedalIcon = (medal: string) => {
    switch (medal?.toLowerCase()) {
        case 'world record': return worldRecordIcon
        case 'champion medal': return championIcon
        case 'gold medal': return goldIcon
        case 'silver medal': return silverIcon
        case 'bronze medal': return bronzeIcon
        case 'certified': return certifiedIcon
        case 'casual': return casualIcon
        default: return null
    }
}

const MapThumbnail = ({ mapName, className }: { mapName: string, className?: string }) => {
    return (
        <div className={cn("overflow-hidden bg-muted/20 border border-white/5 rounded-lg shrink-0", className)}>
            <img
                src={`https://utbt.net/images/screenshots/${mapName}.png`}
                alt={mapName}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://utbt.net/images/screenshots/default.png' }}
            />
        </div>
    )
}

const formatCapTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)

    const msStr = ms.toString().padStart(3, '0')
    const secsStr = secs.toString().padStart(2, '0')
    const minsStr = minutes.toString().padStart(2, '0')

    if (hours > 0) {
        return `${hours}:${minsStr}:${secsStr}.${msStr}`
    }
    return `${minsStr}:${secsStr}.${msStr}`
}

interface HistoryModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    accessToken?: string
    favoriteMapNames: Set<string>
    onToggleFavorite: (mapName: string) => void
}

export function HistoryModal({ open, onOpenChange, accessToken, favoriteMapNames, onToggleFavorite }: HistoryModalProps) {
    const [caps, setCaps] = useState<SummaryCap[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (open && accessToken) {
            loadCaps()
        }
    }, [open, accessToken])

    const loadCaps = async () => {
        if (!accessToken) return
        setLoading(true)
        try {
            const data = await fetchSummaryCaps(accessToken)
            setCaps(data)
        } catch (err) {
            console.error('Failed to load history:', err)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Modal
            isOpen={open}
            onClose={() => onOpenChange(false)}
            title="Recent Caps History"
            offsetSidebar
            maxWidth="896px"
            className="bg-[#0a0a0b]/95 border-white/5 backdrop-blur-2xl"
        >
            <div className="space-y-2">
                {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
                    ))
                ) : caps.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 px-4 rounded-3xl bg-white/[0.02] border border-dashed border-white/5 gap-3">
                        <div className="size-12 rounded-full bg-blue-500/10 flex items-center justify-center">
                            <Clock className="size-6 text-blue-400" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-bold text-white/90">No Cap History</p>
                            <p className="text-[10px] text-muted-foreground/50 font-medium">Your personal bests will appear here once you start capping.</p>
                        </div>
                    </div>
                ) : (
                    caps.map((cap) => {
                        const medalIcon = getMedalIcon(cap.medal)
                        const date = new Date(cap.added)
                        const dateStr = date.toLocaleDateString(undefined, {
                            month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        })

                        return (
                            <div key={cap.id} className="group flex items-center gap-4 p-3 rounded-xl hover:bg-white/[0.03] border border-transparent hover:border-white/5 transition-all">
                                <MapThumbnail mapName={cap.mapName} className="w-20 aspect-video" />
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-white/90 truncate">{cap.mapName.replace('CTF-BT-', '')}</h3>
                                        {medalIcon && (
                                            <img src={medalIcon} alt={cap.medal} className="h-4 w-auto object-contain" title={cap.medal} />
                                        )}
                                        <FavoriteStar
                                            name={cap.mapName}
                                            isFavorited={favoriteMapNames.has(cap.mapName)}
                                            onToggle={onToggleFavorite}
                                            size="sm"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <div className="flex items-center gap-1.5 opacity-40">
                                            <Clock className="size-3" />
                                            <span className="text-[10px] font-medium">{dateStr}</span>
                                        </div>
                                        <div className="size-1 rounded-full bg-white/5" />
                                        <PlayerInfo alias={cap.author} size="sm" className="text-[10px] text-muted-foreground/40" />
                                        <div className="size-1 rounded-full bg-white/5" />
                                        <span className="text-[10px] font-bold text-orange-400/60 uppercase tracking-widest">Difficulty {cap.difficulty}</span>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-lg font-black font-mono text-white/90 tracking-tighter">
                                        {formatCapTime(cap.time)}
                                    </span>
                                </div>
                            </div>
                        )
                    })
                )}
            </div>

            <div className="p-4 mt-4 border-t border-white/5 bg-white/[0.02] rounded-b-xl">
                <p className="text-[10px] text-center font-bold text-muted-foreground/30 uppercase tracking-[0.2em]">
                    Showing last {caps.length} Caps
                </p>
            </div>
        </Modal>
    )
}